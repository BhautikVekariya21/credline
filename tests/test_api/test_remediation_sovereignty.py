"""
Credit Line Fintech Solution — Phase 17: Auto-Remediation & Sovereign AI Integration Tests.
"""

import os
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_ceo_sovereign_inference():
    """Verify zero-copy model weight routing to localized regions without PII leakage."""
    resp = client.post(
        "/api/v1/ceo/sovereign/infer",
        json={
            "client_ip": "198.51.100.12",
            "country_code": "IN",
            "ledger_id": "ledger_india_9081",
            "model_type": "GraphSAGE",
            "model_version": "v3.4.1"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["jurisdiction"] == "IN"
    assert "aws_nitro_enclave" in data
    assert "data_governance" in data
    assert data["data_governance"]["data_export_violation"] is False
    assert data["data_governance"]["pii_redacted"] is True
    assert "inference_result" in data
    assert data["inference_result"]["score"] >= 300
    assert data["inference_result"]["score"] <= 850


def test_ceo_liquidity_swap_negotiation():
    """Verify M2M algorithm swap negotiator returns cryptographically signed agreements."""
    resp = client.post(
        "/api/v1/ceo/negotiate/swap",
        json={
            "deficit_currency": "EUR",
            "deficit_amount": 5000000.0,
            "collateral_currency": "USD",
            "partner_bank": "Deutsche Bank AI"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "swap_id" in data
    assert "contract" in data
    
    contract = data["contract"]
    assert contract["status"] == "APPROVED"
    assert contract["parties"]["initiator"] == "Credit Line AI"
    assert contract["parties"]["receiver"] == "Deutsche Bank AI"
    assert contract["terms"]["funding_currency"] == "EUR"
    assert contract["terms"]["funding_amount"] == 5000000.0
    
    assert "cryptographic_signatures" in contract
    assert "credit_line_agent" in contract["cryptographic_signatures"]
    assert "partner_bank_agent" in contract["cryptographic_signatures"]
    assert contract["cryptographic_signatures"]["signature_algorithm"] == "HMAC-SHA256"


def test_ceo_remediation_logs_stream():
    """Verify retrieval and clear operations of the healer agent thought logs."""
    # Reset logs
    resp_clear = client.post("/api/v1/ceo/remediation/logs/clear")
    assert resp_clear.status_code == 200
    assert resp_clear.json()["status"] == "cleared"

    # Get logs
    resp = client.get("/api/v1/ceo/remediation/logs")
    assert resp.status_code == 200
    logs = resp.json()["logs"]
    assert len(logs) > 0
    assert "Logs cleared" in logs[0]


def test_ceo_auto_remediation_execution():
    """Verify the Healer Agent successfully catches errors, writes patches, and completes tests."""
    # Reset logs
    client.post("/api/v1/ceo/remediation/logs/clear")

    # Run auto-remediate endpoint
    resp = client.post(
        "/api/v1/ceo/remediate",
        json={
            "failing_payload": {
                "tax_identifier": "TX-9983-A",
                "amount": 25000.0,
                "timestamp": "2026-05-27T09:00:00"
            }
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "patched_file" in data
    assert data["test_passed"] is True
    assert data["kubernetes_rollout"] == "Completed"

    # Check that logs were populated
    resp_logs = client.get("/api/v1/ceo/remediation/logs?limit=150")
    assert resp_logs.status_code == 200
    logs = resp_logs.json()["logs"]
    print("DEBUG LOGS:", logs)
    assert any("Simulated Vendor API Schema change injected" in line for line in logs)
    assert any("SUCCESS: All unit tests passed" in line for line in logs)
