"""
Credit Line Fintech Solution — Phase 18: Aggregated GraphQL Schema Federation.

Aggregates nested data (Users, 3-hop fraud graphs, and tax liabilities)
across microservices into a unified query resolver.
"""

from __future__ import annotations
import re
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("GraphQLFederation")


# ─── Mock Service Records ────────────────────────────────────────────────────
MOCK_USERS = {
    "usr-9081": {"id": "usr-9081", "name": "Aditya Sharma", "company": "Sharma Enterprises"},
    "usr-4412": {"id": "usr-4412", "name": "Sophie Dubois", "company": "Dubois Exports"}
}

MOCK_FRAUD_GRAPHS = {
    "usr-9081": {
        "userId": "usr-9081",
        "risk_score": 0.08,
        "hops": [
            {"hop_id": 1, "node_name": "Sharma Office Wi-Fi (IP: 203.0.113.12)", "node_type": "IP", "risk_contribution": 0.01},
            {"hop_id": 2, "node_name": "Nitin Shah (Shared device node)", "node_type": "DEVICE", "risk_contribution": 0.04},
            {"hop_id": 3, "node_name": "Rohan Gupta (Suspected account link)", "node_type": "ACCOUNT", "risk_contribution": 0.03}
        ]
    },
    "usr-4412": {
        "userId": "usr-4412",
        "risk_score": 0.94,
        "hops": [
            {"hop_id": 1, "node_name": "VPN Proxy Node (IP: 195.12.3.45)", "node_type": "IP", "risk_contribution": 0.45},
            {"hop_id": 2, "node_name": "Device ID #89231 (Linked to 3 chargebacks)", "node_type": "DEVICE", "risk_contribution": 0.35},
            {"hop_id": 3, "node_name": "High Risk Syndicate Wallet Link", "node_type": "WALLET", "risk_contribution": 0.14}
        ]
    }
}

MOCK_TAX_LIABILITIES = {
    "tenant-a-9981": {
        "tenant_id": "tenant-a-9981",
        "total_taxable": 2400000.0,
        "total_tax": 432000.0,
        "filing_status": "FILED_SUCCESSFULLY"
    },
    "tenant-b-2244": {
        "tenant_id": "tenant-b-2244",
        "total_taxable": 14500000.0,
        "total_tax": 2610000.0,
        "filing_status": "DRAFT"
    }
}


class GraphQLQueryRequest(BaseModel):
    query: str = Field(..., description="GraphQL query payload")
    variables: Optional[Dict[str, Any]] = Field(None, description="Optional variables dictionary")


class GraphQLSchemaResolver:
    """
    Evaluates GraphQL queries, resolving nested attributes for Users,
    3-hop GraphSAGE Fraud graphs, and tax liabilities.
    """
    def resolve(self, query_string: str, variables: Optional[dict] = None) -> Dict[str, Any]:
        logger.info("Executing GraphQL query resolution...")
        
        # Clean query whitespace
        normalized = re.sub(r'\s+', ' ', query_string).strip()
        
        # Variables support mapping
        vars_map = variables or {}
        
        # Extract variables from query parameters or fallback
        user_id = vars_map.get("userId") or vars_map.get("id")
        tenant_id = vars_map.get("tenantId")
        
        # Simple regex extractors if variables not passed in payload dictionary
        if not user_id:
            user_match = re.search(r'userId\s*:\s*["\']([^"\']+)["\']', normalized)
            if not user_match:
                user_match = re.search(r'id\s*:\s*["\']([^"\']+)["\']', normalized)
            if user_match:
                user_id = user_match.group(1)
                
        if not tenant_id:
            tenant_match = re.search(r'tenantId\s*:\s*["\']([^"\']+)["\']', normalized)
            if tenant_match:
                tenant_id = tenant_match.group(1)

        result_data = {}

        # Resolve User block if present
        if "user" in normalized or "userId" in normalized:
            # Match fallback default user if none queried
            uid = user_id or "usr-9081"
            user_details = MOCK_USERS.get(uid)
            if user_details:
                result_data["user"] = {
                    "id": user_details["id"],
                    "name": user_details["name"],
                    "company": user_details["company"]
                }
            else:
                result_data["user"] = None

        # Resolve Fraud Graph block (Phase 10 GraphSAGE 3-hop query)
        if "fraudGraph" in normalized:
            uid = user_id or "usr-9081"
            graph = MOCK_FRAUD_GRAPHS.get(uid)
            if graph:
                result_data["fraudGraph"] = {
                    "userId": graph["userId"],
                    "risk_score": graph["risk_score"],
                    "hops": graph["hops"]
                }
            else:
                result_data["fraudGraph"] = None

        # Resolve Tax Liability block (Phase 13 GST Tax Engine query)
        if "taxLiability" in normalized:
            tid = tenant_id or "tenant-a-9981"
            tax = MOCK_TAX_LIABILITIES.get(tid)
            if tax:
                result_data["taxLiability"] = {
                    "tenantId": tax["tenant_id"],
                    "total_taxable": tax["total_taxable"],
                    "total_tax": tax["total_tax"],
                    "filing_status": tax["filing_status"]
                }
            else:
                result_data["taxLiability"] = None

        return {"data": result_data}
