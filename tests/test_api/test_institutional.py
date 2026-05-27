"""
Credit Line Fintech Solution — Phase 20: Institutional RWA & DID Integration Tests.
"""

from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_did_presentation_verification_success():
    """Verify that a standard verifiable presentation with correct structure passes."""
    payload = {
        "presentation": {
            "type": ["VerifiablePresentation"],
            "verifiableCredential": {
                "issuer": "did:key:z6Mku7bQp8g98qAdfB812cDb22341",
                "credentialSubject": {
                    "id": "did:key:z6Mkt82129aCdbfe991a2",
                    "creditScore": 792,
                    "amlStatus": "PASSED",
                    "incomeVerifiedUsd": 185000.0
                },
                "proof": {
                    "type": "Ed25519Signature2020",
                    "verificationMethod": "did:key:z6Mku7bQp8g98qAdfB812cDb22341#key-1",
                    "proofValue": "z3h29SignatureMockedCryptoValuePayloadForVerifiablePresentationClaims"
                }
            }
        }
    }
    
    resp = client.post("/api/v1/institutional/did/verify", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["claims"]["creditScore"] == 792
    assert data["claims"]["amlStatus"] == "PASSED"
    assert data["publicKeyHex"] != ""

def test_did_presentation_verification_invalid_type():
    """Verify that missing presentation type triggers a verification failure."""
    payload = {
        "presentation": {
            "type": ["InvalidType"],
            "verifiableCredential": {}
        }
    }
    resp = client.post("/api/v1/institutional/did/verify", json=payload)
    assert resp.status_code == 400
    assert "Invalid presentation type" in resp.json()["detail"]

def test_amm_rate_calculation_low_utilization():
    """Verify AMM rate calculation when pool utilization is below kink threshold (80%)."""
    payload = {
        "total_borrowed": 3000000.0,  # 30% utilization
        "total_liquidity": 10000000.0,
        "base_rate": 0.02,
        "slope1": 0.04,
        "slope2": 0.25,
        "kink": 0.80
    }
    resp = client.post("/api/v1/institutional/amm/calculate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["utilization"] == 0.30
    # Expected rate = 0.02 + 0.30 * 0.04 = 0.032 (3.2%)
    assert abs(data["rate"] - 0.032) < 0.0001
    assert data["kink_active"] is False

def test_amm_rate_calculation_above_kink():
    """Verify AMM rate calculation when pool utilization exceeds kink threshold (80%)."""
    payload = {
        "total_borrowed": 9000000.0,  # 90% utilization
        "total_liquidity": 10000000.0,
        "base_rate": 0.02,
        "slope1": 0.04,
        "slope2": 0.25,
        "kink": 0.80
    }
    resp = client.post("/api/v1/institutional/amm/calculate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["utilization"] == 0.90
    # Expected rate = 0.02 + 0.90 * 0.04 + (0.90 - 0.80) * 0.25 = 0.02 + 0.036 + 0.025 = 0.081 (8.1%)
    assert abs(data["rate"] - 0.081) < 0.0001
    assert data["kink_active"] is True

def test_get_rwa_vaults_list():
    """Verify that RWA vaults list returns all mock institutional records."""
    resp = client.get("/api/v1/institutional/vaults")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["vaults"]) >= 4
    # Check that Prime Plaza vault is present and healthy
    prime_plaza = next(v for v in data["vaults"] if v["asset_id"] == 1)
    assert prime_plaza["asset_name"] == "Prime Commercial Plaza Deed"
    assert prime_plaza["health_factor_bps"] >= 10000

def test_oracle_price_drop_triggers_liquidation_eligibility():
    """Verify that Chainlink simulated price drops correctly trigger a vault health degradation."""
    # 1. Inspect initial Hindusthan Logistics vault (asset 4)
    resp_before = client.get("/api/v1/institutional/vaults")
    vault_before = next(v for v in resp_before.json()["vaults"] if v["asset_id"] == 4)
    assert vault_before["health_factor_bps"] > 10000  # Healthy

    # 2. Trigger price drop from 2.50 to 1.15
    resp_drop = client.post("/api/v1/institutional/oracle/price-drop?asset_id=4&new_price=1.15", json={})
    assert resp_drop.status_code == 200
    vaults_after = resp_drop.json()["vaults"]
    vault_after = next(v for v in vaults_after if v["asset_id"] == 4)
    
    # New Health Factor: (150,000 shares * $1.15 price * 80% Max LTV) / $290,000 borrow
    # = 138,000 / 290,000 = 0.4758 (4758 bps) < 10000 bps
    assert vault_after["health_factor_bps"] < 10000

    # 3. Attempt to liquidate vault_after (borrower: 0x3901bC09aD11029cDb892A0EeF901498CdB89201)
    # Settle 40% of the loan = 290,000 * 0.40 = 116,000 USD
    liq_payload = {
        "borrower": "0x3901bC09aD11029cDb892A0EeF901498CdB89201",
        "asset_id": 4,
        "repay_amount": 116000.0
    }
    resp_liq = client.post("/api/v1/institutional/vault/liquidate", json=liq_payload)
    assert resp_liq.status_code == 200
    liq_data = resp_liq.json()
    assert liq_data["success"] is True
    # Value Seized = 116,000 * 1.10 = 127,600 USD. Shares seized = 127,600 / 1.15 = 110956.5 -> 110956 shares
    assert liq_data["shares_seized"] == 110956
    assert liq_data["remaining_borrowed_usd"] == 174000.0
    assert liq_data["remaining_collateral_shares"] == 39044

def test_vault_liquidation_prevented_if_healthy():
    """Verify that healthy vaults cannot be liquidated."""
    liq_payload = {
        "borrower": "0x8923aB7fA2eE11029cDb892a0149028913904412",
        "asset_id": 1,
        "repay_amount": 100000.0
    }
    resp = client.post("/api/v1/institutional/vault/liquidate", json=liq_payload)
    assert resp.status_code == 400
    assert "healthy" in resp.json()["detail"]

def test_vault_liquidation_limit_breach():
    """Verify that liquidating more than 50% of the loan is blocked."""
    # Settle 60% of the loan = 290,000 * 0.60 = 174,000 USD
    # Note: Hindustan Logistics (asset 4) price was dropped in the previous test
    liq_payload = {
        "borrower": "0x3901bC09aD11029cDb892A0EeF901498CdB89201",
        "asset_id": 4,
        "repay_amount": 174000.0
    }
    resp = client.post("/api/v1/institutional/vault/liquidate", json=liq_payload)
    assert resp.status_code == 400
    assert "limit" in resp.json()["detail"]
