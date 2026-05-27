"""
Credit Line Fintech Solution — Phase 20: Institutional RWA & DID API Router.

Mounts endpoints for verification of self-sovereign identity verifiable presentations,
algorithmic credit AMM borrow rate evaluations, and tokenized real-world asset collateral vaults.
"""

from __future__ import annotations
import ctypes
import json
import logging
import os
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.did_identity.did_validator import DidValidator

logger = logging.getLogger("InstitutionalRouter")

router = APIRouter(prefix="/api/v1/institutional", tags=["Institutional RWA & AMM (Phase 20)"])

# ─── Mock In-Memory State for RWA Vaults ──────────────────────────────────────

MOCK_VAULTS = [
    {
        "borrower": "0x8923aB7fA2eE11029cDb892a0149028913904412",
        "asset_id": 1,
        "asset_name": "Prime Commercial Plaza Deed",
        "asset_type": "Real Estate",
        "collateral_shares": 500000,
        "total_shares": 1000000,
        "unit_price_usd": 12.50,
        "borrowed_amount_usd": 4200000.0,
        "max_ltv_bps": 7000,
        "health_factor_bps": 10416, # (500k * 12.50 * 0.70) / 4.2M = 1.0416
    },
    {
        "borrower": "0x4412fC09B4F8a11028baA90Eef49201498cDb892",
        "asset_id": 2,
        "asset_name": "Tata Supply Logistics Invoices",
        "asset_type": "Invoice Financing",
        "collateral_shares": 800000,
        "total_shares": 1000000,
        "unit_price_usd": 1.00,
        "borrowed_amount_usd": 680000.0,
        "max_ltv_bps": 8500,
        "health_factor_bps": 10000, # (800k * 1.00 * 0.85) / 680k = 1.00
    },
    {
        "borrower": "0x5112aC90b4Fe8e110285aA0Ee9028914908920de",
        "asset_id": 3,
        "asset_name": "Gold Grain Warehouse Receipt",
        "asset_type": "Inventory",
        "collateral_shares": 200000,
        "total_shares": 1000000,
        "unit_price_usd": 50.00,
        "borrowed_amount_usd": 7500000.0,
        "max_ltv_bps": 7500,
        "health_factor_bps": 10000, # (200k * 50.00 * 0.75) / 7.5M = 1.00
    },
    {
        "borrower": "0x3901bC09aD11029cDb892A0EeF901498CdB89201",
        "asset_id": 4,
        "asset_name": "Hindustan Logistics Invoices",
        "asset_type": "Invoice Financing",
        "collateral_shares": 150000,
        "total_shares": 1000000,
        "unit_price_usd": 2.50,
        "borrowed_amount_usd": 290000.0,
        "max_ltv_bps": 8000,
        "health_factor_bps": 10344, # (150k * 2.50 * 0.80) / 290k = 1.0344
    }
]

# ─── Request / Response Schemas ───────────────────────────────────────────────

class DIDVerifyRequest(BaseModel):
    presentation: Dict[str, Any] = Field(..., description="W3C Verifiable Presentation wrapping a Verifiable Credential")

class AMMCalculateRequest(BaseModel):
    total_borrowed: float = Field(..., description="Total outstanding debt in liquidity pool")
    total_liquidity: float = Field(..., description="Total assets supplied in pool")
    base_rate: float = Field(0.02, description="Base rate R_0")
    slope1: float = Field(0.04, description="Slope modifier 1")
    slope2: float = Field(0.25, description="Slope modifier 2 (spike above kink)")
    kink: float = Field(0.80, description="Kink utilization threshold")

class LiquidationRequest(BaseModel):
    borrower: str = Field(..., description="Target borrower address")
    asset_id: int = Field(..., description="Underlying RWA asset ID")
    repay_amount: float = Field(..., description="Debt repayment size (USDC scale)")

# ─── Helper Functions ─────────────────────────────────────────────────────────

def calculate_python_amm_rate(req: AMMCalculateRequest) -> Dict[str, Any]:
    """Fallback Python AMM borrow rate calculation."""
    ut = 0.0 if req.total_liquidity <= 0 else req.total_borrowed / req.total_liquidity
    ut_capped = min(ut, 1.0)
    excess = max(0.0, ut_capped - req.kink)
    rate = req.base_rate + (ut_capped * req.slope1) + (excess * req.slope2)
    return {
        "success": True,
        "utilization": ut_capped,
        "base_rate": req.base_rate,
        "rate": rate,
        "kink_active": ut_capped > req.kink,
        "execution_engine": "Python Curve Engine (Fallback)"
    }

def recalculate_health_factor(vault: Dict[str, Any]):
    """Helper to compute health factor basis points for mock vaults."""
    borrowed = vault["borrowed_amount_usd"]
    if borrowed <= 0:
        vault["health_factor_bps"] = 100000 # infinite health
        return

    # Collateral Value = shares * price / totalShares
    collateral_val = (vault["collateral_shares"] * vault["unit_price_usd"])
    max_borrow = (collateral_val * vault["max_ltv_bps"]) / 10000
    vault["health_factor_bps"] = int((max_borrow * 10000) / borrowed)

# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/did/verify")
async def verify_did_presentation(req: DIDVerifyRequest):
    """
    Verify W3C self-sovereign verifiable presentation parameters,
    resolving did:key base58 methods and validating credential integrity.
    """
    result = DidValidator.verify_presentation(req.presentation)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result

@router.post("/amm/calculate")
async def calculate_amm_rate(req: AMMCalculateRequest):
    """
    Query dynamic interest rates by executing high-performance Rust calculations.
    """
    # 1. Attempt loading compiled Rust library FFI bindings
    rust_lib_paths = [
        os.path.join("services", "amm_clearing", "target", "release", "libcredit_amm_model.dll"),
        os.path.join("services", "amm_clearing", "target", "release", "libcredit_amm_model.so"),
        os.path.join("services", "amm_clearing", "libcredit_amm_model.so")
    ]
    
    rust_lib_path = None
    for p in rust_lib_paths:
        if os.path.exists(p):
            rust_lib_path = p
            break

    if rust_lib_path:
        try:
            # Load DLL
            lib = ctypes.CDLL(rust_lib_path)
            
            # Configure get_amm_pool_rate_json FFI type bindings
            lib.get_amm_pool_rate_json.argtypes = [
                ctypes.c_double, ctypes.c_double, ctypes.c_double,
                ctypes.c_double, ctypes.c_double, ctypes.c_double
            ]
            lib.get_amm_pool_rate_json.restype = ctypes.c_char_p

            res_ptr = lib.get_amm_pool_rate_json(
                req.total_borrowed, req.total_liquidity, req.base_rate,
                req.slope1, req.slope2, req.kink
            )
            res_str = ctypes.string_at(res_ptr).decode("utf-8")
            result = json.loads(res_str)
            result["execution_engine"] = "Rust Quantitative AMM Engine"
            return result
        except Exception as exc:
            logger.warning(f"rust_amm_ffi_failed: {str(exc)}, falling back to python")
            pass

    return calculate_python_amm_rate(req)

@router.get("/vaults")
async def get_rwa_vaults():
    """Return active institutional tokenized RWA collateral vaults."""
    for vault in MOCK_VAULTS:
        recalculate_health_factor(vault)
    return {"success": True, "vaults": MOCK_VAULTS}

@router.post("/oracle/price-drop")
async def trigger_oracle_price_drop(asset_id: int, new_price: float):
    """
    Simulate Chainlink price drop feed for specific assets
    to trigger undercollateralization and test liquidations.
    """
    found = False
    for vault in MOCK_VAULTS:
        if vault["asset_id"] == asset_id:
            vault["unit_price_usd"] = new_price
            recalculate_health_factor(vault)
            found = True
            break
            
    if not found:
        raise HTTPException(status_code=404, detail="Vault asset ID not found.")
        
    return {"success": True, "vaults": MOCK_VAULTS}

@router.post("/vault/liquidate")
async def liquidate_rwa_vault(req: LiquidationRequest):
    """
    Execute institutional partial liquidation on undercollateralized vaults.
    Liquidators settle up to 50% of debt in exchange for seized RWA collateral at a 10% discount.
    """
    target_vault = None
    for vault in MOCK_VAULTS:
        if vault["borrower"] == req.borrower and vault["asset_id"] == req.asset_id:
            target_vault = vault
            break

    if not target_vault:
        raise HTTPException(status_code=404, detail="Target vault record not found.")

    # Recalculate health
    recalculate_health_factor(target_vault)
    if target_vault["health_factor_bps"] >= 10000:
        raise HTTPException(status_code=400, detail="Vault is currently healthy. Liquidation rejected.")

    max_repay = target_vault["borrowed_amount_usd"] / 2
    if req.repay_amount > max_repay:
        raise HTTPException(
            status_code=400,
            detail=f"Repayment exceeds 50% max liquidation limit of {max_repay} USD."
        )

    # Collateral seizure with 10% discount bonus
    # Shares Value Seized = Repay Amount * 1.10
    value_seized = req.repay_amount * 1.10
    shares_seized = int(value_seized / target_vault["unit_price_usd"])

    if target_vault["collateral_shares"] < shares_seized:
        raise HTTPException(status_code=400, detail="Insufficient collateral left inside vault to seize.")

    # Deduct collateral and debt
    target_vault["collateral_shares"] -= shares_seized
    target_vault["borrowed_amount_usd"] -= req.repay_amount
    recalculate_health_factor(target_vault)

    logger.info(
        "vault_partial_liquidation_complete",
        borrower=req.borrower,
        shares_seized=shares_seized,
        repay_amount=req.repay_amount
    )

    return {
        "success": True,
        "shares_seized": shares_seized,
        "remaining_borrowed_usd": target_vault["borrowed_amount_usd"],
        "remaining_collateral_shares": target_vault["collateral_shares"],
        "new_health_factor_bps": target_vault["health_factor_bps"]
    }
