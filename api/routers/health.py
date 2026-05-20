"""
FinGuard 2026 — Health Check Router.

Provides health, readiness, and liveness endpoints for container
orchestration (Kubernetes probes).
"""

from __future__ import annotations

import time
from datetime import datetime

from fastapi import APIRouter

from api.dependencies import get_model_registry

router = APIRouter(tags=["Health"])

_start_time = time.time()


@router.get("/health", response_model=dict)
async def health_check() -> dict:
    """Basic health check — is the service running?"""
    return {
        "status": "healthy",
        "service": "finguard",
        "timestamp": datetime.utcnow().isoformat(),
        "uptime_seconds": round(time.time() - _start_time, 1),
    }


@router.get("/readiness", response_model=dict)
async def readiness_check() -> dict:
    """Readiness check — are models loaded and ready to serve?"""
    registry = get_model_registry()

    if not registry.is_loaded:
        return {
            "status": "not_ready",
            "detail": "Models are still loading",
        }

    return {
        "status": "ready",
        "models_loaded": True,
        "device": registry.device,
    }
