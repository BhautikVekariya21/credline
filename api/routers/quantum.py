"""
FinGuard 2026 — Quantum Security & Resilience API Router.

Endpoints for:
  - Post-Quantum Cryptography (encrypt/decrypt PII, sign/verify actions)
  - Data Sovereignty (geo-routing, regional compliance check)
  - Disaster Recovery (panic button, region evacuation, reconciliation)
  - Multi-cloud status
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.middleware.auth import verify_api_key
from config.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1/quantum", tags=["Quantum Security & Resilience"])


# ─── Request Models ───────────────────────────────────────────────────

class EncryptPIIRequest(BaseModel):
    user_id: str
    field_name: str
    plaintext: str


class SignActionRequest(BaseModel):
    investigation_id: str
    agent: str
    action: str
    data: dict[str, Any] = {}


class EvacuateRequest(BaseModel):
    from_region: str
    to_region: str | None = None
    reason: str = "manual_trigger"


class SovereigntyCheckRequest(BaseModel):
    user_id: str | None = None
    ip_address: str | None = None
    explicit_region: str | None = None


class StorePIIRequest(BaseModel):
    user_id: str
    pii_data: dict[str, Any]
    region: str | None = None


# ─── PQC Encryption ──────────────────────────────────────────────────

@router.get("/pqc/status")
async def get_pqc_status(_key: str = Depends(verify_api_key)):
    """Get Post-Quantum Cryptography engine status."""
    from quantum.pqc_engine import PQCEngine
    engine = PQCEngine()
    engine.initialize_keys()
    return engine.get_status()


@router.post("/pqc/encrypt")
async def encrypt_pii_field(
    req: EncryptPIIRequest,
    _key: str = Depends(verify_api_key),
):
    """Encrypt a PII field using ML-KEM (Kyber-768) hybrid encryption."""
    from quantum.pqc_engine import PQCEngine
    engine = PQCEngine()
    engine.initialize_keys()
    encrypted = engine.encrypt_pii(req.plaintext)
    return {
        "user_id": req.user_id,
        "field_name": req.field_name,
        "encrypted": encrypted,
        "algorithm": "Hybrid ECC + ML-KEM-768",
    }


@router.post("/pqc/sign")
async def sign_agent_action(
    req: SignActionRequest,
    _key: str = Depends(verify_api_key),
):
    """Sign a SOAR agent action with ML-DSA (Dilithium3) for tamper-proof audit."""
    from quantum.pqc_engine import PQCEngine
    engine = PQCEngine()
    engine.initialize_keys()

    action_data = {
        "investigation_id": req.investigation_id,
        "agent": req.agent,
        "action": req.action,
        "data": req.data,
    }

    signature = engine.sign_action(action_data)
    verified = engine.verify_action(action_data, signature)

    return {
        "signed": True,
        "verified": verified,
        "signature_info": signature,
        "algorithm": "ML-DSA-65 (Dilithium3)",
    }


# ─── Data Sovereignty ────────────────────────────────────────────────

@router.post("/sovereignty/resolve-region")
async def resolve_data_region(
    req: SovereigntyCheckRequest,
    _key: str = Depends(verify_api_key),
):
    """Resolve the data sovereignty region for a user/request."""
    from quantum.data_sovereignty import (
        GeoRouter, REGION_COMPLIANCE,
    )

    region = GeoRouter.resolve_region(
        user_id=req.user_id,
        ip_address=req.ip_address,
        explicit_region=req.explicit_region,
    )

    compliance = REGION_COMPLIANCE[region]
    return {
        "resolved_region": region.value,
        "compliance_framework": compliance["law"],
        "authority": compliance["authority"],
        "pii_localization_required": compliance["pii_localization"],
        "cross_border_allowed": compliance["cross_border_allowed"],
        "encryption_required": compliance["encryption_required"],
        "retention_years": compliance["retention_years"],
    }


@router.post("/sovereignty/store-pii")
async def store_sovereign_pii(
    req: StorePIIRequest,
    _key: str = Depends(verify_api_key),
):
    """Store PII in the correct geo-fenced regional shard."""
    from quantum.data_sovereignty import (
        DataRegion, SovereignShardManager,
    )

    manager = SovereignShardManager()

    region = None
    if req.region:
        for r in DataRegion:
            if r.value == req.region:
                region = r
                break

    result = manager.store_pii(req.user_id, req.pii_data, region)
    return result


@router.get("/sovereignty/transfer-check")
async def check_cross_border_transfer(
    from_region: str,
    to_region: str,
    _key: str = Depends(verify_api_key),
):
    """Check if data can be transferred between two regions."""
    from quantum.data_sovereignty import DataRegion, SovereignShardManager

    manager = SovereignShardManager()

    fr = None
    tr = None
    for r in DataRegion:
        if r.value == from_region:
            fr = r
        if r.value == to_region:
            tr = r

    if not fr or not tr:
        raise HTTPException(400, "Invalid region codes")

    return manager.can_transfer(fr, tr)


# ─── Disaster Recovery ───────────────────────────────────────────────

@router.post("/disaster-recovery/evacuate")
async def evacuate_region(
    req: EvacuateRequest,
    _key: str = Depends(verify_api_key),
):
    """
    PANIC BUTTON: Evacuate an entire cloud region.

    Drains traffic, syncs state, reroutes DNS, and verifies health
    on the target region. Target: < 5 minutes total.
    """
    from quantum.disaster_recovery import ClusterRegion, RegionEvacuator

    evacuator = RegionEvacuator()

    fr = None
    tr = None
    for r in ClusterRegion:
        if r.value == req.from_region:
            fr = r
        if req.to_region and r.value == req.to_region:
            tr = r

    if not fr:
        raise HTTPException(400, f"Unknown region: {req.from_region}")

    result = evacuator.evacuate(fr, tr, req.reason)

    logger.warning("PANIC_BUTTON_PRESSED",
                    from_r=req.from_region,
                    to_r=req.to_region,
                    reason=req.reason)
    return result


@router.get("/disaster-recovery/status")
async def get_dr_status(_key: str = Depends(verify_api_key)):
    """Get disaster recovery and failover pair status."""
    from quantum.disaster_recovery import RegionEvacuator
    evacuator = RegionEvacuator()
    return evacuator.get_status()


@router.post("/disaster-recovery/reconcile")
async def reconcile_state(
    source: str,
    target: str,
    _key: str = Depends(verify_api_key),
):
    """Reconcile Neo4j + Feast + Audit state between two regions."""
    from quantum.disaster_recovery import ClusterRegion, StateReconciler

    sr = None
    tr = None
    for r in ClusterRegion:
        if r.value == source:
            sr = r
        if r.value == target:
            tr = r

    if not sr or not tr:
        raise HTTPException(400, "Invalid region codes")

    reconciler = StateReconciler()
    return reconciler.reconcile(sr, tr)
