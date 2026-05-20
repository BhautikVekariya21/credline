"""
FinGuard 2026 — Model Serving with Champion/Challenger (KServe-compatible).

Provides inference routing logic for shadow and A/B model testing.
Designed to work standalone or wrap into KServe/Seldon custom predictor.
"""

from __future__ import annotations

import time
from typing import Any

from config.logging_config import get_logger

logger = get_logger(__name__)


class ModelServer:
    """
    Model serving layer with champion/challenger routing.

    In production, this can be deployed as:
    - KServe InferenceService custom predictor
    - Seldon Core Python wrapper
    - Standalone FastAPI sub-service
    """

    def __init__(self) -> None:
        self._champion: dict[str, Any] = {}
        self._challengers: dict[str, dict[str, Any]] = {}
        self._traffic_split: dict[str, float] = {}  # challenger → % of traffic

    def register_champion(self, model_name: str, model: Any, version: str) -> None:
        self._champion[model_name] = {
            "model": model,
            "version": version,
            "registered_at": time.time(),
        }
        logger.info("champion_registered", model=model_name, version=version)

    def register_challenger(
        self, model_name: str, model: Any, version: str, traffic_pct: float = 0.1
    ) -> None:
        self._challengers[model_name] = {
            "model": model,
            "version": version,
            "traffic_pct": traffic_pct,
            "registered_at": time.time(),
        }
        self._traffic_split[model_name] = traffic_pct
        logger.info(
            "challenger_registered",
            model=model_name,
            version=version,
            traffic=traffic_pct,
        )

    def predict(
        self, model_name: str, inputs: Any, shadow: bool = False
    ) -> dict[str, Any]:
        """
        Route prediction to champion or challenger.

        If shadow=True, always run both and log challenger output
        without returning it to the caller.
        """
        import random

        start = time.time()

        # Champion prediction (always runs)
        champion_info = self._champion.get(model_name)
        if champion_info is None:
            return {"error": f"No champion model registered for {model_name}"}

        champion_result = self._run_model(champion_info["model"], inputs)

        result = {
            "prediction": champion_result,
            "model_version": champion_info["version"],
            "served_by": "champion",
            "latency_ms": round((time.time() - start) * 1000, 2),
        }

        # Challenger — shadow or A/B traffic split
        challenger_info = self._challengers.get(model_name)
        if challenger_info:
            should_route = shadow or (
                random.random() < challenger_info.get("traffic_pct", 0)
            )
            if should_route:
                challenger_result = self._run_model(
                    challenger_info["model"], inputs
                )
                if shadow:
                    # Log but don't return
                    logger.info(
                        "shadow_prediction",
                        model=model_name,
                        champion=str(champion_result)[:100],
                        challenger=str(challenger_result)[:100],
                    )
                    result["shadow_prediction"] = challenger_result
                    result["shadow_version"] = challenger_info["version"]
                else:
                    # A/B: return challenger result
                    result["prediction"] = challenger_result
                    result["model_version"] = challenger_info["version"]
                    result["served_by"] = "challenger"

        return result

    @staticmethod
    def _run_model(model: Any, inputs: Any) -> Any:
        """Execute model inference."""
        if hasattr(model, "predict"):
            return model.predict(inputs)
        elif callable(model):
            return model(inputs)
        return None

    def get_serving_status(self) -> dict[str, Any]:
        return {
            "champions": {
                k: {"version": v["version"]}
                for k, v in self._champion.items()
            },
            "challengers": {
                k: {"version": v["version"], "traffic": v.get("traffic_pct", 0)}
                for k, v in self._challengers.items()
            },
        }
