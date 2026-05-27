"""
FinGuard 2026 — Executive Strategy Router Unit Tests.
"""

from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_executive_negotiations_inbox():
    resp = client.get("/api/v1/executive/negotiations/inbox")
    assert resp.status_code == 200
    data = resp.json()
    assert "count" in data
    assert "items" in data
    assert isinstance(data["items"], list)


def test_executive_forecast():
    resp = client.post(
        "/api/v1/executive/forecast",
        json={
            "sales_growth": 0.05,
            "churn_rate": -0.02,
            "macro_interest_rate": 0.01,
            "reserve_threshold": 1500000.0,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "days" in data
    assert "base_case" in data
    assert "worst_case" in data
    assert "best_case" in data
    assert "std_dev" in data
    assert "trigger_report" in data

    trigger = data["trigger_report"]
    assert "triggered" in trigger
    assert "crunch_day" in trigger
    assert "severity" in trigger
    assert "message" in trigger


def test_executive_contract_upload():
    contract_text = (
        "This cloud services agreement is entered into on 2026-01-01. "
        "The customer shall pay invoices Net 30 days. Payments must clear on time."
    )
    resp = client.post(
        "/api/v1/executive/contracts/upload",
        json={
            "filename": "test_aws_contract.txt",
            "content": contract_text,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["filename"] == "test_aws_contract.txt"
    assert "detected_terms" in data
    assert "clause" in data
    assert "match_confidence" in data
    assert data["extracted_days"] == 30
    assert "violations" in data
    assert "violations_count" in data


def test_executive_negotiation_action_not_found():
    # Attempting to action a non-existent item should return 404
    resp = client.post(
        "/api/v1/executive/negotiations/action",
        json={
            "action_id": "non_existent_id",
            "decision": "APPROVE",
            "custom_body": "Hello vendor",
        },
    )
    assert resp.status_code == 404
