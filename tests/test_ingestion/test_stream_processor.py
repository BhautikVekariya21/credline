"""
FinGuard 2026 — Stream Processor Tests.
"""

import pytest
from datetime import datetime, timedelta

from ingestion.stream_processor import RealTimeFeatureComputer


class TestStreamProcessor:

    @pytest.fixture
    def processor(self):
        return RealTimeFeatureComputer(window_minutes=60)

    def test_single_transaction(self, processor):
        features = processor.process({
            "user_id": "USR-001",
            "amount": 100.0,
            "timestamp": datetime.utcnow(),
            "device_id": "DEV-001",
            "ip_address": "IP-001",
            "latitude": 40.7128,
            "longitude": -74.0060,
        })
        assert features["tx_count_1h"] == 1.0
        assert features["amount_mean_1h"] == 100.0

    def test_velocity_detection(self, processor):
        now = datetime.utcnow()
        for i in range(10):
            processor.process({
                "user_id": "USR-001",
                "amount": 50.0,
                "timestamp": now + timedelta(seconds=i * 10),
                "device_id": "DEV-001",
                "ip_address": "IP-001",
                "latitude": 40.7128,
                "longitude": -74.0060,
            })
        features = processor.process({
            "user_id": "USR-001",
            "amount": 50.0,
            "timestamp": now + timedelta(seconds=100),
            "device_id": "DEV-001",
            "ip_address": "IP-001",
            "latitude": 40.7128,
            "longitude": -74.0060,
        })
        assert features["tx_count_1h"] == 11.0
        assert features["min_time_between_tx_sec"] == 10.0

    def test_device_sharing(self, processor):
        now = datetime.utcnow()
        for uid in ["USR-001", "USR-002", "USR-003"]:
            processor.process({
                "user_id": uid,
                "amount": 50.0,
                "timestamp": now,
                "device_id": "SHARED-DEV",
                "ip_address": "IP-001",
                "latitude": 0, "longitude": 0,
            })
        features = processor.process({
            "user_id": "USR-004",
            "amount": 50.0,
            "timestamp": now,
            "device_id": "SHARED-DEV",
            "ip_address": "IP-001",
            "latitude": 0, "longitude": 0,
        })
        assert features["device_user_count"] == 4.0
