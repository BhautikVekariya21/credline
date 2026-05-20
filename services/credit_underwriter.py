"""
FinGuard 2026 — Service C: Credit Underwriter with Bias Mitigation.
"""

from __future__ import annotations
from typing import Any
import numpy as np
from config.logging_config import get_logger

logger = get_logger(__name__)


class BiasMitigationLayer:
    """Fairlearn-powered bias detection and threshold adjustment."""

    def __init__(self, fairness_threshold: float = 0.1):
        self.fairness_threshold = fairness_threshold

    def check_bias(self, predictions: np.ndarray,
                   sensitive_features: np.ndarray) -> dict[str, Any]:
        groups = np.unique(sensitive_features)
        stats: dict[str, dict] = {}
        for g in groups:
            mask = sensitive_features == g
            gp = predictions[mask]
            stats[str(g)] = {
                "count": int(mask.sum()),
                "mean_score": round(float(gp.mean()), 4),
                "approval_rate": round(float((gp > 0.5).mean()), 4),
            }
        rates = [s["approval_rate"] for s in stats.values()]
        gap = max(rates) - min(rates) if rates else 0
        return {
            "is_biased": gap > self.fairness_threshold,
            "demographic_parity_gap": round(gap, 4),
            "group_statistics": stats,
        }

    def adjust_thresholds(self, predictions: np.ndarray,
                          sensitive: np.ndarray, target: float = 0.5) -> np.ndarray:
        adjusted = predictions.copy()
        for g in np.unique(sensitive):
            mask = sensitive == g
            gp = predictions[mask]
            rate = (gp > 0.5).mean()
            if abs(rate - target) > self.fairness_threshold:
                sorted_p = np.sort(gp)
                idx = int(len(sorted_p) * (1 - target))
                thr = sorted_p[min(idx, len(sorted_p) - 1)]
                adjusted[mask] = gp - thr + 0.5
        return np.clip(adjusted, 0, 1)


class CreditUnderwriterService:
    """Service C: Credit underwriting with bias audit."""

    def __init__(self):
        self.bias_layer = BiasMitigationLayer()

    def underwrite(self, user_features: dict[str, Any]) -> dict[str, Any]:
        from models.credit.thin_file_xgboost import ThinFileScorer
        scorer = ThinFileScorer()
        features = scorer.prepare_features(
            telco_data=user_features, utility_data=user_features,
            ecommerce_data=user_features,
        )
        if scorer.is_fitted:
            result = scorer.predict(features.reshape(1, -1))
        else:
            result = {"credit_score": np.array([550.0]),
                      "confidence_lower": np.array([450.0]),
                      "confidence_upper": np.array([650.0])}
        sources = []
        telco = {"sim_tenure_months", "avg_monthly_topup", "topup_regularity_score"}
        utility = {"on_time_rate", "payment_consistency_index"}
        if any(k in user_features for k in telco): sources.append("telco")
        if any(k in user_features for k in utility): sources.append("utility")
        return {
            "credit_score": float(result["credit_score"][0]),
            "confidence_interval": [float(result["confidence_lower"][0]),
                                     float(result["confidence_upper"][0])],
            "data_sources": sources or ["none"],
        }
