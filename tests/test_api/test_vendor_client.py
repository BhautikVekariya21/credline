"""
Credit Line Fintech Solution — Unit tests for the mock vendor client.
Targeted by the Healer Agent to verify patches without recursive API loops.
"""

import sys
import os

# Ensure local auto_remediation directory is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "infrastructure", "auto_remediation")))

def test_process_vendor_response():
    import sys
    if "vendor_client" in sys.modules:
        del sys.modules["vendor_client"]
    try:
        import vendor_client
    except ImportError:
        # Create a mock default if not present
        from infrastructure.auto_remediation.healer_agent import AutoRemediationHealer
        healer = AutoRemediationHealer()
        healer.simulate_vendor_break()
        if "vendor_client" in sys.modules:
            del sys.modules["vendor_client"]
        import vendor_client

    # Standard payload that should always work after patch
    payload = {
        "tax_identifier": "TX-9983-A",
        "amount": 25000.0,
        "timestamp": "2026-05-27T09:00:00"
    }
    
    result = vendor_client.process_vendor_response(payload)
    assert result["status"] == "PROCESSED"
    # After remediation, the tax_id should map to the tax_identifier key value
    assert result["tax_id"] == "TX-9983-A"
