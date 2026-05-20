"""
FinGuard 2026 — SOAR (Security Orchestration, Automation & Response) Router.

Endpoints for:
  - Triggering autonomous fraud investigations
  - Viewing investigation status and audit trails
  - HITL (Human-in-the-Loop) escalation approve/deny
  - Listing pending escalations for the Command Center
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.middleware.auth import verify_api_key
from config.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1/soar", tags=["SOAR"])


# ─── Request Models ───────────────────────────────────────────────────

class TriggerInvestigationRequest(BaseModel):
    transaction_id: str
    user_id: str
    merchant_id: str = "unknown"
    device_id: str = "unknown"
    ip_address: str = "0.0.0.0"
    amount: float = 0.0
    currency: str = "USD"
    fraud_score: float = 0.85
    risk_level: str = "high"
    reason_codes: dict[str, float] = {}


class EscalationDecisionRequest(BaseModel):
    approved: bool
    analyst_id: str = "analyst-001"
    notes: str = ""


# ─── Investigation Endpoints ──────────────────────────────────────────

@router.post("/investigate")
async def trigger_investigation(
    req: TriggerInvestigationRequest,
    _key: str = Depends(verify_api_key),
):
    """Trigger a full autonomous SOAR investigation from a fraud alert."""
    from soar.models import FraudAlert
    from soar.orchestrator import SwarmOrchestrator

    alert = FraudAlert(
        transaction_id=req.transaction_id,
        user_id=req.user_id,
        merchant_id=req.merchant_id,
        device_id=req.device_id,
        ip_address=req.ip_address,
        amount=req.amount,
        currency=req.currency,
        timestamp="",
        fraud_score=req.fraud_score,
        risk_level=req.risk_level,
        reason_codes=req.reason_codes,
    )

    orchestrator = SwarmOrchestrator()
    result = await orchestrator.handle_alert(alert)

    logger.info("soar_investigation_triggered",
                user_id=req.user_id,
                fraud_score=req.fraud_score)
    return result


@router.get("/investigation/{inv_id}")
async def get_investigation(
    inv_id: str,
    _key: str = Depends(verify_api_key),
):
    """Get the full investigation document by ID."""
    from soar.audit_store import AuditStore

    store = AuditStore()
    inv = store.get_investigation(inv_id)
    if not inv:
        raise HTTPException(404, detail=f"Investigation {inv_id} not found")
    return inv


@router.get("/investigations")
async def list_investigations(
    state: str | None = None,
    limit: int = 50,
    _key: str = Depends(verify_api_key),
):
    """List recent investigations, optionally filtered by state."""
    from soar.audit_store import AuditStore

    store = AuditStore()
    investigations = store.list_investigations(state=state, limit=limit)
    return {"count": len(investigations), "investigations": investigations}


# ─── HITL Escalation Endpoints ────────────────────────────────────────

@router.get("/escalations")
async def list_pending_escalations(
    _key: str = Depends(verify_api_key),
):
    """List all pending HITL escalations for the Command Center."""
    from soar.audit_store import AuditStore

    store = AuditStore()
    escalations = store.list_pending_escalations()
    return {"count": len(escalations), "escalations": escalations}


@router.post("/escalation/{escalation_id}/decide")
async def decide_escalation(
    escalation_id: str,
    req: EscalationDecisionRequest,
    _key: str = Depends(verify_api_key),
):
    """Approve or deny a pending HITL escalation."""
    from soar.orchestrator import SwarmOrchestrator

    orchestrator = SwarmOrchestrator()
    result = await orchestrator.process_escalation_decision(
        escalation_id=escalation_id,
        approved=req.approved,
        analyst_id=req.analyst_id,
        notes=req.notes,
    )

    logger.info("soar_escalation_decided",
                escalation_id=escalation_id,
                approved=req.approved,
                analyst=req.analyst_id)
    return result


# ─── Audit Trail ──────────────────────────────────────────────────────

@router.get("/audit/{inv_id}")
async def get_audit_trail(
    inv_id: str,
    _key: str = Depends(verify_api_key),
):
    """Get the cryptographically signed audit trail for an investigation."""
    from soar.audit_store import AuditStore

    store = AuditStore()
    actions = store.get_actions_for_investigation(inv_id)
    return {"investigation_id": inv_id, "actions": actions, "count": len(actions)}
