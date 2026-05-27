"""
Credit Line Fintech Solution — Phase 14: Executive Strategy API Router.

Exposes endpoints for PyTorch-based liquidity forecasting, contract RAG parsing,
and agentic negotiation approvals to the frontend cockpit.
"""

from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from services.forecasting.liquidity_oracle import LiquidityOracle, generate_sample_history
from services.contracts.contract_rag_parser import ContractRAGParser, MOCK_MSA_CONTRACT
from services.agentic_ops.negotiation_agent import NegotiationAgent

router = APIRouter(prefix="/api/v1/executive", tags=["Executive CFO (Phase 14)"])

# ─── Singletons & Initial Ingestion ──────────────────────────────────────────

_oracle = LiquidityOracle()
# Pre-train oracle LSTM on mock ledger sequence so it works instantly
_oracle.train_on_history(generate_sample_history(60), epochs=5)

_rag_parser = ContractRAGParser()
# Pre-ingest mock AWS contract so the dashboard has active contract audit data
_rag_parser.ingest_contract("aws_cloud_msa_2026.txt", MOCK_MSA_CONTRACT)

_agent = NegotiationAgent()


# ─── Request/Response Models ──────────────────────────────────────────────────

class ForecastRequest(BaseModel):
    sales_growth: float = Field(0.0, description="Growth rate factor (e.g. 0.05 for +5%)")
    churn_rate: float = Field(0.0, description="Customer churn factor (e.g. 0.05 for +5%)")
    macro_interest_rate: float = Field(0.0, description="Interest rate shifts in decimal (e.g. 0.01 for +100bps)")
    reserve_threshold: float = Field(1200000.0, description="Emergency cash reserve floor in INR")

class ContractUploadRequest(BaseModel):
    filename: str = "custom_contract.txt"
    content: str

class ActionDecisionRequest(BaseModel):
    action_id: str
    decision: str  # "APPROVE", "REJECT", "UPDATE"
    custom_body: Optional[str] = None


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/forecast")
async def get_forecast(req: ForecastRequest):
    """
    Run 90-day PyTorch cash flow prediction and Monte Carlo simulation.
    Triggers agentic vendor term negotiations if reserves dip below threshold.
    """
    # Sample background macro-economic daily forecasts
    sofr_rates = [5.3 + math.sin(i / 10.0) * 0.2 for i in range(90)]
    inflation_indices = [3.2 + math.cos(i / 15.0) * 0.1 for i in range(90)]

    recent_history = generate_sample_history(30)
    
    shocks = {
        "sales_growth": req.sales_growth,
        "churn_rate": req.churn_rate,
        "macro_interest_rate": req.macro_interest_rate
    }

    # Execute PyTorch LSTM + MC
    result = _oracle.forecast_90_days(recent_history, sofr_rates, inflation_indices, shocks=shocks)
    
    # Run Agent check on predicted trajectories
    trigger_report = _agent.evaluate_liquidity_and_trigger(result, reserve_threshold=req.reserve_threshold)

    return {
        "days": result["days"],
        "base_case": result["base_case"],
        "worst_case": result["worst_case"],
        "best_case": result["best_case"],
        "std_dev": result["std_dev"],
        "trigger_report": trigger_report
    }


@router.post("/contracts/upload")
async def audit_contract(req: ContractUploadRequest):
    """
    Ingest vendor contract (leases, MSAs), perform semantic TF-IDF query extraction,
    and cross-reference actual ledger transactions for term compliance check.
    """
    try:
        # Ingest text contract
        _rag_parser.ingest_contract(req.filename, req.content)
        
        # Search index for payment conditions
        terms_extraction = _rag_parser.extract_term("payment terms grace period billing Net")
        days = terms_extraction["days"]

        # Generate sample ledger entries to test against
        # We will inject some late payments to simulate violations
        import random
        from datetime import datetime, timedelta
        
        mock_ledger = []
        base_time = datetime.now() - timedelta(days=90)
        
        # Generate 5 billing cycles
        for i in range(5):
            inv_date = base_time + timedelta(days=i * 30)
            inv_ref = f"INV-2026-00{i+1}"
            
            # Billed invoice (DEBIT)
            mock_ledger.append({
                "transaction_id": f"TX-{random.randint(100000, 999999)}",
                "vendor": "AWS Cloud Services",
                "description": f"AWS Monthly Compute Cloud bill {inv_ref}",
                "amount": 2800000.0 + random.uniform(-100000.0, 100000.0),
                "transaction_type": "DEBIT",
                "timestamp": inv_date.isoformat(),
                "reference": inv_ref
            })

            # Payment clearance (CREDIT)
            # Cycle 2 and 4 will be late payments (taking 45 and 40 days to clear)
            payment_lag = days
            if i == 1:
                payment_lag = days + 15  # Late payment!
            elif i == 3:
                payment_lag = days + 10  # Late payment!

            pay_date = inv_date + timedelta(days=payment_lag)
            mock_ledger.append({
                "transaction_id": f"TX-{random.randint(100000, 999999)}",
                "vendor": "AWS Cloud Services",
                "description": f"Settlement payment for invoice {inv_ref}",
                "amount": 2800000.0 + random.uniform(-100000.0, 100000.0),
                "transaction_type": "CREDIT",
                "timestamp": pay_date.isoformat(),
                "reference": inv_ref
            })

        # Run transaction audits
        violations = _rag_parser.audit_ledger_transactions(mock_ledger, "AWS Cloud", payment_term_days=days)

        return {
            "filename": req.filename,
            "detected_terms": terms_extraction["detected_payment_terms"],
            "clause": terms_extraction["clause"],
            "match_confidence": terms_extraction["match_confidence"],
            "extracted_days": days,
            "violations": violations,
            "violations_count": len(violations)
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/negotiations/inbox")
async def get_negotiation_inbox():
    """Retrieve queued strategic tasks inside the CFO Agent Strategy Inbox."""
    return {
        "count": len(_agent.inbox_items),
        "items": _agent.inbox_items
    }


@router.post("/negotiations/action")
async def approve_negotiation_action(req: ActionDecisionRequest):
    """Execute approval, rejection, or updates for queued strategist actions."""
    result = _agent.process_inbox_action(req.action_id, req.decision, req.custom_body)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return result


# Helper imports for math equations in forecasting
import math
