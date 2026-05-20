"""
FinGuard 2026 — MLOps API Router.

Endpoints for model management, retraining triggers, and drift monitoring.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from api.middleware.auth import verify_api_key
from config.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1/mlops", tags=["MLOps"])


class RetrainRequest(BaseModel):
    models: list[str] = []  # Empty = retrain all
    force: bool = False


@router.get("/drift-status")
async def get_drift_status(_key: str = Depends(verify_api_key)):
    """Check current drift detection status."""
    from mlops.retraining_dag import RetrainingOrchestrator

    orch = RetrainingOrchestrator()
    alerts = orch._get_drift_alerts()
    return {
        "drift_detected": len(alerts) > 0,
        "num_alerts": len(alerts),
        "alerts": alerts[:10],
    }


@router.post("/retrain")
async def trigger_retrain(
    req: RetrainRequest,
    _key: str = Depends(verify_api_key),
):
    """Manually trigger model retraining."""
    from mlops.retraining_dag import RetrainingOrchestrator

    orch = RetrainingOrchestrator()
    result = orch.check_and_retrain()
    logger.info("manual_retrain_triggered", result=str(result)[:200])
    return result


@router.get("/serving-status")
async def get_serving_status(_key: str = Depends(verify_api_key)):
    """Get current model serving status (champion/challenger)."""
    from mlops.model_server import ModelServer

    server = ModelServer()
    return server.get_serving_status()


@router.get("/experiments")
async def list_experiments(_key: str = Depends(verify_api_key)):
    """List recent MLflow experiments."""
    try:
        from mlops.experiment_tracker import ExperimentTracker

        tracker = ExperimentTracker(experiment_name="finguard-default")
        return {"status": "mlflow_connected", "experiment": "finguard-default"}
    except Exception as e:
        return {"status": "mlflow_unavailable", "error": str(e)}
