"""
FinGuard 2026 — Drift Detector Tests.
"""

import pytest
import numpy as np

from monitoring.drift_detector import DriftDetector


class TestDriftDetector:

    @pytest.fixture
    def detector(self):
        np.random.seed(42)
        ref = {
            "amount": np.random.lognormal(3.5, 1.0, 5000),
            "velocity": np.random.normal(5, 2, 5000),
        }
        return DriftDetector(ref, threshold=0.1, alpha=0.01, window_size=1000)

    def test_no_drift_same_distribution(self, detector):
        np.random.seed(123)
        for _ in range(500):
            detector.add_observations({
                "amount": float(np.random.lognormal(3.5, 1.0)),
                "velocity": float(np.random.normal(5, 2)),
            })
        alerts = detector.check_drift()
        assert len(alerts) == 0

    def test_drift_detected(self, detector):
        # Inject shifted distribution
        for _ in range(500):
            detector.add_observations({
                "amount": float(np.random.lognormal(6.0, 2.0)),  # much higher
                "velocity": float(np.random.normal(20, 5)),  # much higher
            })
        alerts = detector.check_drift()
        assert len(alerts) > 0
        assert any(a["feature"] == "amount" for a in alerts)

    def test_report(self, detector):
        for _ in range(200):
            detector.add_observations({
                "amount": float(np.random.lognormal(3.5, 1.0)),
                "velocity": float(np.random.normal(5, 2)),
            })
        report = detector.get_report()
        assert "features" in report
        assert "amount" in report["features"]
