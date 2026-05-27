"""
FinGuard 2026 — CEO Command Room Router Unit Tests.
"""

from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_ceo_genesis_status():
    resp = client.get("/api/v1/ceo/genesis/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "synchronized"
    assert "mesh_health" in data
    assert "istio_mtls" in data
    assert "kubernetes_cluster" in data
    assert "services" in data
    assert len(data["services"]) > 0


def test_ceo_ma_scan():
    resp = client.post(
        "/api/v1/ceo/ma/scan",
        json={
            "name": "SynergyCorp LLC",
            "equity_market_cap": 10000000.0,
            "debt_value": 2000000.0,
            "cost_of_equity": 0.11,
            "cost_of_debt": 0.08,
            "tax_rate": 0.25,
            "base_fcf": 1200000.0,
            "growth_rates": [0.18, 0.15, 0.12, 0.10, 0.08],
            "terminal_growth": 0.03,
            "cash": 800000.0
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["target_name"] == "SynergyCorp LLC"
    assert data["wacc"] > 0
    assert "dcf" in data
    assert "proposed_offer_inr" in data
    assert "loi_document" in data
    assert "LETTER OF INTENT" in data["loi_document"]


def test_ceo_fx_route_triangular():
    resp = client.post(
        "/api/v1/ceo/fx/route",
        json={
            "source": "INR",
            "target": "EUR",
            "amount": 100000.0,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "path" in data
    assert "net_amount" in data
    assert "fees" in data
    assert "networks" in data
    assert "execution_engine" in data
