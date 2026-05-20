"""
FinGuard 2026 — Thin-File XGBoost Credit Scorer.

XGBoost pipeline for alternative credit scoring of unbanked populations
using telco metadata, utility bill consistency, and e-commerce behavior.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler

try:
    import xgboost as xgb
except ImportError:
    xgb = None  # type: ignore


class ThinFileScorer:
    """
    XGBoost pipeline for "thin-file" alternative credit scoring.

    Features consumed:
    - Telco: top-up regularity, SIM tenure, data consistency, call patterns
    - Utility: on-time rate, payment consistency index, missed payments
    - E-commerce: return rate, order frequency, average basket value

    Output: credit_score [300, 850] with confidence interval.
    """

    FEATURE_NAMES = [
        # Telco features
        "sim_tenure_months", "avg_monthly_topup", "topup_regularity_score",
        "avg_daily_calls_min", "avg_daily_data_mb", "data_usage_consistency",
        "sms_per_day", "unique_contacts_30d", "international_calls_pct",
        "topup_count_6m",
        # Utility features
        "on_time_rate", "payment_consistency_index", "avg_monthly_amount",
        "payment_day_consistency", "missed_payments_12m", "late_payments_12m",
        "account_tenure_months",
        # E-commerce features
        "ecommerce_return_rate", "order_frequency_30d", "avg_basket_value",
        "account_age_days",
    ]

    CREDIT_MIN = 300.0
    CREDIT_MAX = 850.0

    def __init__(self, n_estimators: int = 500, max_depth: int = 6,
                 learning_rate: float = 0.05, seed: int = 42):
        if xgb is None:
            raise ImportError("xgboost is required: pip install xgboost")

        self.model = xgb.XGBRegressor(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            objective="reg:squarederror",
            eval_metric="rmse",
            tree_method="hist",
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=1.0,
            random_state=seed,
            n_jobs=-1,
        )

        self.scaler = StandardScaler()
        self.is_fitted = False
        self.feature_importance_: dict[str, float] = {}

    def prepare_features(self, telco_data: dict[str, Any] | None = None,
                        utility_data: dict[str, Any] | None = None,
                        ecommerce_data: dict[str, Any] | None = None) -> np.ndarray:
        """Extract and align features from multiple data sources."""
        features = {}

        if telco_data:
            for key in self.FEATURE_NAMES:
                if key in telco_data:
                    features[key] = telco_data[key]

        if utility_data:
            for key in self.FEATURE_NAMES:
                if key in utility_data:
                    features[key] = utility_data[key]

        if ecommerce_data:
            for key in self.FEATURE_NAMES:
                if key in ecommerce_data:
                    features[key] = ecommerce_data[key]

        # Fill missing with 0
        return np.array([features.get(name, 0.0) for name in self.FEATURE_NAMES])

    def fit(self, X: np.ndarray, y: np.ndarray,
            eval_set: tuple[np.ndarray, np.ndarray] | None = None) -> ThinFileScorer:
        """Train the XGBoost scorer."""
        X_scaled = self.scaler.fit_transform(X)
        y_clipped = np.clip(y, self.CREDIT_MIN, self.CREDIT_MAX)

        fit_params: dict[str, Any] = {}
        if eval_set is not None:
            X_val_scaled = self.scaler.transform(eval_set[0])
            fit_params["eval_set"] = [(X_val_scaled, eval_set[1])]
            fit_params["verbose"] = 50

        self.model.fit(X_scaled, y_clipped, **fit_params)
        self.is_fitted = True

        # Store feature importance
        importance = self.model.feature_importances_
        self.feature_importance_ = {
            name: float(imp) for name, imp in zip(self.FEATURE_NAMES, importance)
        }

        return self

    def predict(self, X: np.ndarray) -> dict[str, np.ndarray]:
        """Predict credit scores with confidence intervals."""
        if not self.is_fitted:
            raise RuntimeError("Model not fitted. Call fit() first.")

        X_scaled = self.scaler.transform(X)
        predictions = self.model.predict(X_scaled)
        scores = np.clip(predictions, self.CREDIT_MIN, self.CREDIT_MAX)

        # Bootstrap confidence intervals
        n_trees = self.model.n_estimators
        tree_preds = np.array([
            self.model.predict(X_scaled, iteration_range=(0, max(1, int(n_trees * p))))
            for p in [0.25, 0.5, 0.75, 1.0]
        ])
        std = np.std(tree_preds, axis=0)
        ci_lower = np.clip(scores - 1.96 * std, self.CREDIT_MIN, self.CREDIT_MAX)
        ci_upper = np.clip(scores + 1.96 * std, self.CREDIT_MIN, self.CREDIT_MAX)

        return {
            "credit_score": scores,
            "confidence_lower": ci_lower,
            "confidence_upper": ci_upper,
            "confidence_width": ci_upper - ci_lower,
        }

    def predict_single(self, telco_data: dict | None = None,
                       utility_data: dict | None = None,
                       ecommerce_data: dict | None = None) -> dict[str, float]:
        """Predict credit score for a single user from raw data sources."""
        features = self.prepare_features(telco_data, utility_data, ecommerce_data)
        result = self.predict(features.reshape(1, -1))
        return {k: float(v[0]) for k, v in result.items()}

    def get_top_features(self, n: int = 5) -> list[tuple[str, float]]:
        """Return top-N most important features."""
        sorted_feats = sorted(self.feature_importance_.items(), key=lambda x: x[1], reverse=True)
        return sorted_feats[:n]

    def save(self, path: str) -> None:
        """Save model and scaler."""
        p = Path(path)
        p.mkdir(parents=True, exist_ok=True)
        self.model.save_model(str(p / "xgb_model.json"))
        np.save(str(p / "scaler_mean.npy"), self.scaler.mean_)
        np.save(str(p / "scaler_scale.npy"), self.scaler.scale_)
        with open(p / "feature_importance.json", "w") as f:
            json.dump(self.feature_importance_, f, indent=2)

    def load(self, path: str) -> ThinFileScorer:
        """Load model and scaler."""
        p = Path(path)
        self.model.load_model(str(p / "xgb_model.json"))
        self.scaler.mean_ = np.load(str(p / "scaler_mean.npy"))
        self.scaler.scale_ = np.load(str(p / "scaler_scale.npy"))
        self.scaler.n_features_in_ = len(self.FEATURE_NAMES)
        with open(p / "feature_importance.json") as f:
            self.feature_importance_ = json.load(f)
        self.is_fitted = True
        return self
