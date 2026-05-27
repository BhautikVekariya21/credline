"""
Credit Line — Mock Vendor client with Auto-Remediation applied.
"""
from typing import Dict, Any

def process_vendor_response(data: Dict[str, Any]) -> Dict[str, Any]:
    # Remediated: handles both 'tax_id' and 'tax_identifier' to prevent crashes on schema changes
    tax_id = data.get("tax_id") or data.get("tax_identifier") or "UNKNOWN_TAX_ID"
    return {
        "status": "PROCESSED",
        "tax_id": tax_id,
        "amount": data.get("amount", 0.0),
        "timestamp": data.get("timestamp", "")
    }
