"""
Credit Line Fintech Solution — Phase 21: Compliance, Hedging & Clearing House Integration Tests.
"""

from fastapi.testclient import TestClient
from api.main import app
from services.compliance_gate.sanction_scanner import jaro_winkler_similarity

client = TestClient(app)

def test_jaro_winkler_fuzzy_logic():
    """Verify that Jaro-Winkler similarity computes accurately for fuzzy matching."""
    # Exact match
    assert abs(jaro_winkler_similarity("Ivan Badov", "Ivan Badov") - 1.0) < 0.001
    
    # Empty string check
    assert jaro_winkler_similarity("", "Ivan") == 0.0

    # Prefix match
    sim_prefix = jaro_winkler_similarity("Ivan", "Ivan Badov")
    assert sim_prefix > 0.80

    # No match
    sim_none = jaro_winkler_similarity("Alice", "Bob")
    assert sim_none < 0.50

def test_sanctions_screen_blocked():
    """Verify that a sanctioned name (Ivan Badov) triggers immediate quarantine."""
    payload = {
        "entity_name": "Ivan Badov",
        "amount_usd": 250000.0
    }
    
    resp = client.post("/api/v1/compliance/sanctions/scan", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_quarantined"] is True
    assert data["matched_watchlist"] == "OFAC SDN"
    assert data["highest_similarity_score"] > 0.85
    assert data["audit_trail_hash"] != ""

def test_sanctions_screen_passed():
    """Verify that a clean entity (Aditya Sharma) passes sanctions screening."""
    payload = {
        "entity_name": "Aditya Sharma",
        "amount_usd": 5000.0
    }
    
    resp = client.post("/api/v1/compliance/sanctions/scan", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_quarantined"] is False
    assert data["highest_similarity_score"] < 0.85

def test_sanctions_latency_sla():
    """Verify that compliance matching complies with the sub-10ms SLA."""
    payload = {
        "entity_name": "Ivan Badov",
        "amount_usd": 1000.0
    }
    
    resp = client.post("/api/v1/compliance/sanctions/scan", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["processing_latency_ms"] < 10.0
    assert data["sla_passed"] is True

def test_get_quarantine_logs():
    """Verify that we can retrieve active quarantined logs feed."""
    resp = client.get("/api/v1/compliance/sanctions/quarantine-logs")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["logs"]) >= 2
    assert any(log["entity_name"] == "Ivan Badov" for log in data["logs"])

def test_cds_quote_premium():
    """Verify Credit Default Swap (CDS) actuarial dynamic premium quote calculation."""
    payload = {
        "default_intensity": 0.03,  # lambda
        "recovery_rate": 0.40,      # R
        "volatility": 0.15,         # sigma
        "alpha": 0.08
    }
    
    resp = client.post("/api/v1/compliance/cds/quote", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    # expected rate = 0.03 * (1 - 0.40) + 0.08 * (0.15^2)
    # = 0.018 + 0.08 * 0.0225 = 0.018 + 0.0018 = 0.0198 (198 bps)
    assert data["premium_rate_bps"] == 198
    assert abs(data["premium_rate"] - 0.0198) < 0.0001
    assert data["term1_default_risk"] == 0.018
    assert data["term2_volatility_premium"] == 0.0018

def test_cds_trigger_default_event():
    """Verify Oracle triggered default events payout correctly."""
    resp = client.post("/api/v1/compliance/cds/trigger-event")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["event_status"] == "CREDIT_EVENT_SETTLED"
    assert data["total_principal_paid_out_usd"] > 0.0

def test_clearing_reconcile_success():
    """Verify clearing house reconciliation check reports success on identical balances."""
    payload = {
        "fiat_total": 4820000.0,
        "onchain_total": 4820000.0,
        "tolerance": 0.01
    }
    
    resp = client.post("/api/v1/compliance/clearing/reconcile", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["reconciled"] is True
    assert data["absolute_difference"] == 0.0

def test_clearing_reconcile_failure():
    """Verify clearing house reconciliation reports failure when balances mismatch exceeds tolerance."""
    payload = {
        "fiat_total": 4820000.0,
        "onchain_total": 4850000.0,
        "tolerance": 0.01
    }
    
    resp = client.post("/api/v1/compliance/clearing/reconcile", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["reconciled"] is False
    assert data["absolute_difference"] == 30000.0
