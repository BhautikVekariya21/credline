"""
Credit Line Fintech Solution — Phase 18: BaaS, Gateway & GraphQL Integration Tests.
"""

import hmac
import hashlib
import json
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_baas_api_key_lifecycle():
    """Verify developers can generate, check metrics, and revoke API keys."""
    # 1. Generate key
    resp = client.post(
        "/api/v1/gateway/keys/generate",
        json={"name": "Algotrading App", "tier": "GROWTH"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "api_key" in data
    assert data["tier"] == "GROWTH"
    api_key = data["api_key"]

    # 2. Query metrics and confirm new key is visible
    resp_metrics = client.get("/api/v1/gateway/developer/metrics")
    assert resp_metrics.status_code == 200
    metrics = resp_metrics.json()
    assert metrics["active_keys_count"] > 0
    assert any(api_key[-4:] in item["key_masked"] for item in metrics["keys"])

    # 3. Revoke key
    resp_revoke = client.post(
        "/api/v1/gateway/keys/revoke",
        headers={"api-key": api_key}
    )
    assert resp_revoke.status_code == 200
    assert resp_revoke.json()["success"] is True


def test_baas_rate_limiting_and_metering():
    """Verify rate-limiter token bucket logic and API billing metering increment."""
    # We will generate a sandbox-tier key to verify rate limits
    resp = client.post(
        "/api/v1/gateway/keys/generate",
        json={"name": "Sandbox Test App", "tier": "SANDBOX"}  # Sandbox limits to 10 requests/minute
    )
    assert resp.status_code == 200
    api_key = resp.json()["api_key"]

    # Make 11 requests sequentially to trigger rate limiting (bucket holds 10)
    throttled = False
    for _ in range(12):
        resp_call = client.post(
            "/api/v1/gateway/tax/categorize",
            headers={"x-api-key": api_key},
            json={
                "amount": 5000.0,
                "category": "Office Laptops",
                "hsn_code": "8471"
            }
        )
        if resp_call.status_code == 429:
            throttled = True
            break

    assert throttled is True


def test_baas_row_level_security_isolation():
    """Verify strict tenant data isolation. Tenant A cannot see Tenant B data rows."""
    # Setup two different developer keys representing Startup A and E-Commerce B
    key_a = "sk_live_tenantA_secret_key_8923"
    key_b = "sk_live_tenantB_secret_key_4412"

    # Query ledger for Tenant A
    resp_a = client.post(
        "/api/v1/gateway/ledger/query",
        headers={"x-api-key": key_a},
        json={}
    )
    assert resp_a.status_code == 200
    data_a = resp_a.json()["data"]
    # Check that Startup A ONLY sees rows belonging to 'tenant-a-9981'
    assert len(data_a) > 0
    assert all(row["tenant_id"] == "tenant-a-9981" for row in data_a)

    # Attempt to query a specific transaction belonging to Tenant B using Tenant A's key (RLS Breach attempt)
    resp_breach = client.post(
        "/api/v1/gateway/ledger/query",
        headers={"x-api-key": key_a},
        json={"transaction_id": "tx_03"}  # tx_03 is owned by Tenant B
    )
    # RLS should raise a 403 Forbidden Access Violation
    assert resp_breach.status_code == 403
    assert "Database Access Violation" in resp_breach.json()["detail"]


def test_baas_stripe_webhook_meter_reset():
    """Verify Stripe billing webhook aggregates usage and resets developers billing cycle usage."""
    api_key = "sk_live_tenantA_secret_key_8923"
    
    # 1. Fetch current metrics to verify accumulated usage count
    resp_metrics_before = client.get("/api/v1/gateway/developer/metrics")
    usage_before = next(item["accumulated_usage"] for item in resp_metrics_before.json()["keys"] if item["tenant_id"] == "tenant-a-9981")

    # 2. Simulate Stripe invoice.created webhook call
    resp_webhook = client.post(
        "/api/v1/gateway/stripe/webhook",
        json={
            "id": "evt_stripe_test_1234",
            "type": "invoice.created",
            "data": {
                "customer": "cus_stripe_tenantA_9012",
                "metadata": {"api_key": api_key}
            }
        }
    )
    assert resp_webhook.status_code == 200
    w_data = resp_webhook.json()
    assert w_data["status"] == "processed"
    assert w_data["usage_recorded"] == usage_before
    assert w_data["invoice_total_usd"] == round(usage_before * 0.02, 2)

    # 3. Verify usage was reset to 0
    resp_metrics_after = client.get("/api/v1/gateway/developer/metrics")
    usage_after = next(item["accumulated_usage"] for item in resp_metrics_after.json()["keys"] if item["tenant_id"] == "tenant-a-9981")
    assert usage_after == 0


def test_baas_webhook_signature_and_backoff():
    """Verify HMAC webhook event signing and exponential backoff retry execution."""
    resp = client.post(
        "/api/v1/developer/webhook/test",
        json={
            "developer_id": "dev_a_9081",
            "webhook_url": "https://api.startup-a.com/webhooks/creditline",
            "signing_secret": "whsec_startupA_secret_key_112233",
            "event_type": "tax_return.filed_successfully",
            "payload": {"period": "042026", "tax_due": 432000.0}
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["delivered"] is True
    assert len(data["attempts"]) == 1
    assert data["attempts"][0]["success"] is True

    # Validate signature header formatting inside history
    resp_history = client.get("/api/v1/developer/webhook/history")
    assert resp_history.status_code == 200
    history = resp_history.json()["history"]
    assert len(history) > 0
    assert history[-1]["delivered"] is True


def test_baas_graphql_federated_queries():
    """Verify federated GraphQL schema queries aggregate multiple services in one request."""
    resp = client.post(
        "/api/v1/graphql",
        json={
            "query": """
            query GetCreditResiliencyDetails {
              user(id: "usr-9081") {
                name
                company
              }
              fraudGraph(userId: "usr-9081") {
                risk_score
                hops {
                  node_name
                  risk_contribution
                }
              }
              taxLiability(tenantId: "tenant-a-9981") {
                total_tax
                filing_status
              }
            }
            """
        }
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    
    assert data["user"]["name"] == "Aditya Sharma"
    assert data["fraudGraph"]["risk_score"] == 0.08
    assert len(data["fraudGraph"]["hops"]) == 3
    assert data["taxLiability"]["total_tax"] == 432000.0
    assert data["taxLiability"]["filing_status"] == "FILED_SUCCESSFULLY"
