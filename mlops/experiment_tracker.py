"""
FinGuard 2026 — MLflow Experiment Tracking.

Tracks hyperparameters, loss curves, SHAP artifacts, and model
checkpoints for all model variants (GraphSAGE, XGBoost, Ensemble).
Falls back to local file logging when MLflow server is unavailable.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

from config.logging_config import get_logger

logger = get_logger(__name__)

# ─── MLflow Wrapper ──────────────────────────────────────────────────────────


class ExperimentTracker:
    """
    Unified experiment tracker using MLflow.

    Provides methods to log params, metrics, artifacts, and models
    with automatic fallback to local JSON logging.
    """

    def __init__(
        self,
        tracking_uri: str = "http://localhost:5000",
        experiment_name: str = "finguard-default",
    ):
        self.tracking_uri = tracking_uri
        self.experiment_name = experiment_name
        self._mlflow = None
        self._run = None
        self._fallback_dir = Path("artifacts/mlflow_fallback")
        self._fallback_dir.mkdir(parents=True, exist_ok=True)
        self._init_mlflow()

    def _init_mlflow(self) -> None:
        try:
            import mlflow

            mlflow.set_tracking_uri(self.tracking_uri)
            mlflow.set_experiment(self.experiment_name)
            self._mlflow = mlflow
            logger.info(
                "mlflow_connected",
                uri=self.tracking_uri,
                experiment=self.experiment_name,
            )
        except Exception as e:
            logger.warning(
                "mlflow_unavailable",
                error=str(e),
                msg="Using local fallback tracking",
            )

    # ─── Run Management ──────────────────────────────────────────────────

    def start_run(self, run_name: str, tags: dict[str, str] | None = None) -> str:
        """Start a new tracking run. Returns run_id."""
        if self._mlflow:
            self._run = self._mlflow.start_run(run_name=run_name, tags=tags or {})
            run_id = self._run.info.run_id
        else:
            run_id = f"local-{int(time.time())}"
        logger.info("experiment_run_started", run_id=run_id, name=run_name)
        return run_id

    def end_run(self) -> None:
        if self._mlflow and self._run:
            self._mlflow.end_run()
            self._run = None

    # ─── Logging ─────────────────────────────────────────────────────────

    def log_params(self, params: dict[str, Any]) -> None:
        if self._mlflow:
            self._mlflow.log_params(
                {k: str(v) for k, v in params.items()}
            )
        else:
            self._local_log("params", params)

    def log_metrics(self, metrics: dict[str, float], step: int | None = None) -> None:
        if self._mlflow:
            self._mlflow.log_metrics(metrics, step=step)
        else:
            self._local_log("metrics", {**metrics, "_step": step})

    def log_artifact(self, local_path: str, artifact_path: str = "") -> None:
        if self._mlflow:
            self._mlflow.log_artifact(local_path, artifact_path)
        else:
            logger.info("artifact_logged_locally", path=local_path)

    def log_model_checkpoint(
        self,
        model_name: str,
        checkpoint_path: str,
        metrics: dict[str, float] | None = None,
    ) -> None:
        """Log a model checkpoint with optional metrics."""
        if self._mlflow:
            self._mlflow.log_artifact(checkpoint_path, f"checkpoints/{model_name}")
            if metrics:
                self._mlflow.log_metrics(
                    {f"{model_name}/{k}": v for k, v in metrics.items()}
                )
        logger.info(
            "model_checkpoint_logged",
            model=model_name,
            path=checkpoint_path,
        )

    def log_shap_summary(
        self, model_name: str, shap_values: Any, feature_names: list[str]
    ) -> None:
        """Log SHAP summary plot and values as artifacts."""
        import numpy as np

        summary_path = self._fallback_dir / f"{model_name}_shap_summary.json"
        if hasattr(shap_values, "tolist"):
            vals = shap_values.tolist()
        elif isinstance(shap_values, np.ndarray):
            vals = shap_values.tolist()
        else:
            vals = list(shap_values)

        summary = {"model": model_name, "feature_names": feature_names, "mean_abs_shap": vals}
        summary_path.write_text(json.dumps(summary, indent=2))
        self.log_artifact(str(summary_path), f"shap/{model_name}")
        logger.info("shap_logged", model=model_name)

    # ─── Model Registration ─────────────────────────────────────────────

    def register_model(
        self,
        model_name: str,
        run_id: str,
        model_uri: str | None = None,
        stage: str = "Staging",
    ) -> str:
        """Register a model version in the MLflow Model Registry."""
        if self._mlflow:
            try:
                from mlflow.tracking import MlflowClient

                client = MlflowClient()
                uri = model_uri or f"runs:/{run_id}/checkpoints/{model_name}"
                result = self._mlflow.register_model(uri, model_name)
                client.transition_model_version_stage(
                    name=model_name,
                    version=result.version,
                    stage=stage,
                )
                logger.info(
                    "model_registered",
                    name=model_name,
                    version=result.version,
                    stage=stage,
                )
                return result.version
            except Exception as e:
                logger.warning("model_registration_failed", error=str(e))
        return "local-0"

    # ─── Local Fallback ──────────────────────────────────────────────────

    def _local_log(self, category: str, data: dict) -> None:
        path = self._fallback_dir / f"{category}_{int(time.time())}.json"
        path.write_text(json.dumps(data, indent=2, default=str))
