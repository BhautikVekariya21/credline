"""
FinGuard 2026 — API Endpoint Tests.
"""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create test client with mocked model registry."""
    from api.main import app
    from api.dependencies import get_model_registry

    # Pre-load models for testing
    registry = get_model_registry()
    if not registry.is_loaded:
        registry.load_all()

    return TestClient(app)


class TestHealthEndpoints:

    def test_health(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "uptime_seconds" in data

    def test_readiness(self, client):
        resp = client.get("/readiness")
        assert resp.status_code == 200


class TestFraudEndpoint:

    def test_fraud_prediction(self, client):
        resp = client.post(
            "/api/v1/predict/fraud",
            json={
                "transaction_id": "TXN-test001",
                "user_id": "USR-001",
                "merchant_id": "MRC-001",
                "amount": 150.00,
                "timestamp": "2026-05-13T08:30:00",
                "device_id": "DEV-001",
                "ip_address": "hash_abc123",
                "channel": "online",
            },
            headers={"X-API-Key": "changeme-generate-a-secure-key"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "fraud_score" in data
        assert 0 <= data["fraud_score"] <= 1
        assert data["risk_level"] in ("low", "medium", "high", "critical")
        assert "decision_id" in data

    def test_fraud_no_auth(self, client):
        resp = client.post("/api/v1/predict/fraud", json={})
        assert resp.status_code == 401


class TestCreditEndpoint:

    def test_credit_prediction(self, client):
        resp = client.post(
            "/api/v1/predict/credit",
            json={
                "user_id": "USR-001",
                "sim_tenure_months": 24,
                "avg_monthly_topup": 50.0,
                "on_time_rate": 0.9,
                "payment_consistency_index": 0.85,
            },
            headers={"X-API-Key": "changeme-generate-a-secure-key"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert 300 <= data["credit_score"] <= 850
        assert "reason_codes" in data
        assert len(data["reason_codes"]) > 0
