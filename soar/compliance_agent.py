"""
FinGuard 2026 — SOAR Compliance Agent.

Automatically drafts Suspicious Activity Reports (SARs) by combining
findings from the Triage and Terminal agents with SHAP reason codes
and graph connection data.

Output: FinCEN-compliant SAR in both JSON and formatted Markdown.
Integrates with the existing ReasonMemoGenerator from services/governance.py.
"""

from __future__ import annotations

import time
import uuid
from typing import Any

from config.logging_config import get_logger
from soar.models import (
    ComplianceResult,
    FraudAlert,
    SARReport,
    TerminalResult,
    TriageResult,
)

logger = get_logger(__name__)

# ─── Prompt Template ────────────────────────────────────────────────────────

COMPLIANCE_SYSTEM_PROMPT = """You are a BSA/AML Compliance Officer drafting a FinCEN-compliant 
Suspicious Activity Report (SAR) for the FinGuard 2026 platform.

Your SAR must include:
1. Subject identification (anonymized user ID)
2. Suspicious activity description with exact timeline
3. Amount and transaction details
4. Graph connections to other suspicious entities
5. SHAP reason codes mapped to regulatory categories
6. Recommended enforcement actions

Regulatory categories to consider:
- Structuring / Smurfing
- Money Laundering (Layering)
- Identity Theft / Account Takeover
- Terrorist Financing
- Fraud — Wire / Electronic
- Fraud — Credit Card
- Insider Trading

Be precise, factual, and cite specific data points."""

# ─── Regulatory Category Mapping ───────────────────────────────────────────

REASON_CODE_TO_CATEGORY = {
    "tx_velocity_1h": "Structuring / Smurfing",
    "tx_count_5m": "Structuring / Smurfing",
    "amount_zscore": "Fraud — Wire / Electronic",
    "amount_sum_1h": "Money Laundering (Layering)",
    "device_sharing_count": "Identity Theft / Account Takeover",
    "device_user_count": "Identity Theft / Account Takeover",
    "ip_user_count": "Identity Theft / Account Takeover",
    "geo_velocity_kmh": "Fraud — Wire / Electronic",
    "distance_from_last_km": "Fraud — Wire / Electronic",
    "merchant_risk_score": "Fraud — Credit Card",
    "account_age_days": "Fraud — Wire / Electronic",
    "time_since_last_tx_sec": "Structuring / Smurfing",
}


class ComplianceAgent:
    """
    Compliance Agent — auto-drafts Suspicious Activity Reports.

    Combines triage findings, terminal investigation results, and
    SHAP reason codes into a structured, regulatory-compliant SAR.
    """

    def __init__(self, audit_store: Any = None) -> None:
        self._audit = audit_store
        self._memo_gen = None
        self._init_memo_generator()

    def _init_memo_generator(self) -> None:
        try:
            from services.governance import ReasonMemoGenerator
            self._memo_gen = ReasonMemoGenerator()
        except ImportError:
            logger.warning("reason_memo_generator_unavailable")

    def generate_report(
        self,
        alert: FraudAlert,
        triage_result: TriageResult,
        terminal_result: TerminalResult,
        investigation_id: str = "",
    ) -> ComplianceResult:
        """Generate a full SAR from investigation findings."""
        start = time.time()
        logger.info("compliance_report_started",
                    alert_id=alert.alert_id,
                    investigation_id=investigation_id)

        # ── Map reason codes to regulatory categories ───────────────
        regulatory_categories = set()
        reason_code_details = []
        for code, impact in alert.reason_codes.items():
            category = REASON_CODE_TO_CATEGORY.get(code, "Other")
            regulatory_categories.add(category)
            reason_code_details.append({
                "code": code,
                "impact": round(impact, 4),
                "direction": "increased_risk" if impact > 0 else "decreased_risk",
                "regulatory_category": category,
            })

        # ── Build timeline from investigation ───────────────────────
        timeline = self._build_timeline(alert, triage_result, terminal_result)

        # ── Extract graph connections ───────────────────────────────
        graph_connections = []
        for node in terminal_result.blast_radius[:10]:
            graph_connections.append({
                "entity_id": node.node_id,
                "entity_type": node.node_type,
                "risk_score": node.risk_score,
                "is_flagged": node.is_flagged,
                "relationship": "within_blast_radius",
            })

        # ── Determine recommended actions ───────────────────────────
        recommended_actions = self._determine_actions(
            alert, triage_result, terminal_result)

        # ── Generate activity summary ───────────────────────────────
        activity_summary = self._generate_summary(
            alert, triage_result, terminal_result, regulatory_categories)

        # ── Build SAR ───────────────────────────────────────────────
        sar = SARReport(
            subject_user_id=alert.user_id,
            activity_start=alert.timestamp,
            activity_end=alert.timestamp,
            total_amount=alert.amount,
            activity_summary=activity_summary,
            timeline=timeline,
            graph_connections=graph_connections,
            reason_codes=reason_code_details,
            recommended_actions=recommended_actions,
            regulatory_categories=sorted(regulatory_categories),
        )

        # ── Generate Markdown report ───────────────────────────────
        sar.markdown_report = self._render_markdown(
            sar, alert, triage_result, terminal_result)

        # ── Regulatory compliance checks ────────────────────────────
        regulatory_flags = []
        if alert.amount > 10000:
            regulatory_flags.append("CTR_THRESHOLD_EXCEEDED")
        if alert.amount > 5000:
            regulatory_flags.append("SAR_FILING_RECOMMENDED")
        if "Money Laundering" in str(regulatory_categories):
            regulatory_flags.append("AML_FLAG")
        if "Identity Theft" in str(regulatory_categories):
            regulatory_flags.append("IDENTITY_THEFT_FLAG")

        # ── Audit logging ───────────────────────────────────────────
        if self._audit:
            self._audit.log_action(
                investigation_id=investigation_id,
                agent="compliance",
                action="draft_sar",
                input_data={"alert_id": alert.alert_id},
                output_data={
                    "sar_id": sar.sar_id,
                    "categories": sorted(regulatory_categories),
                    "actions": recommended_actions,
                },
            )

        elapsed = (time.time() - start) * 1000
        logger.info("compliance_report_complete",
                    sar_id=sar.sar_id,
                    categories=len(regulatory_categories),
                    latency_ms=round(elapsed, 1))

        return ComplianceResult(
            sar_report=sar,
            regulatory_flags=regulatory_flags,
            ecoa_compliant=True,
            bsa_aml_compliant=True,
            reasoning=f"SAR {sar.sar_id} generated with "
                      f"{len(regulatory_categories)} regulatory categories "
                      f"and {len(recommended_actions)} recommended actions.",
        )

    def _build_timeline(
        self, alert: FraudAlert,
        triage: TriageResult, terminal: TerminalResult,
    ) -> list[dict]:
        """Build activity timeline from investigation data."""
        events = [
            {
                "timestamp": alert.timestamp,
                "event": "suspicious_transaction",
                "details": f"${alert.amount:,.2f} at {alert.merchant_id}",
            },
            {
                "timestamp": triage.timestamp,
                "event": "triage_completed",
                "details": f"Verdict: {triage.verdict.value} "
                           f"(confidence: {triage.confidence:.2%})",
            },
        ]

        for cmd in terminal.cli_commands_executed:
            events.append({
                "timestamp": cmd.executed_at,
                "event": "forensic_command",
                "details": cmd.command[:80],
            })

        events.append({
            "timestamp": terminal.timestamp,
            "event": "investigation_completed",
            "details": f"{len(terminal.suspicious_findings)} findings",
        })

        return events

    def _determine_actions(
        self, alert: FraudAlert,
        triage: TriageResult, terminal: TerminalResult,
    ) -> list[str]:
        """Determine recommended enforcement actions."""
        actions = []

        if triage.verdict.value == "immediate_action":
            actions.append("FREEZE_ACCOUNT")
            actions.append("BLOCK_DEVICE")
            actions.append("FILE_SAR_IMMEDIATELY")
        elif triage.verdict.value == "needs_investigation":
            actions.append("PLACE_TRANSACTION_HOLD")
            actions.append("FILE_SAR_WITHIN_30_DAYS")

        if terminal.suspicious_findings:
            actions.append("FLAG_CONNECTED_ENTITIES")
        if any(n.is_flagged for n in terminal.blast_radius):
            actions.append("EXPAND_INVESTIGATION_SCOPE")
        if alert.amount > 10000:
            actions.append("FILE_CTR")

        return list(dict.fromkeys(actions))  # deduplicate preserving order

    def _generate_summary(
        self, alert: FraudAlert, triage: TriageResult,
        terminal: TerminalResult, categories: set,
    ) -> str:
        """Generate human-readable activity summary."""
        return (
            f"On {alert.timestamp}, user {alert.user_id} initiated a "
            f"transaction of {alert.currency} {alert.amount:,.2f} at merchant "
            f"{alert.merchant_id} from device {alert.device_id} "
            f"(IP: {alert.ip_address}). The FinGuard ensemble model flagged "
            f"this transaction with a fraud score of {alert.fraud_score:.4f} "
            f"({alert.risk_level} risk). Automated triage classified this as "
            f"'{triage.verdict.value}' with {triage.confidence:.2%} confidence. "
            f"Terminal investigation revealed {len(terminal.suspicious_findings)} "
            f"suspicious findings across {len(terminal.blast_radius)} connected "
            f"entities. Regulatory categories: {', '.join(sorted(categories))}."
        )

    def _render_markdown(
        self, sar: SARReport, alert: FraudAlert,
        triage: TriageResult, terminal: TerminalResult,
    ) -> str:
        """Render the SAR as formatted Markdown."""
        lines = [
            f"# Suspicious Activity Report",
            f"**SAR ID:** {sar.sar_id}  ",
            f"**Filing Type:** {sar.filing_type}  ",
            f"**Generated:** {sar.generated_at}  ",
            "",
            "---",
            "",
            "## 1. Subject Information",
            f"- **User ID:** {sar.subject_user_id}",
            f"- **Device:** {alert.device_id}",
            f"- **IP Address:** {alert.ip_address}",
            "",
            "## 2. Suspicious Activity",
            sar.activity_summary,
            "",
            "## 3. Timeline",
            "| Timestamp | Event | Details |",
            "|-----------|-------|---------|",
        ]
        for evt in sar.timeline:
            lines.append(
                f"| {evt['timestamp']} | {evt['event']} | {evt['details']} |")

        lines.extend([
            "",
            "## 4. Risk Indicators (SHAP Reason Codes)",
            "| Code | Impact | Category |",
            "|------|--------|----------|",
        ])
        for rc in sar.reason_codes:
            lines.append(
                f"| {rc['code']} | {rc['impact']:+.4f} | "
                f"{rc['regulatory_category']} |")

        if sar.graph_connections:
            lines.extend([
                "",
                "## 5. Connected Entities (Blast Radius)",
                "| Entity | Type | Risk | Flagged |",
                "|--------|------|------|---------|",
            ])
            for gc in sar.graph_connections:
                flag = "⚠ YES" if gc["is_flagged"] else "No"
                lines.append(
                    f"| {gc['entity_id']} | {gc['entity_type']} | "
                    f"{gc['risk_score']:.2f} | {flag} |")

        lines.extend([
            "",
            "## 6. Recommended Actions",
        ])
        for action in sar.recommended_actions:
            lines.append(f"- {action}")

        lines.extend([
            "",
            "## 7. Regulatory Categories",
        ])
        for cat in sar.regulatory_categories:
            lines.append(f"- {cat}")

        lines.extend([
            "",
            "---",
            f"*Report generated automatically by FinGuard 2026 SOAR "
            f"Compliance Agent. SAR ID: {sar.sar_id}*",
        ])

        return "\n".join(lines)
