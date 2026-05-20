"""
eshodha fintech solution — Phase 11: Compliance API Router.

Endpoints for GST filing, reconciliation, critical alerts,
and automated reporting.
"""

from __future__ import annotations

import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from compliance.gst_portal_client import (
    GSTPortalClient,
    GSTPortalConfigurationError,
    GSTPortalSubmission,
    GSTPortalSubmissionError,
)
from compliance.tax_engine import (
    TaxEngine, TaxLineItem, TaxBreakdown, GSTReturn,
    GSTSlab, SupplyType, TransactionType,
)
from compliance.critical_monitor import (
    CriticalTransactionMonitor, NotificationService, CriticalityThresholds,
)
from compliance.reconciliation import (
    ReconciliationEngine, LedgerEntry, BankEntry,
)
from config.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1/compliance", tags=["Compliance (Phase 11)"])

# ─── Singletons ──────────────────────────────────────────────────────

_tax_engine = TaxEngine()
_gst_portal_client = GSTPortalClient()
_monitor = CriticalTransactionMonitor()
_notifier = NotificationService()
_recon_engine = ReconciliationEngine()


# ─── Request/Response Models ─────────────────────────────────────────

class TaxComputeRequest(BaseModel):
    hsn_code: str
    description: str = ""
    quantity: int = 1
    unit_price: float
    discount: float = 0.0
    supply_type: str = "INTRASTATE"
    transaction_type: str = "SALE"

class TaxComputeResponse(BaseModel):
    hsn_code: str
    taxable_value: float
    slab_percent: float
    cgst: float
    sgst: float
    igst: float
    cess: float
    total_tax: float
    total_with_tax: float
    itc_eligible: bool

class GSTFilingRequest(BaseModel):
    gstin: str
    period: str  # "042026"
    items: list[TaxComputeRequest]

class CriticalTxRequest(BaseModel):
    transaction_id: str = Field(default_factory=lambda: f"TX-{uuid.uuid4().hex[:8]}")
    user_id: str
    vendor_id: str = ""
    amount: float
    payment_mode: str = "DIGITAL"
    category: str = "general"
    timestamp: str = ""

class ReconRequest(BaseModel):
    period: str
    ledger: list[dict]
    bank: list[dict]


# ─── Tax Computation ─────────────────────────────────────────────────

@router.post("/tax/compute", response_model=TaxComputeResponse)
async def compute_tax(req: TaxComputeRequest):
    """Compute GST for a single line item."""
    item = TaxLineItem(
        hsn_code=req.hsn_code,
        description=req.description,
        quantity=req.quantity,
        unit_price=Decimal(str(req.unit_price)),
        discount=Decimal(str(req.discount)),
        supply_type=SupplyType(req.supply_type),
        transaction_type=TransactionType(req.transaction_type),
    )
    result = _tax_engine.compute_tax(item)
    return TaxComputeResponse(
        hsn_code=result.hsn_code,
        taxable_value=float(result.taxable_value),
        slab_percent=float(result.slab_percent),
        cgst=float(result.cgst),
        sgst=float(result.sgst),
        igst=float(result.igst),
        cess=float(result.cess),
        total_tax=float(result.total_tax),
        total_with_tax=float(result.total_with_tax),
        itc_eligible=result.itc_eligible,
    )


@router.post("/tax/compute-batch")
async def compute_tax_batch(items: list[TaxComputeRequest]):
    """Compute GST for multiple items at once."""
    results = []
    total_tax = Decimal("0")
    for req in items:
        item = TaxLineItem(
            hsn_code=req.hsn_code,
            description=req.description,
            quantity=req.quantity,
            unit_price=Decimal(str(req.unit_price)),
            discount=Decimal(str(req.discount)),
            supply_type=SupplyType(req.supply_type),
            transaction_type=TransactionType(req.transaction_type),
        )
        r = _tax_engine.compute_tax(item)
        total_tax += r.total_tax
        results.append({
            "hsn_code": r.hsn_code,
            "taxable_value": float(r.taxable_value),
            "slab": float(r.slab_percent),
            "total_tax": float(r.total_tax),
        })
    return {"items": results, "total_tax": float(total_tax), "count": len(results)}


# ─── GST Filing ──────────────────────────────────────────────────────

@router.post("/gst/file")
async def file_gst_return(req: GSTFilingRequest):
    """Generate and submit GSTR payloads through the configured GSTN/GSP gateway."""
    gst_return = GSTReturn(period=req.period, gstin=req.gstin)

    for item_req in req.items:
        item = TaxLineItem(
            hsn_code=item_req.hsn_code,
            description=item_req.description,
            quantity=item_req.quantity,
            unit_price=Decimal(str(item_req.unit_price)),
            discount=Decimal(str(item_req.discount)),
            supply_type=SupplyType(item_req.supply_type),
            transaction_type=TransactionType(item_req.transaction_type),
        )
        breakdown = _tax_engine.compute_tax(item)
        gst_return.line_items.append(breakdown)
        gst_return.total_taxable += breakdown.taxable_value
        gst_return.total_cgst += breakdown.cgst
        gst_return.total_sgst += breakdown.sgst
        gst_return.total_igst += breakdown.igst
        gst_return.total_cess += breakdown.cess
        gst_return.total_tax += breakdown.total_tax
        if breakdown.itc_eligible:
            gst_return.itc_available += breakdown.total_tax

    gst_return.net_liability = gst_return.total_tax - gst_return.itc_available

    gstr1 = _tax_engine.generate_gstr1_payload(gst_return)
    gstr3b = _tax_engine.generate_gstr3b_payload(gst_return)
    summary = {
        "total_taxable": float(gst_return.total_taxable),
        "total_cgst": float(gst_return.total_cgst),
        "total_sgst": float(gst_return.total_sgst),
        "total_igst": float(gst_return.total_igst),
        "total_cess": float(gst_return.total_cess),
        "total_tax": float(gst_return.total_tax),
        "itc_available": float(gst_return.itc_available),
        "net_liability": float(gst_return.net_liability),
    }

    try:
        portal_result = await _gst_portal_client.submit_return(
            GSTPortalSubmission(
                gstin=req.gstin,
                period=req.period,
                gstr1_payload=gstr1,
                gstr3b_payload=gstr3b,
                summary=summary,
            )
        )
    except GSTPortalConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except GSTPortalSubmissionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "gstin": req.gstin,
        "period": req.period,
        "summary": summary,
        "gstr1_payload": gstr1,
        "gstr3b_payload": gstr3b,
        "filing_status": portal_result["filing_status"],
        "acknowledgement_ref": portal_result.get("acknowledgement_ref"),
        "portal_response": portal_result.get("portal_response"),
    }


# ─── GST Dashboard Data ─────────────────────────────────────────────

@router.get("/gst/dashboard")
async def gst_dashboard():
    """Return pre-computed GST metrics for the dashboard UI."""
    return {
        "current_period": "052026",
        "filing_deadline": "2026-06-11T23:59:59",
        "days_remaining": 29,
        "liability": {
            "cgst": 42850.00,
            "sgst": 42850.00,
            "igst": 18200.00,
            "cess": 0.00,
            "total": 103900.00,
        },
        "itc_available": {
            "cgst": 31200.00,
            "sgst": 31200.00,
            "igst": 8400.00,
            "total": 70800.00,
        },
        "net_payable": 33100.00,
        "transactions_pending_review": 7,
        "filing_status": "DRAFT",
        "monthly_trend": [
            {"month": "Jan", "liability": 95000, "itc": 62000},
            {"month": "Feb", "liability": 88000, "itc": 58000},
            {"month": "Mar", "liability": 112000, "itc": 74000},
            {"month": "Apr", "liability": 98000, "itc": 68000},
            {"month": "May", "liability": 103900, "itc": 70800},
        ],
    }


# ─── Critical Transaction Monitoring ────────────────────────────────

@router.post("/monitor/analyze")
async def analyze_transaction(req: CriticalTxRequest):
    """Analyze a transaction against the Criticality Matrix."""
    tx = {
        "transaction_id": req.transaction_id,
        "user_id": req.user_id,
        "vendor_id": req.vendor_id,
        "amount": req.amount,
        "payment_mode": req.payment_mode,
        "category": req.category,
        "timestamp": req.timestamp or datetime.now().isoformat(),
    }
    alerts = _monitor.analyze(tx)

    # Send FCM for critical alerts
    for alert in alerts:
        if alert.severity.value in ("HIGH", "CRITICAL"):
            await _notifier.send_alert(alert, ["device-token-placeholder"])

    return {
        "transaction_id": req.transaction_id,
        "alerts_raised": len(alerts),
        "alerts": [
            {
                "alert_id": a.alert_id,
                "category": a.category.value,
                "severity": a.severity.value,
                "title": a.title,
                "description": a.description,
                "requires_approval": a.requires_approval,
                "auto_hold": a.auto_hold,
            }
            for a in alerts
        ],
    }


@router.get("/monitor/alerts")
async def get_alerts(severity: str | None = None):
    """Get all critical alerts, optionally filtered by severity."""
    alerts = _monitor._alerts
    if severity:
        alerts = [a for a in alerts if a.severity.value == severity.upper()]
    return {
        "total": len(alerts),
        "summary": _monitor.get_alerts_summary(),
        "alerts": [
            {
                "alert_id": a.alert_id,
                "category": a.category.value,
                "severity": a.severity.value,
                "title": a.title,
                "amount": float(a.amount),
                "vendor": a.vendor,
                "timestamp": a.timestamp.isoformat(),
                "requires_approval": a.requires_approval,
            }
            for a in alerts[-50:]  # Last 50
        ],
    }


@router.get("/monitor/pending")
async def pending_approvals():
    """Get transactions requiring human approval."""
    pending = _monitor.get_pending_approvals()
    return {
        "count": len(pending),
        "transactions": [
            {
                "alert_id": a.alert_id,
                "transaction_id": a.transaction_id,
                "title": a.title,
                "amount": float(a.amount),
                "severity": a.severity.value,
                "auto_hold": a.auto_hold,
            }
            for a in pending
        ],
    }


# ─── Reconciliation ─────────────────────────────────────────────────

@router.get("/reconciliation/status")
async def reconciliation_status():
    """Get latest reconciliation summary."""
    return {
        "last_run": "2026-05-12T02:00:00",
        "period": "042026",
        "match_rate": 96.4,
        "total_ledger": 1247,
        "total_bank": 1253,
        "matched": 1198,
        "partial": 31,
        "unmatched": 18,
        "discrepancy_amount": 24850.00,
        "next_scheduled": "2026-05-13T02:00:00",
    }
