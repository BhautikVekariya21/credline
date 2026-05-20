"""
FinGuard 2026 — Training Scripts.

Unified training loops for all FinGuard models:
- GraphSAGE fraud detection
- TransactionTransformer temporal patterns
- BiometricHead identity verification
- FinModel ensemble
- XGBoost thin-file credit scoring
- SSL masked transaction pre-training
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from config.logging_config import get_logger

logger = get_logger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
# Base Trainer
# ═══════════════════════════════════════════════════════════════════════════

class BaseTrainer:
    """Base trainer with common training utilities."""

    def __init__(self, model: nn.Module, device: str = "cpu",
                 lr: float = 1e-3, weight_decay: float = 1e-4,
                 checkpoint_dir: str = "./artifacts/checkpoints"):
        self.model = model.to(device)
        self.device = device
        self.checkpoint_dir = Path(checkpoint_dir)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)

        self.optimizer = torch.optim.AdamW(
            model.parameters(), lr=lr, weight_decay=weight_decay
        )
        self.scheduler = torch.optim.lr_scheduler.CosineAnnealingWarmRestarts(
            self.optimizer, T_0=10, T_mult=2
        )
        self.best_loss = float("inf")
        self.history: list[dict[str, float]] = []

    def save_checkpoint(self, name: str, epoch: int, loss: float) -> None:
        path = self.checkpoint_dir / f"{name}_best.pt"
        torch.save({
            "epoch": epoch,
            "model_state_dict": self.model.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "loss": loss,
        }, path)
        logger.info("checkpoint_saved", path=str(path), epoch=epoch, loss=loss)

    def load_checkpoint(self, name: str) -> None:
        path = self.checkpoint_dir / f"{name}_best.pt"
        if path.exists():
            ckpt = torch.load(path, map_location=self.device, weights_only=True)
            self.model.load_state_dict(ckpt["model_state_dict"])
            self.optimizer.load_state_dict(ckpt["optimizer_state_dict"])
            logger.info("checkpoint_loaded", path=str(path), epoch=ckpt["epoch"])


# ═══════════════════════════════════════════════════════════════════════════
# GraphSAGE Trainer
# ═══════════════════════════════════════════════════════════════════════════

class GraphTrainer(BaseTrainer):
    """Training loop for FraudGraphSAGE."""

    def train(self, data: Any, epochs: int = 100, pos_weight: float = 10.0) -> list[dict]:
        """
        Train GraphSAGE on a PyG Data object.
        Uses weighted BCE loss for class imbalance.
        """
        from torch_geometric.loader import NeighborLoader

        self.model.train()
        criterion = nn.BCEWithLogitsLoss(
            pos_weight=torch.tensor([pos_weight], device=self.device)
        )
        data = data.to(self.device)

        # Only train on labeled nodes (y != -1)
        train_mask = data.y >= 0

        for epoch in range(epochs):
            self.optimizer.zero_grad()
            out = self.model(data.x, data.edge_index, return_embedding=False)
            logits = out["logits"][train_mask].squeeze()
            labels = data.y[train_mask]

            loss = criterion(logits, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
            self.optimizer.step()
            self.scheduler.step(epoch)

            # Metrics
            with torch.no_grad():
                preds = (torch.sigmoid(logits) > 0.5).float()
                acc = (preds == labels).float().mean().item()

            record = {"epoch": epoch, "loss": loss.item(), "accuracy": acc}
            self.history.append(record)

            if loss.item() < self.best_loss:
                self.best_loss = loss.item()
                self.save_checkpoint("graphsage", epoch, loss.item())

            if epoch % 10 == 0:
                logger.info("graph_train", **record)

        return self.history


# ═══════════════════════════════════════════════════════════════════════════
# Transformer Trainer
# ═══════════════════════════════════════════════════════════════════════════

class TransformerTrainer(BaseTrainer):
    """Training loop for TransactionTransformer."""

    def train(self, train_loader: DataLoader, val_loader: DataLoader | None = None,
              epochs: int = 50, task: str = "fraud") -> list[dict]:
        """
        Train Transformer for fraud detection or credit scoring.

        Expects DataLoader yielding (features, time_deltas, hours, days, labels).
        """
        criterion = nn.BCEWithLogitsLoss() if task == "fraud" else nn.MSELoss()

        for epoch in range(epochs):
            self.model.train()
            epoch_loss = 0.0
            n_batches = 0

            for batch in train_loader:
                features, time_deltas, hours, days, labels = [
                    b.to(self.device) for b in batch
                ]
                self.optimizer.zero_grad()

                out = self.model(features, time_deltas=time_deltas,
                                hours=hours, days_of_week=days)
                embedding = out["embedding"]

                # Simple linear probe for training
                if not hasattr(self, "_probe"):
                    self._probe = nn.Linear(embedding.shape[-1], 1).to(self.device)
                pred = self._probe(embedding).squeeze(-1)

                loss = criterion(pred, labels)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                self.optimizer.step()

                epoch_loss += loss.item()
                n_batches += 1

            avg_loss = epoch_loss / max(n_batches, 1)
            self.scheduler.step(epoch)

            record = {"epoch": epoch, "loss": avg_loss}
            self.history.append(record)

            if avg_loss < self.best_loss:
                self.best_loss = avg_loss
                self.save_checkpoint("transformer", epoch, avg_loss)

            if epoch % 5 == 0:
                logger.info("transformer_train", **record)

        return self.history


# ═══════════════════════════════════════════════════════════════════════════
# Biometric Trainer
# ═══════════════════════════════════════════════════════════════════════════

class BiometricTrainer(BaseTrainer):
    """Training loop for BiometricHead."""

    def train(self, train_loader: DataLoader, epochs: int = 30) -> list[dict]:
        """
        Train BiometricHead for genuine vs fraudulent session classification.
        Expects DataLoader yielding (sensor_data, keystroke_data, labels).
        """
        criterion = nn.BCEWithLogitsLoss()

        for epoch in range(epochs):
            self.model.train()
            epoch_loss = 0.0
            correct = 0
            total = 0

            for sensor, keystroke, labels in train_loader:
                sensor = sensor.to(self.device)
                keystroke = keystroke.to(self.device)
                labels = labels.to(self.device)

                self.optimizer.zero_grad()
                out = self.model(sensor, keystroke, return_embedding=False)
                loss = criterion(out["logits"].squeeze(), labels)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                self.optimizer.step()

                epoch_loss += loss.item()
                preds = (out["probability"].squeeze() > 0.5).float()
                correct += (preds == labels).sum().item()
                total += labels.size(0)

            avg_loss = epoch_loss / max(len(train_loader), 1)
            accuracy = correct / max(total, 1)
            self.scheduler.step(epoch)

            record = {"epoch": epoch, "loss": avg_loss, "accuracy": accuracy}
            self.history.append(record)

            if avg_loss < self.best_loss:
                self.best_loss = avg_loss
                self.save_checkpoint("biometric", epoch, avg_loss)

            if epoch % 5 == 0:
                logger.info("biometric_train", **record)

        return self.history


# ═══════════════════════════════════════════════════════════════════════════
# SSL Pre-training
# ═══════════════════════════════════════════════════════════════════════════

class SSLTrainer(BaseTrainer):
    """Training loop for Masked Transaction Model pre-training."""

    def train(self, train_loader: DataLoader, epochs: int = 100) -> list[dict]:
        """
        Pre-train via masked feature reconstruction.
        Expects DataLoader yielding (features,) or (features, time_deltas).
        """
        for epoch in range(epochs):
            self.model.train()
            epoch_loss = 0.0
            n_batches = 0

            for batch in train_loader:
                if isinstance(batch, (list, tuple)):
                    features = batch[0].to(self.device)
                    td = batch[1].to(self.device) if len(batch) > 1 else None
                else:
                    features = batch.to(self.device)
                    td = None

                self.optimizer.zero_grad()
                out = self.model(features, time_deltas=td)
                loss = out["loss"]
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                self.optimizer.step()

                epoch_loss += loss.item()
                n_batches += 1

            avg_loss = epoch_loss / max(n_batches, 1)
            self.scheduler.step(epoch)

            record = {"epoch": epoch, "loss": avg_loss}
            self.history.append(record)

            if avg_loss < self.best_loss:
                self.best_loss = avg_loss
                self.save_checkpoint("ssl_masked", epoch, avg_loss)

            if epoch % 10 == 0:
                logger.info("ssl_pretrain", **record)

        return self.history


# ═══════════════════════════════════════════════════════════════════════════
# Ensemble Trainer
# ═══════════════════════════════════════════════════════════════════════════

class EnsembleTrainer(BaseTrainer):
    """End-to-end training for the FinModel ensemble."""

    def __init__(self, model: nn.Module, fraud_weight: float = 1.0,
                 credit_weight: float = 0.5, **kwargs: Any):
        super().__init__(model, **kwargs)
        self.fraud_weight = fraud_weight
        self.credit_weight = credit_weight

    def train(self, train_loader: DataLoader, epochs: int = 50) -> list[dict]:
        """
        Train ensemble end-to-end.
        Expects DataLoader yielding (graph_emb, temporal_emb, bio_emb,
                                     fraud_label, credit_label).
        """
        fraud_criterion = nn.BCEWithLogitsLoss()
        credit_criterion = nn.MSELoss()

        for epoch in range(epochs):
            self.model.train()
            epoch_loss = 0.0
            n_batches = 0

            for g_emb, t_emb, b_emb, fraud_y, credit_y in train_loader:
                g_emb = g_emb.to(self.device)
                t_emb = t_emb.to(self.device)
                b_emb = b_emb.to(self.device)
                fraud_y = fraud_y.to(self.device)
                credit_y = credit_y.to(self.device)

                self.optimizer.zero_grad()
                out = self.model(g_emb, t_emb, b_emb)

                fraud_loss = fraud_criterion(out["fraud_logit"], fraud_y)
                credit_loss = credit_criterion(out["credit_score"], credit_y)
                loss = self.fraud_weight * fraud_loss + self.credit_weight * credit_loss

                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                self.optimizer.step()

                epoch_loss += loss.item()
                n_batches += 1

            avg_loss = epoch_loss / max(n_batches, 1)
            self.scheduler.step(epoch)

            record = {"epoch": epoch, "loss": avg_loss}
            self.history.append(record)

            if avg_loss < self.best_loss:
                self.best_loss = avg_loss
                self.save_checkpoint("ensemble", epoch, avg_loss)

            if epoch % 5 == 0:
                logger.info("ensemble_train", **record)

        return self.history
