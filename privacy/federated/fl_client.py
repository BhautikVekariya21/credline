"""
FinGuard 2026 — Flower Federated Learning Client.

Wraps the FinModel training loop as a Flower ClientApp for
federated learning across multiple bank institutions.
No raw data leaves the client — only model parameter updates.
"""

from __future__ import annotations

from collections import OrderedDict
from typing import Any

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from config.logging_config import get_logger
from privacy.federated.fl_config import FLConfig

logger = get_logger(__name__)


def get_parameters(model: nn.Module) -> list[np.ndarray]:
    """Extract model parameters as numpy arrays for Flower."""
    return [val.cpu().numpy() for _, val in model.state_dict().items()]


def set_parameters(model: nn.Module, parameters: list[np.ndarray]) -> None:
    """Set model parameters from numpy arrays received from Flower."""
    params_dict = zip(model.state_dict().keys(), parameters)
    state_dict = OrderedDict({k: torch.tensor(v) for k, v in params_dict})
    model.load_state_dict(state_dict, strict=True)


class FinGuardClient:
    """
    Flower-compatible federated learning client for FinGuard.

    Each client represents a bank/institution that:
    1. Receives global model parameters from the server
    2. Trains on its local (private) transaction data
    3. Returns only model updates (no raw data)
    4. Optionally adds differential privacy noise
    """

    def __init__(self, model: nn.Module, train_loader: DataLoader,
                 val_loader: DataLoader | None = None,
                 config: FLConfig | None = None, device: str = "cpu"):
        self.model = model.to(device)
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.config = config or FLConfig()
        self.device = device

    def fit(self, parameters: list[np.ndarray],
            config: dict[str, Any]) -> tuple[list[np.ndarray], int, dict]:
        """
        Train on local data and return updated parameters.

        Args:
            parameters: Global model parameters from server.
            config: Training configuration from server.

        Returns:
            Tuple of (updated_parameters, num_samples, metrics).
        """
        set_parameters(self.model, parameters)
        self.model.train()

        epochs = config.get("local_epochs", self.config.local_epochs)
        lr = config.get("lr", self.config.local_learning_rate)

        optimizer = torch.optim.AdamW(self.model.parameters(), lr=lr)
        criterion = nn.BCEWithLogitsLoss()

        total_loss = 0.0
        num_samples = 0

        for epoch in range(epochs):
            for batch in self.train_loader:
                # Unpack batch (flexible format)
                if len(batch) == 5:
                    g_emb, t_emb, b_emb, fraud_y, _ = batch
                else:
                    continue

                g_emb = g_emb.to(self.device)
                t_emb = t_emb.to(self.device)
                b_emb = b_emb.to(self.device)
                fraud_y = fraud_y.to(self.device)

                optimizer.zero_grad()
                out = self.model(g_emb, t_emb, b_emb)
                loss = criterion(out["fraud_logit"], fraud_y)
                loss.backward()

                # Gradient clipping (also supports DP)
                if self.config.use_differential_privacy:
                    torch.nn.utils.clip_grad_norm_(
                        self.model.parameters(),
                        self.config.dp_max_grad_norm,
                    )

                optimizer.step()
                total_loss += loss.item() * fraud_y.size(0)
                num_samples += fraud_y.size(0)

        avg_loss = total_loss / max(num_samples, 1)
        logger.info("fl_client_fit", epochs=epochs, loss=avg_loss,
                    samples=num_samples)

        # Add DP noise if configured
        updated_params = get_parameters(self.model)
        if self.config.use_differential_privacy:
            updated_params = self._add_dp_noise(updated_params)

        return updated_params, num_samples, {"loss": avg_loss}

    def evaluate(self, parameters: list[np.ndarray],
                 config: dict[str, Any]) -> tuple[float, int, dict]:
        """Evaluate global model on local validation data."""
        set_parameters(self.model, parameters)
        self.model.eval()

        if self.val_loader is None:
            return 0.0, 0, {}

        total_loss = 0.0
        correct = 0
        total = 0
        criterion = nn.BCEWithLogitsLoss()

        with torch.no_grad():
            for batch in self.val_loader:
                if len(batch) == 5:
                    g_emb, t_emb, b_emb, fraud_y, _ = batch
                else:
                    continue

                g_emb = g_emb.to(self.device)
                t_emb = t_emb.to(self.device)
                b_emb = b_emb.to(self.device)
                fraud_y = fraud_y.to(self.device)

                out = self.model(g_emb, t_emb, b_emb)
                loss = criterion(out["fraud_logit"], fraud_y)
                total_loss += loss.item() * fraud_y.size(0)

                preds = (out["fraud_score"] > 0.5).float()
                correct += (preds == fraud_y).sum().item()
                total += fraud_y.size(0)

        avg_loss = total_loss / max(total, 1)
        accuracy = correct / max(total, 1)

        logger.info("fl_client_evaluate", loss=avg_loss, accuracy=accuracy,
                    samples=total)

        return avg_loss, total, {"accuracy": accuracy}

    def _add_dp_noise(self, parameters: list[np.ndarray]) -> list[np.ndarray]:
        """Add calibrated Gaussian noise for differential privacy."""
        noisy = []
        for param in parameters:
            noise = np.random.normal(
                0, self.config.dp_noise_multiplier, size=param.shape
            ).astype(param.dtype)
            noisy.append(param + noise)
        return noisy
