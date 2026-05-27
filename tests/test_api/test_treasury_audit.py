"""
FinGuard 2026 — Treasury & Cryptographic ZK Audit Router Unit Tests.
"""

from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_treasury_sweep_active():
    resp = client.post(
        "/api/v1/treasury-audit/sweep",
        json={
            "current_cash": 18200000.0,
            "predicted_min_cash_30d": 15500000.0,
            "reserve_threshold": 1200000.0,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_cash"] == 18200000.0
    assert data["idle_cash_detected"] > 0
    assert "allocated_amounts" in data
    assert "allocated_percentages" in data
    assert data["yield_earned_projected_30d"] > 0
    assert len(data["trade_logs"]) > 0


def test_zk_prove_and_verify_pipeline():
    # 1. Run prove to generate solvency zk proof
    prove_resp = client.post("/api/v1/treasury-audit/zk/prove", json={})
    assert prove_resp.status_code == 200
    proof_data = prove_resp.json()
    assert "zk_snark_proof" in proof_data
    assert "public_inputs" in proof_data
    assert "verification_key" in proof_data
    assert proof_data["public_inputs"]["solvency_proven"] is True
    assert proof_data["public_inputs"]["double_entry_proven"] is True

    # 2. Feed the generated proof directly back into verifier
    verify_resp = client.post(
        "/api/v1/treasury-audit/zk/verify",
        json={"proof_payload": proof_data},
    )
    assert verify_resp.status_code == 200
    verify_data = verify_resp.json()
    assert verify_data["verified"] is True
    assert verify_data["checks"]["solvency_inequality_passed"] is True
    assert verify_data["checks"]["double_entry_equality_passed"] is True
    assert verify_data["checks"]["bilinear_pairing_check_passed"] is True


def test_zk_verify_invalid_structure():
    # Try verifying corrupted/incomplete proof structure
    verify_resp = client.post(
        "/api/v1/treasury-audit/zk/verify",
        json={"proof_payload": {"corrupted": True}},
    )
    assert verify_resp.status_code == 200
    verify_data = verify_resp.json()
    assert verify_data["verified"] is False
    assert "error" in verify_data


def test_board_deck_reporting_pptx():
    resp = client.post(
        "/api/v1/treasury-audit/reporting/board-deck",
        json={
            "quarterly_revenue": 19200000.0,
            "net_income": 4500000.0,
        },
    )
    assert resp.status_code == 200
    # Since python-pptx is successfully installed, we expect it to return the pptx file stream
    if resp.headers.get("content-type") == "application/json":
        data = resp.json()
        assert "slides" in data
        assert "metadata" in data
    else:
        assert resp.headers.get("content-type") == (
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        )
        assert len(resp.content) > 0
