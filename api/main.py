"""
FinGuard 2026 — FastAPI Application Entry Point.

Production-grade API gateway serving fraud detection and credit scoring
predictions. Models are loaded once at startup via the lifespan context.

Target: <150ms P99 latency for inference endpoints.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from api.dependencies import get_model_registry
from api.middleware.rate_limiter import RateLimiterMiddleware
from api.routers import (
    agent, credit, credit_engine, direct, explain, fraud, health,
    mlops, quantum, regulator, security, services, soar, database_link,
)
from config.logging_config import get_logger, setup_logging
from config.settings import get_settings

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan: load models at startup, cleanup at shutdown.

    This ensures models are loaded ONCE and resident in memory
    for the entire lifetime of the application.
    """
    setup_logging(
        log_level=get_settings().app.log_level,
        json_format=get_settings().app.is_production,
    )
    logger.info("finguard_starting", env=get_settings().app.env.value)

    # Load all models at startup
    registry = get_model_registry()
    registry.load_all()

    logger.info("finguard_ready", port=get_settings().api.port)
    yield

    # Cleanup
    logger.info("finguard_shutting_down")


# ─── Application Factory ───────────────────────────────────────────────────

def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="FinGuard 2026",
        description=(
            "Autonomous Fraud Prevention & Inclusive Credit Scoring API. "
            "Real-time fraud detection using Graph Neural Networks, "
            "Temporal Fusion Transformers, and Behavioral Biometrics. "
            "Alternative credit scoring for unbanked populations."
        ),
        version="1.0.0",
        docs_url="/docs" if not settings.app.is_production else None,
        redoc_url="/redoc" if not settings.app.is_production else None,
        lifespan=lifespan,
    )

    # ─── Middleware ─────────────────────────────────────────────────────
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if not settings.app.is_production else [],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(
        RateLimiterMiddleware,
        requests_per_minute=settings.api.rate_limit_rpm,
    )

    # Circuit breaker: auto-fallback to XGBoost when GNN latency > 300ms
    from security.circuit_breaker import CircuitBreakerMiddleware
    app.add_middleware(CircuitBreakerMiddleware)

    # ─── Routers ────────────────────────────────────────────────────────
    app.include_router(health.router)
    app.include_router(direct.router)
    app.include_router(fraud.router)
    app.include_router(credit.router)
    app.include_router(explain.router)
    app.include_router(services.router)
    app.include_router(agent.router)
    app.include_router(mlops.router)
    app.include_router(security.router)
    app.include_router(soar.router)
    app.include_router(regulator.router)
    app.include_router(credit_engine.router)
    app.include_router(quantum.router)
    app.include_router(database_link.router)


    # Phase 10: Core Transaction Engine
    from core_engine.transaction_controller import router as core_router
    app.include_router(core_router)

    # Phase 11: Autonomous Compliance & Tax
    from compliance.compliance_router import router as compliance_router, compat_router as compliance_compat_router
    app.include_router(compliance_router)
    app.include_router(compliance_compat_router)


    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "api.main:app",
        host=settings.api.host,
        port=settings.api.port,
        workers=settings.api.workers,
        log_level=settings.app.log_level.lower(),
    )
