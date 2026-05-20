"""Tests for direct frontend-facing API routes."""

from fastapi.testclient import TestClient

from api.main import app


client = TestClient(app)


def test_direct_health_status():
    resp = client.get("/health/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "operational"
    assert "api_latency_ms" in data
    assert "active_models" in data


def test_direct_transactions():
    resp = client.get("/health/transactions?limit=3")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    assert {"id", "user_id", "amount", "risk_score"}.issubset(data[0])


def test_direct_credit_metrics():
    resp = client.get("/credit-engine/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_scored"] > 0
    assert 0 <= data["approved_rate"] <= 1


def test_direct_edge_verify():
    resp = client.post(
        "/edge/verify",
        json={"user_id": "USR-001", "encrypted_payload": "demo"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "trust_score" in data
    assert "is_genuine" in data
