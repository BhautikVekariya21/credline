"""
Credit Line Fintech Solution — Phase 18: Global API Gateway & Monetization Engine.

Provides API key resolution, token-bucket rate limiting (Redis/memory), RLS tenant
filtering, and Stripe usage metering logic for the developer platform.
"""

from __future__ import annotations
import time
import uuid
import hashlib
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, Header, Request

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ApiGateway")

router = APIRouter(prefix="/gateway", tags=["Developer Gateway (Phase 18)"])

# ─── Multi-Tenant Mock Database ──────────────────────────────────────────────
# Shared database tables containing rows isolated by tenant_id
MOCK_TRANSACTIONS_DB = [
    {"id": "tx_01", "tenant_id": "tenant-a-9981", "amount": 12000.0, "category": "Office Equipment", "tax_slab": "18"},
    {"id": "tx_02", "tenant_id": "tenant-a-9981", "amount": 450.0, "category": "Travel Meals", "tax_slab": "5"},
    {"id": "tx_03", "tenant_id": "tenant-b-2244", "amount": 89000.0, "category": "Consulting Services", "tax_slab": "18"},
    {"id": "tx_04", "tenant_id": "tenant-b-2244", "amount": 150000.0, "category": "Luxury SUV purchase", "tax_slab": "28"}
]

# Registered developer API Keys mapped to tenant details
API_KEYS_REGISTRY = {
    "sk_live_tenantA_secret_key_8923": {
        "tenant_id": "tenant-a-9981",
        "name": "FinTech Startup A",
        "tier": "GROWTH",
        "requests_per_minute": 60
    },
    "sk_live_tenantB_secret_key_4412": {
        "tenant_id": "tenant-b-2244",
        "name": "E-Commerce Group B",
        "tier": "ENTERPRISE",
        "requests_per_minute": 240
    }
}

# Stripe Usage Meter database
# Developer API Key -> Usage Count
DEVELOPER_USAGE_METER = {
    "sk_live_tenantA_secret_key_8923": 1420,
    "sk_live_tenantB_secret_key_4412": 28940
}


# ─── Redis Token Bucket Rate Limiter Simulation ──────────────────────────────
class TokenBucketLimiter:
    """Thread-safe token-bucket rate limiter with Redis-like interface."""
    def __init__(self):
        # API Key -> { "tokens": float, "last_updated": float }
        self._buckets: Dict[str, Dict[str, float]] = {}

    def is_rate_limited(self, api_key: str, limit_rpm: int) -> bool:
        now = time.time()
        capacity = float(limit_rpm)
        fill_rate = capacity / 60.0  # tokens per second

        if api_key not in self._buckets:
            self._buckets[api_key] = {
                "tokens": capacity,
                "last_updated": now
            }
            return False

        bucket = self._buckets[api_key]
        elapsed = now - bucket["last_updated"]
        
        # Refill bucket
        refilled_tokens = bucket["tokens"] + (elapsed * fill_rate)
        bucket["tokens"] = min(capacity, refilled_tokens)
        bucket["last_updated"] = now

        if bucket["tokens"] >= 1.0:
            bucket["tokens"] -= 1.0
            return False  # Not rate limited
        
        return True  # Rate limited


_rate_limiter = TokenBucketLimiter()


# ─── Middleware / Dependencies ────────────────────────────────────────────────
async def verify_api_key(x_api_key: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Authenticates key and rate-limits incoming developer requests."""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-KEY header.")
    
    if x_api_key not in API_KEYS_REGISTRY:
        raise HTTPException(status_code=401, detail="Invalid API key.")
    
    tenant_info = API_KEYS_REGISTRY[x_api_key]
    
    # Apply Token-Bucket Rate Limiting
    limit_rpm = tenant_info["requests_per_minute"]
    if _rate_limiter.is_rate_limited(x_api_key, limit_rpm):
        raise HTTPException(status_code=429, detail="API rate limit exceeded. Upgrade tier.")
    
    # Increment usage billing count
    DEVELOPER_USAGE_METER[x_api_key] = DEVELOPER_USAGE_METER.get(x_api_key, 0) + 1
    
    return {
        "api_key": x_api_key,
        "tenant_id": tenant_info["tenant_id"],
        "name": tenant_info["name"],
        "tier": tenant_info["tier"]
    }


# ─── Request/Response Models ──────────────────────────────────────────────────
class KeyGenerateRequest(BaseModel):
    name: str = Field(..., description="Application name")
    tier: str = Field("GROWTH", description="Pricing tier: SANDBOX, GROWTH, ENTERPRISE")


class RlsQueryRequest(BaseModel):
    transaction_id: Optional[str] = Field(None, description="Optional ID of specific transaction to fetch")


class GSTCategorizationRequest(BaseModel):
    amount: float = Field(..., description="Transaction amount in INR")
    category: str = Field(..., description="HSN/SAC descriptor string")
    hsn_code: str = Field(..., description="HSN code (e.g. 8471)")


class StripeWebhookRequest(BaseModel):
    id: str
    type: str = Field("invoice.created", description="Stripe webhook event type")
    data: Dict[str, Any] = Field(..., description="Event payload contents")


# ─── Gateway Endpoints ────────────────────────────────────────────────────────

@router.post("/tax/categorize")
async def gateway_gst_categorization(
    req: GSTCategorizationRequest,
    auth: Dict[str, Any] = Depends(verify_api_key)
):
    """
    Exposes automated tax categorization (Phase 13 GST slab analysis) under a metered gateway.
    Enforces tenant RLS: the transaction is processed under the authenticated tenant credentials.
    """
    # Simulate GST calculation
    tax_rate = 18.0
    if req.hsn_code in ["0201", "1006"]:
        tax_rate = 5.0
    elif req.hsn_code in ["6109"]:
        tax_rate = 12.0
    elif req.hsn_code in ["8703", "8711"]:
        tax_rate = 28.0

    tax_value = req.amount * (tax_rate / 100.0)
    
    # Simulate logging transaction to shared ledger (with tenant_id RLS boundary)
    new_row = {
        "id": f"tx_{int(time.time())}",
        "tenant_id": auth["tenant_id"],
        "amount": req.amount,
        "category": req.category,
        "tax_slab": str(int(tax_rate))
    }
    MOCK_TRANSACTIONS_DB.append(new_row)

    return {
        "success": True,
        "transaction_id": new_row["id"],
        "tenant_id": auth["tenant_id"],
        "taxable_amount": req.amount,
        "slab_percentage": tax_rate,
        "computed_gst": tax_value,
        "billing_cost_usd": 0.02
    }


@router.post("/ledger/query")
async def gateway_rls_query(
    req: RlsQueryRequest,
    auth: Dict[str, Any] = Depends(verify_api_key)
):
    """
    Queries database ledger applying strict Row-Level Security (RLS).
    Filter results by auth['tenant_id'], preventing Startup A from ever accessing Startup B's data rows.
    """
    tenant_id = auth["tenant_id"]
    
    # If looking for a specific transaction ID:
    if req.transaction_id:
        target_row = next((r for r in MOCK_TRANSACTIONS_DB if r["id"] == req.transaction_id), None)
        if not target_row:
            raise HTTPException(status_code=404, detail="Transaction not found.")
        
        # Row-Level Security validation check
        if target_row["tenant_id"] != tenant_id:
            logger.warning(f"RLS VIOLATION ATTEMPT: Tenant {tenant_id} tried to access row owned by {target_row['tenant_id']}.")
            raise HTTPException(status_code=403, detail="Database Access Violation: Access Denied (RLS policy).")
        
        return {"data": [target_row]}

    # General list: Filter list by tenant_id
    filtered_rows = [r for r in MOCK_TRANSACTIONS_DB if r["tenant_id"] == tenant_id]
    return {"data": filtered_rows}


@router.post("/keys/generate")
async def generate_api_key(req: KeyGenerateRequest):
    """Generates a new cryptographic API key and registers the tenant."""
    new_key = f"sk_live_{uuid.uuid4().hex[:12]}_secret_{uuid.uuid4().hex[:4]}"
    tenant_id = f"tenant-{uuid.uuid4().hex[:4]}"
    rpm_limit = 60 if req.tier == "GROWTH" else 240 if req.tier == "ENTERPRISE" else 10

    API_KEYS_REGISTRY[new_key] = {
        "tenant_id": tenant_id,
        "name": req.name,
        "tier": req.tier,
        "requests_per_minute": rpm_limit
    }
    
    # Initialize usage meter
    DEVELOPER_USAGE_METER[new_key] = 0

    return {
        "success": True,
        "api_key": new_key,
        "tenant_id": tenant_id,
        "tier": req.tier,
        "requests_per_minute": rpm_limit,
        "message": "Write this key down. It will never be displayed again."
    }


@router.post("/keys/revoke")
async def revoke_api_key(api_key: str = Header(..., description="Key to revoke")):
    """Revokes a key from registry."""
    if api_key in API_KEYS_REGISTRY:
        del API_KEYS_REGISTRY[api_key]
        if api_key in DEVELOPER_USAGE_METER:
            del DEVELOPER_USAGE_METER[api_key]
        return {"success": True, "message": "API Key revoked."}
    raise HTTPException(status_code=404, detail="Key not found.")


@router.post("/stripe/webhook")
async def stripe_billing_webhook(req: StripeWebhookRequest):
    """
    Receives Stripe webhooks. Simulates meter accumulation and invoice calculations.
    """
    event_type = req.type
    if event_type == "invoice.created":
        stripe_customer_id = req.data.get("customer")
        api_key = req.data.get("metadata", {}).get("api_key")
        
        if not api_key or api_key not in DEVELOPER_USAGE_METER:
            return {"status": "ignored", "reason": "No matched API key usage found"}
        
        usage = DEVELOPER_USAGE_METER[api_key]
        amount_due = usage * 0.02  # $0.02 per request metering
        
        # Reset current cycle usage
        DEVELOPER_USAGE_METER[api_key] = 0

        return {
            "status": "processed",
            "stripe_customer": stripe_customer_id,
            "api_key_masked": f"{api_key[:8]}...",
            "usage_recorded": usage,
            "cost_per_request": 0.02,
            "invoice_total_usd": round(amount_due, 2)
        }
    
    return {"status": "unhandled_event"}


@router.get("/developer/metrics")
async def get_developer_metrics():
    """Returns aggregated API keys and current usage metrics."""
    keys_list = []
    for k, v in API_KEYS_REGISTRY.items():
        keys_list.append({
            "key_masked": f"{k[:10]}...{k[-4:]}",
            "tenant_id": v["tenant_id"],
            "name": v["name"],
            "tier": v["tier"],
            "rpm_limit": v["requests_per_minute"],
            "accumulated_usage": DEVELOPER_USAGE_METER.get(k, 0)
        })
    return {
        "active_keys_count": len(API_KEYS_REGISTRY),
        "keys": keys_list
    }
