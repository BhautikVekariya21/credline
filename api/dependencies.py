"""
FinGuard 2026 — API Dependency Injection.

Manages singleton model loading, feature store clients, and
thread pool for CPU-bound inference. Models are loaded ONCE
at startup and shared across all requests.
"""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path
from typing import Any

import torch

from config.logging_config import get_logger
from config.settings import get_settings

logger = get_logger(__name__)


class ModelRegistry:
    """
    Singleton registry holding all loaded models.
    Loaded once at application startup via FastAPI lifespan.
    """

    def __init__(self) -> None:
        self.graph_model: Any = None
        self.transformer_model: Any = None
        self.biometric_model: Any = None
        self.ensemble_model: Any = None
        self.credit_scorer: Any = None
        self.explainer: Any = None
        self.stream_processor: Any = None
        self.device: str = "cpu"
        self._loaded = False

    def load_all(self, checkpoint_dir: str | None = None) -> None:
        """Load all models from checkpoints or initialize fresh."""
        settings = get_settings()
        self.device = settings.model.device
        ckpt_dir = Path(checkpoint_dir or settings.model.checkpoint_dir)

        logger.info("loading_models", device=self.device,
                    checkpoint_dir=str(ckpt_dir))

        # Import model classes
        from models.graph.fraud_graphsage import FraudGraphSAGE
        from models.temporal.transaction_transformer import TransactionTransformer
        from models.biometric.biometric_head import BiometricHead
        from models.ensemble.fin_model import FinModel
        from models.credit.thin_file_xgboost import ThinFileScorer
        from ingestion.stream_processor import RealTimeFeatureComputer

        # Initialize models (load checkpoints if available)
        self.graph_model = FraudGraphSAGE(
            in_channels=21,  # 16 base + 5 topological
            hidden_channels=settings.model.graph_hidden,
            num_layers=settings.model.graph_layers,
        ).to(self.device)

        self.transformer_model = TransactionTransformer(
            num_features=12,
            d_model=settings.model.transformer_d_model,
            nhead=settings.model.transformer_nhead,
            num_encoder_layers=settings.model.transformer_layers,
            max_seq_len=settings.model.max_seq_len,
        ).to(self.device)

        self.biometric_model = BiometricHead().to(self.device)
        self.ensemble_model = FinModel().to(self.device)

        # Load checkpoints if they exist
        for name, model in [
            ("graphsage", self.graph_model),
            ("transformer", self.transformer_model),
            ("biometric", self.biometric_model),
            ("ensemble", self.ensemble_model),
        ]:
            ckpt_path = ckpt_dir / f"{name}_best.pt"
            if ckpt_path.exists():
                try:
                    ckpt = torch.load(ckpt_path, map_location=self.device,
                                     weights_only=True)
                    model.load_state_dict(ckpt["model_state_dict"])
                    logger.info("checkpoint_loaded", model=name,
                               epoch=ckpt.get("epoch"))
                except Exception as e:
                    logger.warning("checkpoint_load_failed", model=name,
                                 error=str(e))

        # Set all models to eval mode
        for model in [self.graph_model, self.transformer_model,
                      self.biometric_model, self.ensemble_model]:
            model.eval()

        # XGBoost credit scorer
        self.credit_scorer = ThinFileScorer()
        xgb_path = ckpt_dir / "xgb_model.json"
        if xgb_path.parent.exists():
            try:
                self.credit_scorer.load(str(ckpt_dir))
                logger.info("xgboost_loaded")
            except Exception:
                logger.warning("xgboost_not_loaded",
                             msg="Using untrained scorer")

        # Stream processor
        self.stream_processor = RealTimeFeatureComputer()

        self._loaded = True
        logger.info("all_models_loaded")

    @property
    def is_loaded(self) -> bool:
        return self._loaded


# ─── Singleton instances ────────────────────────────────────────────────────

_registry: ModelRegistry | None = None
_thread_pool: ThreadPoolExecutor | None = None


def get_model_registry() -> ModelRegistry:
    """Get the singleton model registry."""
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
    return _registry


def get_thread_pool() -> ThreadPoolExecutor:
    """Get thread pool for CPU-bound inference."""
    global _thread_pool
    if _thread_pool is None:
        _thread_pool = ThreadPoolExecutor(max_workers=4)
    return _thread_pool


async def run_inference(fn: Any, *args: Any) -> Any:
    """Run a blocking inference function in the thread pool."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(get_thread_pool(), fn, *args)
