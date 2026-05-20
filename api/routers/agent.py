"""
FinGuard 2026 — Investigator Agent API Router.

REST endpoint for the frontend chat window to communicate
with the AI investigator.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from api.middleware.auth import verify_api_key
from config.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1/agent", tags=["Investigator Agent"])


class InvestigateRequest(BaseModel):
    question: str
    context: dict | None = None


class InvestigateResponse(BaseModel):
    question: str
    answer: str
    tool_used: str | None = None
    source: str
    latency_ms: float
    raw_data: dict | None = None


@router.post("/investigate", response_model=InvestigateResponse)
async def investigate(
    req: InvestigateRequest,
    _key: str = Depends(verify_api_key),
):
    """Ask the AI Investigator Agent a question."""
    from agent.investigator import InvestigatorAgent

    agent = InvestigatorAgent()
    result = agent.investigate(req.question)
    logger.info(
        "agent_investigation",
        question=req.question[:100],
        tool=result.get("tool_used"),
        latency=result.get("latency_ms"),
    )
    return InvestigateResponse(**result)


@router.get("/tools")
async def list_tools(_key: str = Depends(verify_api_key)):
    """List available investigation tools."""
    from agent.investigator import InvestigatorAgent

    agent = InvestigatorAgent()
    return {
        "tools": [
            {"name": t.name, "description": t.description}
            for t in agent.tools.values()
        ]
    }
