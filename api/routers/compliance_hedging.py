"""
Credit Line Fintech Solution — Phase 21: Compliance & Hedging API Router.

Mounts endpoints for fuzzy AML sanction scans, CDS premium quoting, automated credit event triggers,
and distributed clearing house balance reconciliation checks.
"""

from __future__ import annotations
import ctypes
import json
import logging
import os
import random
import time
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.compliance_gate.sanction_scanner import SanctionScanner

logger = logging.getLogger("ComplianceHedgingRouter")

router = APIRouter(prefix="/api/v1/compliance", tags=["Compliance & Risk Hedging (Phase 21)"])

# ─── Mock In-Memory State for Quarantine Logs ─────────────────────────────────

MOCK_QUARANTINE_LOGS = [
    {
        "timestamp": "2026-05-27T18:40:02Z",
        "entity_name": "Ivan Badov",
        "watchlist": "OFAC SDN",
        "similarity_score": 0.984,
        "reason": "Jaro-Winkler match (0.984 >= 0.85)",
        "amount_usd": 250000.0,
        "status": "QUARANTINED"
    },
    {
        "timestamp": "2026-05-27T19:10:15Z",
        "entity_name": "Shadow Corp",
        "watchlist": "OFAC SDN",
        "similarity_score": 0.895,
        "reason": "Jaro-Winkler match (0.895 >= 0.85)",
        "amount_usd": 1200000.0,
        "status": "QUARANTINED"
    }
]

# ─── Request / Response Schemas ───────────────────────────────────────────────

class SanctionsScanRequest(BaseModel):
    entity_name: str = Field(..., description="Name of individual or corporate counterparty to scan")
    entity_embedding: Optional[List[float]] = Field(None, description="Optional GraphSAGE entity vector embedding")
    amount_usd: float = Field(5000.0, description="Transaction amount for reporting context")

class CDSQuoteRequest(BaseModel):
    default_intensity: float = Field(..., description="Real-time default intensity (lambda)")
    recovery_rate: float = Field(..., description="Expected asset recovery rate (R)")
    volatility: float = Field(..., description="Underlying collateral volatility (sigma)")
    alpha: float = Field(0.08, description="Risk premium scaling factor")

class ReconcileRequest(BaseModel):
    fiat_total: float = Field(..., description="Cumulative balance of bank ledger records")
    onchain_total: float = Field(..., description="Cumulative balance of blockchain tokens")
    tolerance: float = Field(0.01, description="Acceptable float variance threshold")

# ─── Fallback Helpers ─────────────────────────────────────────────────────────

def calculate_python_reconciliation(req: ReconcileRequest) -> Dict[str, Any]:
    """Fallback Python clearing reconciliation check."""
    diff = abs(req.fiat_total - req.onchain_total)
    reconciled = diff <= req.tolerance
    return {
        "success": True,
        "fiat_total": req.fiat_total,
        "onchain_total": req.onchain_total,
        "absolute_difference": diff,
        "reconciled": reconciled,
        "tolerance": req.tolerance,
        "execution_engine": "Python Reconciliation Engine (Fallback)"
    }

# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/sanctions/scan")
async def scan_sanctions(req: SanctionsScanRequest):
    """
    Screen counterparties against OFAC and global lists under a 10ms SLA.
    Quarantines matching entities and appends alerts to the audit log.
    """
    result = SanctionScanner.scan_entity(
        entity_name=req.entity_name,
        entity_embedding=req.entity_embedding
    )

    if result["is_quarantined"]:
        # Register in mock logs
        new_log = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "entity_name": req.entity_name,
            "watchlist": result["matched_watchlist"] or "Watchlist Match",
            "similarity_score": result["highest_similarity_score"],
            "reason": result["primary_match_reason"] or "Watchlist Match Score Triggered",
            "amount_usd": req.amount_usd,
            "status": "QUARANTINED"
        }
        MOCK_QUARANTINE_LOGS.insert(0, new_log)

    return result

@router.get("/sanctions/quarantine-logs")
async def get_quarantine_logs():
    """Retrieve the recent list of quarantined transactions."""
    return {"success": True, "logs": MOCK_QUARANTINE_LOGS}

@router.post("/cds/quote")
async def quote_cds_premium(req: CDSQuoteRequest):
    """
    Compute actuarial credit default swap premium quotes.
    Formula: Premium = lambda * (1 - R) + alpha * sigma^2
    """
    lambda_val = req.default_intensity
    r_val = req.recovery_rate
    sigma = req.volatility
    alpha = req.alpha

    term1 = lambda_val * (1.0 - r_val)
    term2 = alpha * (sigma ** 2)
    premium_rate = term1 + term2

    return {
        "success": True,
        "premium_rate": premium_rate,
        "premium_rate_bps": int(round(premium_rate * 10000)),
        "term1_default_risk": term1,
        "term2_volatility_premium": term2,
        "risk_parameters": {
            "default_intensity_lambda": lambda_val,
            "expected_recovery_r": r_val,
            "volatility_sigma": sigma,
            "alpha": alpha
        }
    }

@router.post("/cds/trigger-event")
async def trigger_cds_event():
    """
    Oracle trigger callback simulating borrower default.
    Halts premium collections and payouts covered principal atomically.
    """
    logger.warning("oracle_default_event_triggered")
    
    # Simulates settling the protection liabilities
    active_settlements = 3
    payout_usd = 2850000.0
    
    return {
        "success": True,
        "event_status": "CREDIT_EVENT_SETTLED",
        "active_protections_liquidated": active_settlements,
        "total_principal_paid_out_usd": payout_usd,
        "reserves_remaining_usd": 1970000.0,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

@router.post("/clearing/reconcile")
async def reconcile_clearing_balances(req: ReconcileRequest):
    """
    Verify ledger balance invariant validations using Rust actor compilation exports.
    """
    # Attempt loading compiled Rust library FFI bindings
    rust_lib_paths = [
        os.path.join("services", "clearing_house", "target", "release", "libclearing_processor.dll"),
        os.path.join("services", "clearing_house", "target", "release", "libclearing_processor.so"),
        os.path.join("services", "clearing_house", "libclearing_processor.so"),
        # Core rust build directory falls in target/release
        os.path.join("core_engine", "rust", "target", "release", "libclearing_processor.so")
    ]
    
    rust_lib_path = None
    for p in rust_lib_paths:
        if os.path.exists(p):
            rust_lib_path = p
            break

    if rust_lib_path:
        try:
            lib = ctypes.CDLL(rust_lib_path)
            
            # Configure reconcile_clearing_balances_json FFI type bindings
            lib.reconcile_clearing_balances_json.argtypes = [
                ctypes.c_double, ctypes.c_double, ctypes.c_double
            ]
            lib.reconcile_clearing_balances_json.restype = ctypes.c_char_p

            res_ptr = lib.reconcile_clearing_balances_json(
                req.fiat_total, req.onchain_total, req.tolerance
            )
            res_str = ctypes.string_at(res_ptr).decode("utf-8")
            result = json.loads(res_str)
            result["execution_engine"] = "Rust Clearing House Processor"
            return result
        except Exception as exc:
            logger.warning(f"rust_clearing_ffi_failed: {str(exc)}, falling back to python")
            pass

    return calculate_python_reconciliation(req)
