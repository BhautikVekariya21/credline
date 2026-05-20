"""
FinGuard 2026 — SOAR Swarm Orchestrator.

Central state machine that coordinates the multi-agent investigation
workflow. Dispatches fraud alerts through a pipeline of specialized
agents and manages state transitions in MongoDB.

State Machine:
  PENDING → TRIAGING → INVESTIGATING → REPORTING →
    ├── REMEDIATING → CLOSED (confidence ≥ 90%)
    └── AWAITING_APPROVAL → REMEDIATING / CLOSED (HITL path)
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

from config.logging_config import get_logger
from soar.audit_store import AuditStore
from soar.compliance_agent import ComplianceAgent
from soar.models import (
    EscalationRequest,
    FraudAlert,
    InvestigationState,
    RemediationAction,
    RemediationResult,
    TriageVerdict,
)
from soar.terminal_agent import TerminalAgent
from soar.triage_agent import TriageAgent

logger = get_logger(__name__)


class SwarmOrchestrator:
    """
    Multi-Agent Swarm Orchestrator — the SOAR brain.

    Coordinates Triage → Terminal → Compliance → Remediation pipeline
    with HITL escalation for low-confidence decisions.
    """

    def __init__(
        self,
        audit_store: AuditStore | None = None,
        neo4j_client: Any = None,
        confidence_threshold: float = 0.90,
        hitl_timeout_minutes: int = 30,
    ) -> None:
        # Infrastructure
        self._audit = audit_store or AuditStore()
        self._neo4j = neo4j_client
        self.confidence_threshold = confidence_threshold
        self.hitl_timeout_minutes = hitl_timeout_minutes

        # Agents
        self._triage = TriageAgent(neo4j_client=self._neo4j)
        self._terminal = TerminalAgent(
            neo4j_client=self._neo4j, audit_store=self._audit)
        self._compliance = ComplianceAgent(audit_store=self._audit)

        # Legacy bridge (lazy-loaded)
        self._legacy_bridge = None

        logger.info("swarm_orchestrator_initialized",
                    threshold=confidence_threshold)

    # ─── Main Entry Point ───────────────────────────────────────────────

    async def handle_alert(self, alert: FraudAlert) -> dict[str, Any]:
        """
        Process a high-risk fraud alert through the full agent pipeline.

        Returns the investigation document with final verdict.
        """
        start = time.time()
        logger.info("investigation_started", alert_id=alert.alert_id,
                    fraud_score=alert.fraud_score)

        # Create investigation
        investigation = {
            "investigation_id": f"INV-{alert.alert_id[4:]}",
            "alert": alert.model_dump(),
            "state": InvestigationState.PENDING.value,
            "confidence": 0.0,
        }
        inv_id = self._audit.create_investigation(investigation)

        try:
            # ── Phase 1: Triage ─────────────────────────────────────
            self._update_state(inv_id, InvestigationState.TRIAGING)
            triage_result = await self._run_triage(alert, inv_id)
            self._audit.update_investigation(inv_id, {
                "triage_result": triage_result.model_dump(),
            })

            # Short-circuit on false positive
            if triage_result.verdict == TriageVerdict.FALSE_POSITIVE:
                self._update_state(inv_id, InvestigationState.CLOSED)
                self._audit.update_investigation(inv_id, {
                    "final_verdict": "false_positive",
                    "confidence": triage_result.confidence,
                })
                elapsed = (time.time() - start) * 1000
                logger.info("investigation_closed_fp",
                            inv_id=inv_id, latency_ms=round(elapsed, 1))
                return self._audit.get_investigation(inv_id) or investigation

            # ── Phase 2: Terminal Investigation ─────────────────────
            self._update_state(inv_id, InvestigationState.INVESTIGATING)
            terminal_result = await self._run_terminal(alert, inv_id)
            self._audit.update_investigation(inv_id, {
                "terminal_result": terminal_result.model_dump(),
            })

            # ── Phase 3: Compliance Report ──────────────────────────
            self._update_state(inv_id, InvestigationState.REPORTING)
            compliance_result = await self._run_compliance(
                alert, triage_result, terminal_result, inv_id)
            self._audit.update_investigation(inv_id, {
                "compliance_result": compliance_result.model_dump(),
            })

            # ── Phase 4: Consensus & Remediation ────────────────────
            confidence = self._compute_consensus(
                triage_result, terminal_result, alert)
            self._audit.update_investigation(inv_id, {
                "confidence": confidence,
            })

            # Check HITL requirement
            if confidence < self.confidence_threshold:
                return await self._escalate_to_hitl(
                    inv_id, alert, confidence, triage_result,
                    terminal_result)

            # Auto-remediate
            self._update_state(inv_id, InvestigationState.REMEDIATING)
            remediation = await self._execute_remediation(
                alert, triage_result, inv_id)
            self._audit.update_investigation(inv_id, {
                "remediation_result": remediation.model_dump(),
                "final_verdict": "confirmed_fraud",
            })

            self._update_state(inv_id, InvestigationState.CLOSED)
            elapsed = (time.time() - start) * 1000
            logger.info("investigation_complete",
                        inv_id=inv_id,
                        verdict="confirmed_fraud",
                        confidence=round(confidence, 4),
                        latency_ms=round(elapsed, 1))

            return self._audit.get_investigation(inv_id) or investigation

        except Exception as e:
            logger.error("investigation_failed", inv_id=inv_id, error=str(e))
            self._update_state(inv_id, InvestigationState.FAILED)
            self._audit.update_investigation(inv_id, {
                "error": str(e),
                "final_verdict": "error",
            })
            return self._audit.get_investigation(inv_id) or investigation

    # ─── Agent Dispatch ─────────────────────────────────────────────────

    async def _run_triage(
        self, alert: FraudAlert, inv_id: str,
    ) -> Any:
        """Run triage agent in thread pool (CPU-bound)."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._triage.evaluate, alert)

    async def _run_terminal(
        self, alert: FraudAlert, inv_id: str,
    ) -> Any:
        """Run terminal agent in thread pool (I/O + CPU bound)."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._terminal.investigate, alert, inv_id)

    async def _run_compliance(
        self, alert: FraudAlert, triage_result: Any,
        terminal_result: Any, inv_id: str,
    ) -> Any:
        """Run compliance agent in thread pool."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._compliance.generate_report,
            alert, triage_result, terminal_result, inv_id)

    # ─── Consensus Logic ────────────────────────────────────────────────

    def _compute_consensus(
        self, triage_result: Any, terminal_result: Any,
        alert: FraudAlert,
    ) -> float:
        """
        Compute confidence score from multi-agent signals.

        Weighted combination:
          - Ensemble fraud score:  40%
          - Triage confidence:     30%
          - Terminal findings:     30%
        """
        ensemble_weight = 0.40
        triage_weight = 0.30
        terminal_weight = 0.30

        # Triage signal
        triage_signal = triage_result.confidence
        if triage_result.verdict == TriageVerdict.FALSE_POSITIVE:
            triage_signal = 1.0 - triage_signal

        # Terminal signal: more findings = higher confidence
        n_findings = len(terminal_result.suspicious_findings)
        terminal_signal = min(0.5 + (n_findings * 0.15), 1.0)

        confidence = (
            alert.fraud_score * ensemble_weight +
            triage_signal * triage_weight +
            terminal_signal * terminal_weight
        )
        return round(min(confidence, 1.0), 4)

    # ─── HITL Escalation ────────────────────────────────────────────────

    async def _escalate_to_hitl(
        self, inv_id: str, alert: FraudAlert,
        confidence: float, triage_result: Any,
        terminal_result: Any,
    ) -> dict:
        """Pause investigation and escalate to human analyst."""
        self._update_state(inv_id, InvestigationState.AWAITING_APPROVAL)

        from datetime import datetime, timedelta
        expires = (datetime.utcnow() +
                   timedelta(minutes=self.hitl_timeout_minutes))

        escalation = EscalationRequest(
            investigation_id=inv_id,
            reason=f"Confidence {confidence:.2%} below threshold "
                   f"{self.confidence_threshold:.2%}",
            confidence=confidence,
            investigation_summary={
                "alert_id": alert.alert_id,
                "fraud_score": alert.fraud_score,
                "triage_verdict": triage_result.verdict.value,
                "triage_confidence": triage_result.confidence,
                "findings": terminal_result.suspicious_findings[:5],
                "blast_radius_size": len(terminal_result.blast_radius),
            },
            triage_result=triage_result,
            terminal_result=terminal_result,
            expires_at=expires.isoformat() + "Z",
        )

        esc_data = escalation.model_dump()
        self._audit.create_escalation(esc_data)
        self._audit.update_investigation(inv_id, {
            "escalation_id": escalation.escalation_id,
        })

        logger.info("investigation_escalated",
                    inv_id=inv_id,
                    escalation_id=escalation.escalation_id,
                    confidence=confidence)

        return self._audit.get_investigation(inv_id) or {}

    # ─── Remediation ────────────────────────────────────────────────────

    async def _execute_remediation(
        self, alert: FraudAlert, triage_result: Any, inv_id: str,
    ) -> RemediationResult:
        """Execute remediation action via legacy banking bridge."""
        if triage_result.verdict == TriageVerdict.IMMEDIATE_ACTION:
            action = RemediationAction.ACCOUNT_FREEZE
        else:
            action = RemediationAction.TRANSACTION_HOLD

        # Attempt legacy bridge execution
        freeze_result = None
        try:
            bridge = self._get_legacy_bridge()
            if bridge:
                loop = asyncio.get_event_loop()
                freeze_result = await loop.run_in_executor(
                    None, bridge.freeze_account,
                    alert.user_id,
                    f"SOAR auto-remediation: INV {inv_id}")

                # Log to audit with cryptographic signature
                self._audit.log_remediation(
                    investigation_id=inv_id,
                    action=action.value,
                    account_id=alert.user_id,
                    result=freeze_result.model_dump() if freeze_result else {},
                )
        except Exception as e:
            logger.warning("remediation_bridge_failed", error=str(e))

        success = freeze_result.success if freeze_result else False
        return RemediationResult(
            action_taken=action,
            freeze_result=freeze_result,
            success=success,
            reasoning=f"Executed {action.value} for user {alert.user_id}. "
                      f"Success: {success}",
        )

    def _get_legacy_bridge(self) -> Any:
        """Lazy-load the legacy banking bridge."""
        if self._legacy_bridge is None:
            try:
                from soar.legacy_bridge import LegacyBankingBridge
                from soar.models import BankPortalConfig
                config = BankPortalConfig(
                    bank_name="MockBank",
                    portal_url="http://localhost:8090",
                )
                self._legacy_bridge = LegacyBankingBridge(config)
            except Exception as e:
                logger.warning("legacy_bridge_unavailable", error=str(e))
        return self._legacy_bridge

    # ─── Helpers ────────────────────────────────────────────────────────

    def _update_state(self, inv_id: str, state: InvestigationState) -> None:
        """Update investigation state with audit logging."""
        self._audit.update_investigation(inv_id, {"state": state.value})
        logger.info("state_transition", inv_id=inv_id, state=state.value)

    # ─── Manual Trigger (for API/CLI) ───────────────────────────────────

    async def process_escalation_decision(
        self, escalation_id: str, approved: bool,
        analyst_id: str = "analyst-001", notes: str = "",
    ) -> dict:
        """Process an analyst's HITL decision."""
        esc = self._audit.get_escalation(escalation_id)
        if not esc:
            return {"error": f"Escalation {escalation_id} not found"}

        inv_id = esc.get("investigation_id", "")
        status = "approved" if approved else "denied"

        self._audit.update_escalation(escalation_id, {
            "status": status,
            "analyst_id": analyst_id,
            "notes": notes,
        })

        self._audit.log_action(
            investigation_id=inv_id,
            agent="hitl",
            action=f"escalation_{status}",
            input_data={"analyst_id": analyst_id, "notes": notes},
            output_data={"approved": approved},
        )

        if approved:
            # Resume remediation
            alert_data = esc.get("investigation_summary", {})
            alert = FraudAlert(
                transaction_id=alert_data.get("alert_id", "unknown"),
                user_id=alert_data.get("user_id",
                    self._audit.get_investigation(inv_id).get(
                        "alert", {}).get("user_id", "unknown")),
                merchant_id="unknown",
                device_id="unknown",
                ip_address="0.0.0.0",
                amount=0.0,
                timestamp="",
                fraud_score=alert_data.get("fraud_score", 0.0),
                risk_level="high",
            )
            inv = self._audit.get_investigation(inv_id)
            if inv:
                alert = FraudAlert(**inv.get("alert", alert.model_dump()))

            triage_data = esc.get("triage_result")
            from soar.models import TriageResult as TR
            triage_result = TR(**triage_data) if triage_data else TR(
                verdict=TriageVerdict.NEEDS_INVESTIGATION, confidence=0.5)

            self._update_state(inv_id, InvestigationState.REMEDIATING)
            remediation = await self._execute_remediation(
                alert, triage_result, inv_id)
            self._audit.update_investigation(inv_id, {
                "remediation_result": remediation.model_dump(),
                "final_verdict": "confirmed_fraud_hitl",
            })
            self._update_state(inv_id, InvestigationState.CLOSED)
        else:
            self._audit.update_investigation(inv_id, {
                "final_verdict": "cleared_by_analyst",
            })
            self._update_state(inv_id, InvestigationState.CLOSED)

        logger.info("escalation_resolved",
                    escalation_id=escalation_id,
                    decision=status, analyst=analyst_id)

        return self._audit.get_investigation(inv_id) or {}
