"""
FinGuard 2026 — SHAP Explainer for Reason Code Generation.

Uses SHAP (SHapley Additive exPlanations) to generate human-readable
explanations for every fraud decision and credit denial. Required for
regulatory compliance (ECOA adverse action notices).
"""

from __future__ import annotations

from typing import Any

import numpy as np

from config.logging_config import get_logger
from privacy.explainability.reason_codes import generate_reason_text

logger = get_logger(__name__)


class ReasonCodeGenerator:
    """
    Generates human-readable denial/approval reasons using SHAP.

    For every prediction, identifies the top contributing features
    and maps them to templated explanations.
    """

    def __init__(self, model: Any, feature_names: list[str],
                 background_data: np.ndarray | None = None,
                 top_k: int = 5):
        """
        Args:
            model: Trained model with a predict method.
            feature_names: List of feature names matching model input.
            background_data: Background samples for SHAP KernelExplainer.
            top_k: Number of top reasons to return.
        """
        self.model = model
        self.feature_names = feature_names
        self.top_k = top_k
        self._explainer = None

        if background_data is not None:
            self._init_explainer(background_data)

    def _init_explainer(self, background_data: np.ndarray) -> None:
        """Initialize SHAP KernelExplainer with background data."""
        try:
            import shap

            # Use a subsample for efficiency
            if len(background_data) > 100:
                idx = np.random.choice(len(background_data), 100, replace=False)
                background_data = background_data[idx]

            self._explainer = shap.KernelExplainer(
                self._predict_fn, background_data
            )
            logger.info("shap_explainer_initialized",
                       background_samples=len(background_data))
        except ImportError:
            logger.warning("shap_not_installed",
                         msg="SHAP explanations will use fallback mode")

    def _predict_fn(self, X: np.ndarray) -> np.ndarray:
        """Wrapper for SHAP — handles different model types."""
        if hasattr(self.model, "predict"):
            return self.model.predict(X)
        elif hasattr(self.model, "__call__"):
            import torch
            with torch.no_grad():
                tensor = torch.tensor(X, dtype=torch.float32)
                output = self.model(tensor)
                if isinstance(output, dict):
                    return output.get("credit_score",
                                     output.get("fraud_score")).numpy()
                return output.numpy()
        raise ValueError("Model must have predict() or be callable")

    def explain(self, features: np.ndarray,
                feature_values: dict[str, float] | None = None
                ) -> dict[str, Any]:
        """
        Generate explanation for a single prediction.

        Args:
            features: Input feature array [1, n_features] or [n_features].
            feature_values: Optional dict of feature name → actual value
                           (for readable reason texts).

        Returns:
            Dict with:
                - reason_codes: List of human-readable reason strings
                - feature_importances: Dict of feature → SHAP value
                - top_positive: Top features pushing toward approval
                - top_negative: Top features pushing toward denial
                - shap_values: Raw SHAP values
        """
        if features.ndim == 1:
            features = features.reshape(1, -1)

        # Compute SHAP values
        if self._explainer is not None:
            try:
                shap_values = self._explainer.shap_values(features)[0]
            except Exception as e:
                logger.warning("shap_computation_failed", error=str(e))
                shap_values = self._fallback_importance(features)
        else:
            shap_values = self._fallback_importance(features)

        # Build feature importance mapping
        importances = {
            name: float(sv)
            for name, sv in zip(self.feature_names, shap_values)
        }

        # Sort by absolute importance
        sorted_features = sorted(
            importances.items(), key=lambda x: abs(x[1]), reverse=True
        )

        # Get actual feature values
        if feature_values is None:
            feature_values = {
                name: float(features[0, i])
                for i, name in enumerate(self.feature_names)
            }

        # Generate reason codes
        reason_codes = []
        top_positive = []
        top_negative = []

        for feat_name, shap_val in sorted_features[: self.top_k * 2]:
            feat_val = feature_values.get(feat_name, 0.0)
            reason = generate_reason_text(feat_name, shap_val, feat_val)

            if shap_val > 0:
                top_positive.append({"feature": feat_name, "shap_value": shap_val,
                                     "reason": reason})
            else:
                top_negative.append({"feature": feat_name, "shap_value": shap_val,
                                     "reason": reason})

        # Primary reason codes (top negative for denials, top positive for approvals)
        for item in top_negative[: self.top_k]:
            reason_codes.append(item["reason"])
        for item in top_positive[: max(0, self.top_k - len(top_negative))]:
            reason_codes.append(item["reason"])

        return {
            "reason_codes": reason_codes,
            "feature_importances": importances,
            "top_positive": top_positive[: self.top_k],
            "top_negative": top_negative[: self.top_k],
            "shap_values": {name: float(sv) for name, sv in zip(self.feature_names, shap_values)},
        }

    def _fallback_importance(self, features: np.ndarray) -> np.ndarray:
        """Fallback: use feature magnitude as proxy for importance."""
        return features[0] / (np.abs(features[0]).sum() + 1e-8)

    def explain_batch(self, features: np.ndarray,
                      ) -> list[dict[str, Any]]:
        """Explain a batch of predictions."""
        return [
            self.explain(features[i: i + 1])
            for i in range(len(features))
        ]
