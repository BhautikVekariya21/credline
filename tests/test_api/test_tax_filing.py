from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_file_itr_nil_tax():
    """Test ITR filing with zero tax liability (income under 3L)."""
    payload = {
        "taxpayer_name": "John Doe",
        "pan": "ABCDE1234F",
        "assessment_year": "2026-27",
        "salary_income": 250000.0,
        "business_income": 0.0,
        "other_income": 20000.0,
        "deductions": 50000.0
    }
    response = client.post("/api/v1/compliance/tax/file-itr", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["id"].startswith("TAX-ITR-")
    assert data["taxpayer_name"] == "John Doe"
    assert data["taxpayer_id"] == "ABCDE1234F"
    assert data["liability"] == 0.0
    assert data["status"] == "PAID"

def test_file_itr_with_tax():
    """Test ITR filing with tax liability computed across slabs."""
    # Taxable income = 1,000,000 + 500,000 - 150,000 = 1,350,000.
    # Slab 3L-6L (300k @ 5%) = 15,000
    # Slab 6L-9L (300k @ 10%) = 30,000
    # Slab 9L-12L (300k @ 15%) = 45,000
    # Slab 12L-13.5L (150k @ 20%) = 30,000
    # Total = 120,000.
    payload = {
        "taxpayer_name": "Jane Miller",
        "pan": "PAN543210Z",
        "assessment_year": "2026-27",
        "salary_income": 1000000.0,
        "business_income": 500000.0,
        "other_income": 0.0,
        "deductions": 150000.0
    }
    response = client.post("/api/v1/compliance/tax/file-itr", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["liability"] == 120000.0
    assert data["status"] == "UNPAID"

def test_file_corporate_tax():
    """Test corporate tax return filing (25% rate on net profit)."""
    payload = {
        "entity_name": "Synergy Corp",
        "corporate_id": "L12345KA2020PTC123456",
        "tax_year": "2026",
        "revenue": 10000000.0,
        "opex": 6000000.0,
        "interest_paid": 500000.0
    }
    response = client.post("/api/v1/compliance/tax/file-corporate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["tax_type"] == "Corporate Tax"
    assert data["period"] == "FY 2026"
    assert data["taxpayer_id"] == "L12345KA2020PTC123456"
    # profit = 10,000,000 - 6,000,000 - 500,000 = 3,500,000.
    # tax = 3,500,000 * 0.25 = 875,000.
    assert data["liability"] == 875000.0
    assert data["status"] == "UNPAID"

def test_pay_tax_liability_card_success():
    """Test paying outstanding tax liability using credit card."""
    # Pay outstanding GST liability (TAX-GST-001)
    payload = {
        "filing_id": "TAX-GST-001",
        "payment_method": "CARD",
        "payment_details": {
            "cardholder_name": "Credit Line Inc",
            "card_number": "4111222233334444",
            "expiry": "12/29",
            "cvv": "123"
        },
        "amount": 33100.0
    }
    response = client.post("/api/v1/compliance/tax/pay-liability", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["filing"]["status"] == "PAID"
    assert data["filing"]["payment_details"]["method"] == "CARD"
    assert data["filing"]["payment_details"]["account_mask"] == "Ending in 4444"

def test_pay_tax_liability_crypto_success():
    """Test paying outstanding tax liability using web3 wallet."""
    # Pay outstanding ITR filing we create dynamically
    filing_payload = {
        "taxpayer_name": "Web3 Devs",
        "pan": "PAN777777A",
        "assessment_year": "2026-27",
        "salary_income": 300000.0,
        "business_income": 100000.0,
        "deductions": 0.0
    }
    filing_res = client.post("/api/v1/compliance/tax/file-itr", json=filing_payload).json()
    filing_id = filing_res["id"]
    liability = filing_res["liability"]
    assert liability > 0.0

    pay_payload = {
        "filing_id": filing_id,
        "payment_method": "CRYPTO",
        "payment_details": {
            "wallet_address": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            "signature": "0xabc123"
        },
        "amount": liability
    }
    response = client.post("/api/v1/compliance/tax/pay-liability", json=pay_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["filing"]["status"] == "PAID"
    assert data["filing"]["payment_details"]["method"] == "CRYPTO"
    assert data["filing"]["payment_details"]["account_mask"] == "0x71C7...976F"

def test_pay_tax_liability_insufficient_amount():
    """Test paying outstanding tax liability with insufficient funds."""
    filing_payload = {
        "taxpayer_name": "Poor Filer",
        "pan": "PAN999999Z",
        "assessment_year": "2026-27",
        "salary_income": 800000.0,
        "business_income": 0.0,
        "deductions": 0.0
    }
    filing_res = client.post("/api/v1/compliance/tax/file-itr", json=filing_payload).json()
    filing_id = filing_res["id"]
    liability = filing_res["liability"]
    assert liability > 0.0

    payload = {
        "filing_id": filing_id,
        "payment_method": "ACH",
        "payment_details": {
            "bank_name": "Chase Bank",
            "account_number": "12345678",
            "routing_number": "021000021"
        },
        "amount": 10.0  # Mismatch (Liability is much higher)
    }
    response = client.post("/api/v1/compliance/tax/pay-liability", json=payload)
    assert response.status_code == 400
    assert "Insufficient payment amount" in response.json()["detail"]

def test_get_tax_filings():
    """Test fetching all filings including default and dynamically created ones."""
    response = client.get("/api/v1/compliance/tax/filings")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    types = [f["tax_type"] for f in data]
    assert "GST" in types
    assert "ITR" in types
