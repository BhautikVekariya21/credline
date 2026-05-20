"""
FinGuard 2026 — Fraud Detection Router.

POST /api/v1/predict/fraud — Real-time fraud scoring endpoint.
"""

from __future__ import annotations

import time
import uuid
from typing import Optional

import torch
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from api.dependencies import get_model_registry, run_inference
from api.middleware.auth import verify_api_key
from config.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1/predict", tags=["Fraud Detection"])


# ─── Request/Response Models ───────────────────────────────────────────────

class FraudRequest(BaseModel):
    """Fraud prediction request payload."""
    transaction_id: str
    user_id: str
    merchant_id: str
    amount: float
    currency: str = "USD"
    timestamp: str
    device_id: str
    ip_address: str
    latitude: float = 0.0
    longitude: float = 0.0
    channel: str = "online"
    merchant_category: str = "other"

    # Optional biometric data
    gyroscope: Optional[list[list[float]]] = None
    accelerometer: Optional[list[list[float]]] = None
    keystroke_intervals: Optional[list[float]] = None


class FraudResponse(BaseModel):
    """Fraud prediction response."""
    decision_id: str = Field(..., description="Unique decision ID for audit trail")
    fraud_score: float = Field(..., ge=0, le=1, description="Fraud probability [0, 1]")
    risk_level: str = Field(..., description="low / medium / high / critical")
    graph_contribution: float = Field(default=0.0, description="Graph model weight")
    temporal_contribution: float = Field(default=0.0, description="Temporal model weight")
    biometric_contribution: float = Field(default=0.0, description="Biometric model weight")
    latency_ms: float = Field(..., description="Inference latency in milliseconds")


# ─── Endpoint ───────────────────────────────────────────────────────────────

@router.post("/fraud", response_model=FraudResponse)
async def predict_fraud(
    request: FraudRequest,
    _api_key: str = Depends(verify_api_key),
) -> FraudResponse:
    """
    Real-time fraud detection for a single transaction.
    Target latency: <150ms P99.
    """
    start = time.perf_counter()
    decision_id = f"FRD-{uuid.uuid4().hex[:12]}"
    registry = get_model_registry()

    def _run_inference() -> dict:
        with torch.no_grad():
            # Compute real-time features
            rt_features = registry.stream_processor.process({
                "user_id": request.user_id,
                "amount": request.amount,
                "timestamp": request.timestamp,
                "device_id": request.device_id,
                "ip_address": request.ip_address,
                "latitude": request.latitude,
                "longitude": request.longitude,
            })

            # Generate dummy graph embedding (in production, query from graph)
            graph_emb = torch.randn(1, 128)

            # Generate temporal embedding
            tx_features = torch.tensor([[
                request.amount / 10000,
                rt_features.get("tx_count_1h", 0) / 100,
                rt_features.get("amount_mean_1h", 0) / 10000,
                rt_features.get("amount_std_1h", 0) / 10000,
                rt_features.get("amount_zscore", 0),
                rt_features.get("geo_velocity_kmh", 0) / 1000,
                rt_features.get("device_user_count", 1) / 10,
                rt_features.get("ip_user_count", 1) / 10,
                rt_features.get("time_since_last_tx_sec", 0) / 3600,
                rt_features.get("tx_count_5m", 0) / 20,
                rt_features.get("amount_sum_1h", 0) / 100000,
                rt_features.get("min_time_between_tx_sec", 0) / 60,
            ]], dtype=torch.float32).unsqueeze(0)  # [1, 1, 12]

            temporal_out = registry.transformer_model(tx_features)
            temporal_emb = temporal_out["embedding"]

            # Biometric embedding
            if (request.gyroscope and request.accelerometer
                    and request.keystroke_intervals):
                import numpy as np
                gyro = torch.tensor(request.gyroscope, dtype=torch.float32).T.unsqueeze(0)
                accel = torch.tensor(request.accelerometer, dtype=torch.float32).T.unsqueeze(0)
                sensor = torch.cat([gyro, accel], dim=1)  # [1, 6, T]
                keys = torch.tensor(
                    request.keystroke_intervals[:32], dtype=torch.float32
                ).unsqueeze(0)
                if keys.shape[1] < 32:
                    keys = torch.nn.functional.pad(keys, (0, 32 - keys.shape[1]))
                bio_out = registry.biometric_model(sensor, keys)
                bio_emb = bio_out["embedding"]
            else:
                bio_emb = torch.zeros(1, 64)

            # Ensemble fusion
            result = registry.ensemble_model(graph_emb, temporal_emb, bio_emb)

            weights = result["attention_weights"][0].tolist()
            return {
                "fraud_score": result["fraud_score"].item(),
                "weights": weights,
            }

    result = await run_inference(_run_inference)
    elapsed_ms = (time.perf_counter() - start) * 1000

    fraud_score = result["fraud_score"]
    if fraud_score >= 0.9:
        risk_level = "critical"
    elif fraud_score >= 0.7:
        risk_level = "high"
    elif fraud_score >= 0.4:
        risk_level = "medium"
    else:
        risk_level = "low"

    weights = result["weights"]

    logger.info("fraud_prediction", decision_id=decision_id,
                fraud_score=round(fraud_score, 4), risk_level=risk_level,
                latency_ms=round(elapsed_ms, 1))

    return FraudResponse(
        decision_id=decision_id,
        fraud_score=round(fraud_score, 4),
        risk_level=risk_level,
        graph_contribution=round(weights[0], 4),
        temporal_contribution=round(weights[1], 4),
        biometric_contribution=round(weights[2], 4),
        latency_ms=round(elapsed_ms, 1),
    )
