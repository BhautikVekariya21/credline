"""
FinGuard 2026 — Credit Scoring Router.

POST /api/v1/predict/credit — Alternative credit scoring for unbanked populations.
"""

from __future__ import annotations

import time
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from api.dependencies import get_model_registry, run_inference
from api.middleware.auth import verify_api_key
from config.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1/predict", tags=["Credit Scoring"])


class CreditRequest(BaseModel):
    """Credit scoring request payload."""
    user_id: str

    # Telco data (optional)
    sim_tenure_months: Optional[float] = None
    avg_monthly_topup: Optional[float] = None
    topup_regularity_score: Optional[float] = None
    avg_daily_calls_min: Optional[float] = None
    avg_daily_data_mb: Optional[float] = None
    data_usage_consistency: Optional[float] = None
    sms_per_day: Optional[float] = None
    unique_contacts_30d: Optional[int] = None
    international_calls_pct: Optional[float] = None
    topup_count_6m: Optional[int] = None

    # Utility data (optional)
    on_time_rate: Optional[float] = None
    payment_consistency_index: Optional[float] = None
    avg_monthly_amount: Optional[float] = None
    payment_day_consistency: Optional[float] = None
    missed_payments_12m: Optional[int] = None
    late_payments_12m: Optional[int] = None
    account_tenure_months: Optional[int] = None

    # E-commerce data (optional)
    ecommerce_return_rate: Optional[float] = None
    order_frequency_30d: Optional[int] = None
    avg_basket_value: Optional[float] = None
    account_age_days: Optional[int] = None


class CreditResponse(BaseModel):
    """Credit scoring response."""
    decision_id: str
    credit_score: float = Field(..., ge=300, le=850)
    confidence_lower: float
    confidence_upper: float
    scoring_method: str
    reason_codes: list[str]
    latency_ms: float


@router.post("/credit", response_model=CreditResponse)
async def predict_credit(
    request: CreditRequest,
    _api_key: str = Depends(verify_api_key),
) -> CreditResponse:
    """
    Alternative credit scoring using telco, utility, and e-commerce data.
    """
    start = time.perf_counter()
    decision_id = f"CRD-{uuid.uuid4().hex[:12]}"
    registry = get_model_registry()

    def _run_scoring() -> dict[str, Any]:
        import numpy as np
        from privacy.explainability.shap_explainer import ReasonCodeGenerator
        from privacy.explainability.reason_codes import generate_reason_text

        # Prepare features dict
        telco_data = {k: v for k, v in request.model_dump().items()
                      if v is not None and k != "user_id"}

        scorer = registry.credit_scorer
        features = scorer.prepare_features(
            telco_data=telco_data,
            utility_data=telco_data,
            ecommerce_data=telco_data,
        )

        if scorer.is_fitted:
            result = scorer.predict(features.reshape(1, -1))
            credit_score = float(result["credit_score"][0])
            ci_lower = float(result["confidence_lower"][0])
            ci_upper = float(result["confidence_upper"][0])

            # Generate reason codes from feature importance
            top_features = scorer.get_top_features(n=5)
            reasons = []
            for feat_name, importance in top_features:
                feat_idx = scorer.FEATURE_NAMES.index(feat_name)
                feat_val = features[feat_idx]
                direction = 1.0 if feat_val > 0.5 else -1.0
                reason = generate_reason_text(feat_name, direction, feat_val)
                reasons.append(reason)
        else:
            # Fallback: rule-based scoring
            credit_score = 550.0
            ci_lower = 450.0
            ci_upper = 650.0
            reasons = ["Model not yet trained — using baseline score"]

            # Simple rule adjustments
            if request.on_time_rate and request.on_time_rate > 0.8:
                credit_score += 50
                reasons.append(f"Positive: {request.on_time_rate:.0%} on-time payment rate")
            if request.sim_tenure_months and request.sim_tenure_months > 12:
                credit_score += 30
                reasons.append(f"Positive: {request.sim_tenure_months:.0f} months SIM tenure")
            if request.missed_payments_12m and request.missed_payments_12m > 2:
                credit_score -= 40
                reasons.append(f"Negative: {request.missed_payments_12m} missed payments")

            credit_score = max(300, min(850, credit_score))
            ci_lower = max(300, credit_score - 100)
            ci_upper = min(850, credit_score + 100)

        return {
            "credit_score": credit_score,
            "ci_lower": ci_lower,
            "ci_upper": ci_upper,
            "reasons": reasons[:5],
        }

    result = await run_inference(_run_scoring)
    elapsed_ms = (time.perf_counter() - start) * 1000

    scoring_method = "xgboost" if registry.credit_scorer.is_fitted else "rule_based"

    logger.info("credit_prediction", decision_id=decision_id,
                credit_score=result["credit_score"],
                method=scoring_method, latency_ms=round(elapsed_ms, 1))

    return CreditResponse(
        decision_id=decision_id,
        credit_score=round(result["credit_score"], 1),
        confidence_lower=round(result["ci_lower"], 1),
        confidence_upper=round(result["ci_upper"], 1),
        scoring_method=scoring_method,
        reason_codes=result["reasons"],
        latency_ms=round(elapsed_ms, 1),
    )
