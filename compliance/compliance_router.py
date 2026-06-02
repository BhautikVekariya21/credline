"""
Credit Line Fintech Solution — Phase 11: Compliance API Router.

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

# In-memory tax filings database for simulation
_tax_filings: dict[str, dict[str, Any]] = {
    "TAX-GST-001": {
        "id": "TAX-GST-001",
        "tax_type": "GST",
        "period": "052026",
        "taxpayer_name": "Credit Line Inc.",
        "taxpayer_id": "29ABCDE1234F1Z5",
        "liability": 33100.0,
        "status": "UNPAID",
        "created_at": "2026-05-25T10:00:00Z",
        "payment_details": None
    },
    "TAX-ITR-001": {
        "id": "TAX-ITR-001",
        "tax_type": "ITR",
        "period": "AY 2026-27",
        "taxpayer_name": "Credit Line Inc.",
        "taxpayer_id": "PAN1234567A",
        "liability": 1250000.0,
        "status": "PAID",
        "created_at": "2026-04-15T09:30:00Z",
        "payment_details": {
            "method": "ACH",
            "account_mask": "******4567",
            "timestamp": "2026-04-16T14:22:10Z"
        }
    }
}


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

    # Register in our tax filing ledger
    filing_id = f"TAX-GST-{uuid.uuid4().hex[:6].upper()}"
    _tax_filings[filing_id] = {
        "id": filing_id,
        "tax_type": "GST",
        "period": req.period,
        "taxpayer_name": "Credit Line Inc.",
        "taxpayer_id": req.gstin.upper(),
        "liability": float(gst_return.net_liability),
        "status": "UNPAID" if gst_return.net_liability > 0 else "PAID",
        "created_at": datetime.now().isoformat() + "Z",
        "payment_details": None
    }

    return {
        "id": filing_id,
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


# ─── Direct & Corporate Tax filing and Payment Acceptance ─────────────

class ITRFilingRequest(BaseModel):
    taxpayer_name: str
    pan: str = Field(..., min_length=10, max_length=10)
    assessment_year: str = "2026-27"
    salary_income: float = 0.0
    business_income: float = 0.0
    other_income: float = 0.0
    deductions: float = 0.0

class CorporateTaxFilingRequest(BaseModel):
    entity_name: str
    corporate_id: str
    tax_year: str = "2026"
    revenue: float
    opex: float
    interest_paid: float = 0.0

class TaxPaymentRequest(BaseModel):
    filing_id: str
    payment_method: str  # CARD, ACH, CRYPTO
    payment_details: dict[str, Any]
    amount: float

@router.post("/tax/file-itr")
async def file_itr(req: ITRFilingRequest):
    """File an Income Tax Return (ITR) and compute tax using standard slab rates."""
    gross_income = req.salary_income + req.business_income + req.other_income
    taxable_income = max(0.0, gross_income - req.deductions)
    
    # Calculate tax based on standard Indian slab rates
    tax = 0.0
    ti = taxable_income
    if ti > 1500000:
        tax += (ti - 1500000) * 0.30
        ti = 1500000
    if ti > 1200000:
        tax += (ti - 1200000) * 0.20
        ti = 1200000
    if ti > 900000:
        tax += (ti - 900000) * 0.15
        ti = 900000
    if ti > 600000:
        tax += (ti - 600000) * 0.10
        ti = 600000
    if ti > 300000:
        tax += (ti - 300000) * 0.05
    
    filing_id = f"TAX-ITR-{uuid.uuid4().hex[:6].upper()}"
    filing = {
        "id": filing_id,
        "tax_type": "ITR",
        "period": f"AY {req.assessment_year}",
        "taxpayer_name": req.taxpayer_name,
        "taxpayer_id": req.pan.upper(),
        "liability": round(tax, 2),
        "status": "UNPAID" if tax > 0 else "PAID",
        "created_at": datetime.now().isoformat() + "Z",
        "payment_details": None,
        "meta": {
            "gross_income": gross_income,
            "taxable_income": taxable_income,
        }
    }
    _tax_filings[filing_id] = filing
    return filing

@router.post("/tax/file-corporate")
async def file_corporate(req: CorporateTaxFilingRequest):
    """File corporate tax return. Flat 25% tax on net profit."""
    net_profit = max(0.0, req.revenue - req.opex - req.interest_paid)
    tax = net_profit * 0.25
    
    filing_id = f"TAX-CORP-{uuid.uuid4().hex[:6].upper()}"
    filing = {
        "id": filing_id,
        "tax_type": "Corporate Tax",
        "period": f"FY {req.tax_year}",
        "taxpayer_name": req.entity_name,
        "taxpayer_id": req.corporate_id.upper(),
        "liability": round(tax, 2),
        "status": "UNPAID" if tax > 0 else "PAID",
        "created_at": datetime.now().isoformat() + "Z",
        "payment_details": None,
        "meta": {
            "revenue": req.revenue,
            "opex": req.opex,
            "net_profit": net_profit
        }
    }
    _tax_filings[filing_id] = filing
    return filing

@router.post("/tax/pay-liability")
async def pay_tax_liability(req: TaxPaymentRequest):
    """Pay outstanding tax liability using card, ACH, or web3 crypto wallet."""
    if req.filing_id not in _tax_filings:
        raise HTTPException(status_code=404, detail="Tax filing entry not found")
    
    filing = _tax_filings[req.filing_id]
    if filing["status"] == "PAID":
        return {"success": True, "message": "Filing is already paid", "filing": filing}
        
    if req.amount < filing["liability"] - 0.1:
        raise HTTPException(status_code=400, detail="Insufficient payment amount to cover liability")
    
    payment_method = req.payment_method.upper()
    mask = ""
    if payment_method == "CARD":
        card_num = req.payment_details.get("card_number", "")
        mask = f"Ending in {card_num[-4:]}" if len(card_num) >= 4 else "Card"
    elif payment_method == "ACH":
        acc_num = req.payment_details.get("account_number", "")
        mask = f"Ending in {acc_num[-4:]}" if len(acc_num) >= 4 else "Bank Acc"
    elif payment_method == "CRYPTO":
        wallet = req.payment_details.get("wallet_address", "")
        mask = f"{wallet[:6]}...{wallet[-4:]}" if len(wallet) >= 10 else "Web3 Wallet"
    else:
        raise HTTPException(status_code=400, detail="Unsupported payment method")
        
    filing["status"] = "PAID"
    filing["payment_details"] = {
        "method": payment_method,
        "account_mask": mask,
        "timestamp": datetime.now().isoformat() + "Z",
        "tx_hash": f"TXH-{uuid.uuid4().hex[:12].upper()}"
    }
    
    return {
        "success": True,
        "message": "Payment accepted and filing settled",
        "filing": filing
    }

@router.get("/tax/filings")
async def get_tax_filings():
    """Get all filed returns."""
    return list(_tax_filings.values())


# ─── Compatibility Router for Frontend ──────────────────────────────
compat_router = APIRouter(prefix="/compliance", tags=["Compliance Compatibility"])

@compat_router.get("/gst/dashboard")
async def get_compat_gst_dashboard():
    return await gst_dashboard()

@compat_router.get("/monitor/alerts")
async def get_compat_alerts(severity: str | None = None):
    return await get_alerts(severity=severity)

@compat_router.get("/forensics/benford")
async def get_benford_forensics():
    import random
    from services.analytics.forensic_auditor import BenfordAuditor
    txs = []
    # Conforming Benford distribution data
    for _ in range(1200):
        # 10^uniform gives a logarithmic distribution matching Benford's Law
        amt = 10 ** random.uniform(1.5, 6.0)
        txs.append({"amount": amt})

    # Add minor structuring anomalies
    if random.random() < 0.2:
        for _ in range(75):
            txs.append({"amount": 49000.0})

    auditor = BenfordAuditor()
    return auditor.analyze(txs)

@compat_router.get("/forensics/cfo-summary")
async def get_cfo_summary():
    import random
    from services.analytics.forensic_auditor import BenfordAuditor, FinancialStatementCompiler, CFOExecutiveNarrative
    txs = []
    for _ in range(1200):
        txs.append({
            "amount": 10 ** random.uniform(1.5, 6.0),
            "category": random.choice(["revenue", "cogs", "salary", "opex", "interest", "tax", "general"]),
            "transaction_type": random.choice(["DEBIT", "CREDIT"])
        })

    compiler = FinancialStatementCompiler()
    financial_data = compiler.compile_reports(txs)
    auditor = BenfordAuditor()
    anomaly_report = auditor.analyze(txs)

    cfo = CFOExecutiveNarrative()
    summary = await cfo.generate_summary(financial_data, anomaly_report)
    return {"summary": summary}


@compat_router.get("/tax/filings")
async def get_compat_tax_filings():
    return await get_tax_filings()

@compat_router.post("/tax/file-itr")
async def post_compat_file_itr(req: ITRFilingRequest):
    return await file_itr(req)

@compat_router.post("/tax/file-corporate")
async def post_compat_file_corporate(req: CorporateTaxFilingRequest):
    return await file_corporate(req)

@compat_router.post("/tax/pay-liability")
async def post_compat_pay_liability(req: TaxPaymentRequest):
    return await pay_tax_liability(req)

