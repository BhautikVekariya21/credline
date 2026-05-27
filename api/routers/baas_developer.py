"""
Credit Line Fintech Solution — Phase 18: BaaS Developer API Router.

Mounts developer portal sandbox triggers, webhook dispatcher controllers,
and the unified GraphQL federation endpoints.
"""

from __future__ import annotations
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from infrastructure.api_gateway.api_gateway_router import router as api_gateway_router
from services.webhooks.webhook_dispatcher import WebhookDispatcher, WebhookEvent, WebhookSubscription
from services.graphql.graphql_schema import GraphQLSchemaResolver, GraphQLQueryRequest

logger = logging.getLogger("BaasDeveloperRouter")

router = APIRouter(prefix="/api/v1", tags=["BaaS Developer Portal (Phase 18)"])

# Mount the sub-router for gateway rate limits/keys directly
router.include_router(api_gateway_router)

# ─── Singletons ──────────────────────────────────────────────────────────────
_dispatcher = WebhookDispatcher()
_graphql_resolver = GraphQLSchemaResolver()


# ─── Request Models ──────────────────────────────────────────────────────────

class WebhookTriggerRequest(BaseModel):
    developer_id: str = Field("dev_a_9081", description="Target developer account reference")
    webhook_url: str = Field("https://api.startup-a.com/webhooks/creditline", description="Webhook target destination")
    signing_secret: str = Field("whsec_startupA_secret_key_112233", description="Signing secret key")
    event_type: str = Field("tax_return.filed_successfully", description="Webhook event key")
    payload: Dict[str, Any] = Field(
        default_factory=lambda: {
            "period": "042026",
            "gstin": "29AAAAA1111A1Z1",
            "tax_due": 432000.0,
            "status": "SUCCESS"
        }
    )


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/developer/webhook/test")
async def trigger_developer_webhook(req: WebhookTriggerRequest):
    """
    Simulates triggering an asynchronous webhook payload signed with HMAC-SHA256,
    delivering it to the registered developer endpoint with exponential backoff retries.
    """
    try:
        sub = WebhookSubscription(
            developer_id=req.developer_id,
            webhook_url=req.webhook_url,
            signing_secret=req.signing_secret
        )
        evt = WebhookEvent(
            event_type=req.event_type,
            data=req.payload
        )
        report = await _dispatcher.dispatch_webhook(sub, evt)
        return report
    except Exception as exc:
        logger.error(f"webhook_dispatch_failed: {str(exc)}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/developer/webhook/history")
async def get_webhook_history():
    """Returns logs of all webhook attempts and delivery statuses."""
    try:
        history = _dispatcher.get_delivery_history()
        return {"history": history}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/graphql")
async def execute_graphql_query(req: GraphQLQueryRequest):
    """
    Processes federated GraphQL queries across microservices.
    Enables aggregated fetches for user data, GraphSAGE fraud networks, and tax liabilities in a single roundtrip.
    """
    try:
        result = _graphql_resolver.resolve(req.query, req.variables)
        return result
    except Exception as exc:
        logger.error(f"graphql_execution_failed: {str(exc)}")
        raise HTTPException(status_code=500, detail=str(exc))
