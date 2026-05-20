"""
FinGuard 2026 — Drift Detection via Kolmogorov-Smirnov Test.

Monitors input feature distributions and prediction score distributions
to detect when fraud patterns evolve beyond the training set.
"""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Any

import numpy as np
from scipy import stats

from config.logging_config import get_logger

logger = get_logger(__name__)


class DriftDetector:
    """
    Monitors for distribution drift using the two-sample Kolmogorov-Smirnov test.

    Compares a sliding window of recent data against the reference (training)
    distribution. Alerts when KS-statistic exceeds threshold with p < alpha.

    Monitors:
    - Input feature distributions (amount, velocity, etc.)
    - Prediction score distributions (fraud score, credit score)
    - Concept drift in fraud patterns
    """

    def __init__(self, reference_data: dict[str, np.ndarray],
                 threshold: float = 0.1, alpha: float = 0.01,
                 window_size: int = 5000):
        """
        Args:
            reference_data: Dict of feature_name → reference (training) values.
            threshold: KS-statistic threshold for alert.
            alpha: Significance level (p-value threshold).
            window_size: Size of the sliding window for recent data.
        """
        self.reference_data = reference_data
        self.threshold = threshold
        self.alpha = alpha
        self.window_size = window_size

        # Sliding windows for recent data
        self._windows: dict[str, list[float]] = defaultdict(list)
        self._last_check: dict[str, float] = {}
        self._alerts: list[dict[str, Any]] = []

    def add_observation(self, feature_name: str, value: float) -> None:
        """Add a single observation to the sliding window."""
        window = self._windows[feature_name]
        window.append(value)

        # Trim to window size
        if len(window) > self.window_size:
            self._windows[feature_name] = window[-self.window_size:]

    def add_observations(self, observations: dict[str, float]) -> None:
        """Add multiple feature observations at once."""
        for name, value in observations.items():
            self.add_observation(name, value)

    def check_drift(self, feature_name: str | None = None
                    ) -> list[dict[str, Any]]:
        """
        Run KS test for one or all features.

        Returns:
            List of drift alerts (empty if no drift detected).
        """
        features_to_check = (
            [feature_name] if feature_name
            else list(self.reference_data.keys())
        )

        alerts = []

        for feat in features_to_check:
            if feat not in self.reference_data:
                continue

            window = self._windows.get(feat, [])
            if len(window) < 100:  # Need minimum samples
                continue

            ref = self.reference_data[feat]
            recent = np.array(window)

            # Two-sample KS test
            ks_stat, p_value = stats.ks_2samp(ref, recent)

            result = {
                "feature": feat,
                "ks_statistic": round(float(ks_stat), 6),
                "p_value": round(float(p_value), 8),
                "threshold": self.threshold,
                "alpha": self.alpha,
                "window_size": len(window),
                "reference_size": len(ref),
                "drift_detected": ks_stat > self.threshold and p_value < self.alpha,
                "timestamp": time.time(),
            }

            if result["drift_detected"]:
                result["severity"] = self._classify_severity(ks_stat)
                alerts.append(result)
                self._alerts.append(result)

                logger.warning(
                    "drift_detected",
                    feature=feat,
                    ks_statistic=result["ks_statistic"],
                    p_value=result["p_value"],
                    severity=result["severity"],
                )

        return alerts

    def check_all(self) -> dict[str, Any]:
        """Run drift detection on all monitored features."""
        alerts = self.check_drift()

        return {
            "total_features_monitored": len(self.reference_data),
            "features_with_drift": len(alerts),
            "alerts": alerts,
            "status": "drift_detected" if alerts else "stable",
        }

    def get_report(self) -> dict[str, Any]:
        """Generate a comprehensive drift report."""
        report: dict[str, Any] = {
            "features": {},
            "total_alerts": len(self._alerts),
        }

        for feat in self.reference_data:
            window = self._windows.get(feat, [])
            if len(window) < 10:
                continue

            ref = self.reference_data[feat]
            recent = np.array(window)
            ks_stat, p_value = stats.ks_2samp(ref, recent)

            report["features"][feat] = {
                "ks_statistic": round(float(ks_stat), 6),
                "p_value": round(float(p_value), 8),
                "drift_detected": ks_stat > self.threshold and p_value < self.alpha,
                "ref_mean": round(float(ref.mean()), 4),
                "ref_std": round(float(ref.std()), 4),
                "recent_mean": round(float(recent.mean()), 4),
                "recent_std": round(float(recent.std()), 4),
                "window_size": len(window),
            }

        return report

    @staticmethod
    def _classify_severity(ks_stat: float) -> str:
        """Classify drift severity based on KS statistic magnitude."""
        if ks_stat > 0.5:
            return "critical"
        elif ks_stat > 0.3:
            return "high"
        elif ks_stat > 0.15:
            return "medium"
        return "low"
