"""
Credit Line Fintech Solution — Phase 19: Embedded Finance, Risk Bounds & ZK Verification Tests.
"""

from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_underwrite_checkout_approved():
    """Verify that a low-risk, valid applicant with organic biometrics is approved."""
    payload = {
        "merchant_id": "merch_store_1",
        "purchase_amount": 500.0,
        "customer_name": "Aditya Sharma",
        "customer_email": "aditya@sharma.in",
        "national_id": "ABCDE1234F",
        "annual_income": 120000.0,
        "biometric_telemetry": [
            {
                "input_field": "fullName",
                "char_count": 13,
                "flight_times_ms": [120.0, 140.0, 95.0, 210.0, 110.0],
                "dwell_times_ms": [80.0, 75.0, 90.0, 85.0, 95.0]
            }
        ]
    }
    
    resp = client.post("/api/v1/embedded/underwrite", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["decision"] == "APPROVED"
    assert data["biometric_fraud_verified"] is True
    assert data["credit_limit_granted"] >= 500.0
    assert data["assigned_interest_rate_apr"] in [10.5, 14.0, 18.5]
    assert data["risk_score"] < 0.20

def test_underwrite_checkout_declined_bot_by_name():
    """Verify synthetic bot name triggers biometric fraud declination."""
    payload = {
        "merchant_id": "merch_store_1",
        "purchase_amount": 500.0,
        "customer_name": "Synthetic Bot Agent",
        "customer_email": "realuser@sharma.in",
        "national_id": "ABCDE1234F",
        "annual_income": 120000.0,
        "biometric_telemetry": []
    }
    
    resp = client.post("/api/v1/embedded/underwrite", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["decision"] == "DECLINED"
    assert data["biometric_fraud_verified"] is False
    assert "synthetic" in data["reason"].lower()

def test_underwrite_checkout_declined_uniform_biometrics():
    """Verify that perfectly uniform keystroke timings trigger a bot alert."""
    payload = {
        "merchant_id": "merch_store_1",
        "purchase_amount": 500.0,
        "customer_name": "John Doe",
        "customer_email": "john@doe.com",
        "national_id": "ABCDE1234F",
        "annual_income": 120000.0,
        "biometric_telemetry": [
            {
                "input_field": "fullName",
                "char_count": 10,
                # 100ms exactly for every single press (0 variance)
                "flight_times_ms": [100.0, 100.0, 100.0, 100.0],
                "dwell_times_ms": [50.0, 50.0, 50.0, 50.0]
            }
        ]
    }
    
    resp = client.post("/api/v1/embedded/underwrite", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["decision"] == "DECLINED"
    assert data["biometric_fraud_verified"] is False
    assert "synthetic" in data["reason"].lower()

def test_underwrite_checkout_declined_expected_loss_cap():
    """Verify that high-risk loans (large purchase relative to income) violate EL safety caps."""
    payload = {
        "merchant_id": "merch_store_1",
        "purchase_amount": 40000.0,  # 40% of income -> PD = 45% -> EL = 18% (1800 bps)
        "customer_name": "Aditya Sharma",
        "customer_email": "aditya@sharma.in",
        "national_id": "ABCDE1234F",
        "annual_income": 100000.0,
        "biometric_telemetry": [
            {
                "input_field": "fullName",
                "char_count": 13,
                "flight_times_ms": [120.0, 140.0, 95.0],
                "dwell_times_ms": [80.0, 75.0, 90.0]
            }
        ]
    }
    
    resp = client.post("/api/v1/embedded/underwrite", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["decision"] == "DECLINED"
    # Over 500 bps Expected Loss (1800 bps here)
    assert "Expected Loss" in data["reason"] or "lending guidelines" in data["reason"]

def test_underwrite_checkout_declined_low_income():
    """Verify that income below threshold is auto-declined."""
    payload = {
        "merchant_id": "merch_store_1",
        "purchase_amount": 100.0,
        "customer_name": "Aditya Sharma",
        "customer_email": "aditya@sharma.in",
        "national_id": "ABCDE1234F",
        "annual_income": 5000.0, # Below 10k limit
        "biometric_telemetry": []
    }
    
    resp = client.post("/api/v1/embedded/underwrite", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["decision"] == "DECLINED"
    assert "income" in data["reason"].lower()

def test_get_syndicate_status():
    """Verify syndicate metrics API correctly returns TVL, yield rates, and active caps."""
    resp = client.get("/api/v1/embedded/syndicate/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["total_value_locked_usd"] == 4820000.0
    assert data["active_yield_apr"] == 12.4
    assert data["expected_loss_cap_bps"] == 500

def test_zk_proof_verification_pipeline():
    """Verify ZK solver validation triggers mock proof verification and logs transactions."""
    payload = {
        "proof": {
            "pi_a": ["0x111", "0x222"],
            "pi_b": [["0x333", "0x444"], ["0x555", "0x666"]],
            "pi_c": ["0x777", "0x888"]
        },
        "public_inputs": ["0x999", "0xaaa"]
    }
    
    resp = client.post("/api/v1/embedded/zk/verify-proof", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["verification_hash"].startswith("0x")
    assert data["credit_limit_extension"] == 15000.0
