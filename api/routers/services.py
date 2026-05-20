"""
FinGuard 2026 — Service API Routers.

Exposes the five deep-backend services via REST endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Any, Optional

from api.middleware.auth import verify_api_key
from config.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1/services", tags=["Services"])


# ─── Request/Response Models ───────────────────────────────────────────────

class BiometricAnalysisRequest(BaseModel):
    user_id: str
    session_id: str
    keystroke_intervals: list[float] = []
    key_hold_durations: list[float] = []
    screen_touch_pressure: list[float] = []
    scroll_velocity: list[float] = []
    gyroscope: list[list[float]] = []
    accelerometer: list[list[float]] = []
    screen_transitions: int = 0


class GraphAnalysisRequest(BaseModel):
    user_id: str
    max_hops: int = 3


class ReasonMemoRequest(BaseModel):
    decision_id: str
    decision_type: str = "fraud"
    scores: dict[str, float] = {}
    feature_impacts: dict[str, float] = {}


class ZKPCreateRequest(BaseModel):
    identity_data: dict[str, str]


class ZKPVerifyRequest(BaseModel):
    proof: dict[str, Any]
    claimed_data: dict[str, str]


# ─── Service A: Biometrics ──────────────────────────────────────────────────

@router.post("/biometrics/analyze")
async def analyze_biometrics(
    req: BiometricAnalysisRequest,
    _key: str = Depends(verify_api_key),
) -> dict:
    from services.biometrics_engine import BehavioralBiometricsEngine
    engine = BehavioralBiometricsEngine()
    result = engine.analyze_session(req.user_id, req.model_dump())
    logger.info("biometric_analysis", user_id=req.user_id,
                is_anomalous=result["is_anomalous"])
    return result


# ─── Service B: Graph Intelligence ──────────────────────────────────────────

@router.post("/graph/analyze")
async def analyze_graph(
    req: GraphAnalysisRequest,
    _key: str = Depends(verify_api_key),
) -> dict:
    from services.graph_intelligence import GraphIntelligenceService
    service = GraphIntelligenceService()
    return service.analyze_user(req.user_id)


@router.get("/graph/cycles")
async def detect_cycles(_key: str = Depends(verify_api_key)) -> list:
    from services.graph_intelligence import GraphIntelligenceService
    return GraphIntelligenceService().run_cycle_scan()


# ─── Service C: Credit Underwriter ──────────────────────────────────────────

@router.post("/credit/underwrite")
async def underwrite_credit(
    features: dict[str, Any],
    _key: str = Depends(verify_api_key),
) -> dict:
    from services.credit_underwriter import CreditUnderwriterService
    return CreditUnderwriterService().underwrite(features)


# ─── Service D: Governance ──────────────────────────────────────────────────

@router.post("/governance/reason-memo")
async def create_reason_memo(
    req: ReasonMemoRequest,
    _key: str = Depends(verify_api_key),
) -> dict:
    from services.governance import ReasonMemoGenerator
    gen = ReasonMemoGenerator()
    return gen.generate(req.decision_id, req.decision_type, req.scores, req.feature_impacts)


@router.post("/governance/zkp/create")
async def create_zkp(
    req: ZKPCreateRequest,
    _key: str = Depends(verify_api_key),
) -> dict:
    from services.governance import ZKPVerifier
    return ZKPVerifier().create_identity_proof(req.identity_data)


@router.post("/governance/zkp/verify")
async def verify_zkp(
    req: ZKPVerifyRequest,
    _key: str = Depends(verify_api_key),
) -> dict:
    from services.governance import ZKPVerifier
    return ZKPVerifier().verify_identity(req.proof, req.claimed_data)


# ─── Service E: Adversarial ─────────────────────────────────────────────────

@router.post("/adversarial/test")
async def adversarial_test(
    n_samples: int = 100,
    _key: str = Depends(verify_api_key),
) -> dict:
    from services.adversarial_defense import AdversarialDefenseService
    return AdversarialDefenseService().run_adversarial_test(None, n_samples)
