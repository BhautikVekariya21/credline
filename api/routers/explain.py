"""
FinGuard 2026 — Explanation Router.

POST /api/v1/explain/{decision_id} — SHAP-based reason code generation.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from api.middleware.auth import verify_api_key

router = APIRouter(prefix="/api/v1", tags=["Explainability"])


class ExplainResponse(BaseModel):
    """Explanation response with SHAP-derived reason codes."""
    decision_id: str
    reason_codes: list[str]
    top_positive_factors: list[dict]
    top_negative_factors: list[dict]
    feature_importances: dict[str, float]


@router.post("/explain/{decision_id}", response_model=ExplainResponse)
async def explain_decision(
    decision_id: str,
    _api_key: str = Depends(verify_api_key),
) -> ExplainResponse:
    """
    Generate human-readable explanation for a previous decision.

    In production, this would look up the decision by ID from
    an audit database, retrieve the input features, and run SHAP.
    """
    # Placeholder: in production, retrieve from audit log
    return ExplainResponse(
        decision_id=decision_id,
        reason_codes=[
            "Strong 12-month utility payment consistency (score: 0.92)",
            "Irregular prepaid top-up pattern over 6 months (score: 0.34)",
            "Short mobile account history (8 months)",
        ],
        top_positive_factors=[
            {"feature": "on_time_rate", "shap_value": 0.15,
             "reason": "Strong utility payment punctuality (92% on-time)"},
            {"feature": "data_usage_consistency", "shap_value": 0.08,
             "reason": "Consistent mobile data usage pattern (consistency: 0.87)"},
        ],
        top_negative_factors=[
            {"feature": "topup_regularity_score", "shap_value": -0.12,
             "reason": "Irregular prepaid top-up pattern over 6 months (score: 0.34)"},
            {"feature": "sim_tenure_months", "shap_value": -0.07,
             "reason": "Short mobile account history (8 months)"},
        ],
        feature_importances={
            "on_time_rate": 0.15,
            "topup_regularity_score": -0.12,
            "data_usage_consistency": 0.08,
            "sim_tenure_months": -0.07,
            "payment_consistency_index": 0.05,
        },
    )
