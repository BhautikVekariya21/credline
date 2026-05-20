"""
FinGuard 2026 — Security & Edge API Router.

Endpoints for:
  - Edge biometric verification (behavioral vector upload)
  - Circuit breaker status and kill switch
  - Adversarial robustness testing
  - Graph poisoning scans
  - ZKP creditworthiness verification
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.middleware.auth import verify_api_key
from config.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1", tags=["Security & Edge"])


# ─── Request / Response Models ─────────────────────────────────────────

class EdgeVerifyRequest(BaseModel):
    user_id: str
    encrypted_payload: str


class KillSwitchRequest(BaseModel):
    action: str  # "trip" or "close"
    reason: str = ""


class ZKPCreditRequest(BaseModel):
    user_id: str
    alternative_data: dict[str, float]
    thresholds: dict[str, float] | None = None


class AdversarialTestRequest(BaseModel):
    attack_type: str = "all"  # "fgsm", "pgd", "cw", "deepfool", "all"
    epsilon: float = 0.05
    num_samples: int = 100


# ─── Edge Biometric Verification ──────────────────────────────────────

@router.post("/edge/verify")
async def verify_behavioral_vector(
    req: EdgeVerifyRequest,
    _key: str = Depends(verify_api_key),
):
    """Verify an encrypted behavioral vector from the edge WASM model."""
    from edge.behavioral_vector import BehavioralVectorProcessor

    processor = BehavioralVectorProcessor()
    result = processor.verify_and_process(req.user_id, req.encrypted_payload)

    logger.info("edge_verify",
                user_id=req.user_id,
                status=result.get("status"),
                trust=result.get("trust_score"))
    return result


# ─── Circuit Breaker / Kill Switch ────────────────────────────────────

@router.get("/circuit-breaker/status")
async def get_circuit_status(_key: str = Depends(verify_api_key)):
    """Get current circuit breaker state."""
    from security.circuit_breaker import get_circuit_breaker

    cb = get_circuit_breaker()
    return cb.get_status()


@router.post("/circuit-breaker/kill-switch")
async def kill_switch(
    req: KillSwitchRequest,
    _key: str = Depends(verify_api_key),
):
    """Manually trip or close the circuit breaker."""
    from security.circuit_breaker import get_circuit_breaker

    cb = get_circuit_breaker()
    if req.action == "trip":
        cb.force_trip()
        return {"status": "tripped", "reason": req.reason, "state": cb.state.value}
    elif req.action == "close":
        cb.force_close()
        return {"status": "closed", "reason": req.reason, "state": cb.state.value}
    else:
        raise HTTPException(400, detail="action must be 'trip' or 'close'")


# ─── ZKP Credit Verification ──────────────────────────────────────────

@router.post("/zkp/verify-creditworthiness")
async def verify_creditworthiness(
    req: ZKPCreditRequest,
    _key: str = Depends(verify_api_key),
):
    """
    Verify creditworthiness using Zero-Knowledge Proofs.
    The server NEVER sees raw utility/telco data.
    """
    from security.zkp_engine import ZeroKnowledgeProofEngine

    engine = ZeroKnowledgeProofEngine()
    proof = engine.prove_creditworthiness(
        user_id=req.user_id,
        alternative_data=req.alternative_data,
        thresholds=req.thresholds,
    )

    return {
        "proof_id": proof.proof_id,
        "user_id": proof.user_id,
        "overall_verified": proof.overall_verified,
        "attributes_verified": proof.attributes_verified,
        "min_required": proof.min_attributes_required,
        "attribute_results": [
            {
                "name": p.attribute_name,
                "type": p.proof_type,
                "verified": p.verified,
            }
            for p in proof.attribute_proofs
        ],
        "verification_method": proof.verification_method,
    }


# ─── Adversarial Robustness ──────────────────────────────────────────

@router.post("/adversarial/test")
async def run_adversarial_test(
    req: AdversarialTestRequest,
    _key: str = Depends(verify_api_key),
):
    """Run adversarial attack simulations against the fraud model."""
    import torch
    import torch.nn as nn

    from security.adversarial_simulator import AdversarialAttackSimulator

    # Use a proxy model for testing (in production: load actual model)
    model = nn.Sequential(nn.Linear(12, 64), nn.ReLU(), nn.Linear(64, 1))
    simulator = AdversarialAttackSimulator(model)

    x = torch.randn(req.num_samples, 12).clamp(0, 1)
    y = torch.randint(0, 2, (req.num_samples, 1)).float()

    if req.attack_type == "all":
        results = simulator.run_full_suite(x, y, req.epsilon)
        return {
            "suite": {
                name: {
                    "evasion_rate": round(r.evasion_rate, 4),
                    "robustness_score": round(r.robustness_score, 4),
                    "mean_l2_perturbation": round(r.mean_perturbation_l2, 6),
                    "execution_time_ms": round(r.execution_time_ms, 1),
                }
                for name, r in results.items()
            }
        }

    attack_fn = getattr(simulator, f"{req.attack_type}_attack", None)
    if not attack_fn:
        raise HTTPException(400, detail=f"Unknown attack: {req.attack_type}")

    _, result = attack_fn(x, y, epsilon=req.epsilon)
    return {
        "attack": result.attack_type,
        "evasion_rate": round(result.evasion_rate, 4),
        "robustness_score": round(result.robustness_score, 4),
        "mean_l2_perturbation": round(result.mean_perturbation_l2, 6),
    }


# ─── Graph Poisoning ─────────────────────────────────────────────────

@router.post("/graph/poisoning-scan")
async def scan_graph_poisoning(_key: str = Depends(verify_api_key)):
    """Run a graph poisoning detection scan."""
    import time as time_mod
    from security.graph_poisoning import GraphPoisoningDetector

    detector = GraphPoisoningDetector()

    # Mock graph data (in production: pull from Neo4j)
    now = time_mod.time()
    nodes = [
        {"id": f"USR-{i:04d}", "created_at": now - 86400 * (30 - i), "features": [0.5] * 8}
        for i in range(20)
    ] + [
        # Suspicious burst of new accounts
        {"id": f"SYBIL-{i:02d}", "created_at": now - 3600, "features": [0.5] * 8}
        for i in range(8)
    ]
    edges = [
        {"source": f"SYBIL-{i:02d}", "target": "USR-0001"}
        for i in range(8)
    ]

    alerts = detector.scan_for_poisoning(nodes, edges)
    return {
        "scan_complete": True,
        "alerts_found": len(alerts),
        "alerts": [
            {
                "id": a.alert_id,
                "severity": a.severity,
                "method": a.detection_method,
                "target": a.target_node,
                "suspicious_nodes": a.suspicious_nodes[:5],
                "confidence": round(a.confidence, 4),
            }
            for a in alerts
        ],
    }
