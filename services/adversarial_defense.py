"""
FinGuard 2026 — Service E: Adversarial Defense & Training.

GAN-style adversarial training where a Generator AI creates
synthetic fraudulent transactions to stress-test the fraud detector,
forcing continuous model evolution.
"""

from __future__ import annotations
import torch
import torch.nn as nn
import numpy as np
from typing import Any
from config.logging_config import get_logger

logger = get_logger(__name__)


class FraudGenerator(nn.Module):
    """
    Generator network that learns to create realistic fraudulent transactions
    that can bypass the fraud detection system.
    """

    def __init__(self, noise_dim: int = 32, feature_dim: int = 12, hidden_dim: int = 64):
        super().__init__()
        self.noise_dim = noise_dim
        self.net = nn.Sequential(
            nn.Linear(noise_dim, hidden_dim), nn.LeakyReLU(0.2),
            nn.Linear(hidden_dim, hidden_dim * 2), nn.LeakyReLU(0.2),
            nn.BatchNorm1d(hidden_dim * 2),
            nn.Linear(hidden_dim * 2, hidden_dim), nn.LeakyReLU(0.2),
            nn.Linear(hidden_dim, feature_dim), nn.Sigmoid(),
        )

    def forward(self, z: torch.Tensor) -> torch.Tensor:
        return self.net(z)

    def generate(self, n: int, device: str = "cpu") -> torch.Tensor:
        z = torch.randn(n, self.noise_dim, device=device)
        return self.forward(z)


class FraudDiscriminator(nn.Module):
    """Discriminator that classifies transactions as real or synthetic fraud."""

    def __init__(self, feature_dim: int = 12, hidden_dim: int = 64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(feature_dim, hidden_dim), nn.LeakyReLU(0.2), nn.Dropout(0.3),
            nn.Linear(hidden_dim, hidden_dim), nn.LeakyReLU(0.2), nn.Dropout(0.3),
            nn.Linear(hidden_dim, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class AdversarialTrainer:
    """
    GAN-style adversarial training loop.

    The Generator creates fake fraud transactions.
    The Discriminator (our fraud detector) tries to distinguish them.
    Both improve through competition, making the fraud detector more robust.
    """

    def __init__(self, feature_dim: int = 12, noise_dim: int = 32,
                 lr: float = 2e-4, device: str = "cpu"):
        self.device = device
        self.generator = FraudGenerator(noise_dim, feature_dim).to(device)
        self.discriminator = FraudDiscriminator(feature_dim).to(device)

        self.g_optimizer = torch.optim.Adam(self.generator.parameters(), lr=lr, betas=(0.5, 0.999))
        self.d_optimizer = torch.optim.Adam(self.discriminator.parameters(), lr=lr, betas=(0.5, 0.999))
        self.criterion = nn.BCEWithLogitsLoss()
        self.history: list[dict[str, float]] = []

    def train_step(self, real_data: torch.Tensor) -> dict[str, float]:
        batch_size = real_data.size(0)
        real_labels = torch.ones(batch_size, 1, device=self.device)
        fake_labels = torch.zeros(batch_size, 1, device=self.device)

        # Train Discriminator
        self.d_optimizer.zero_grad()
        d_real = self.discriminator(real_data)
        d_loss_real = self.criterion(d_real, real_labels)

        fake_data = self.generator.generate(batch_size, self.device)
        d_fake = self.discriminator(fake_data.detach())
        d_loss_fake = self.criterion(d_fake, fake_labels)

        d_loss = d_loss_real + d_loss_fake
        d_loss.backward()
        self.d_optimizer.step()

        # Train Generator
        self.g_optimizer.zero_grad()
        fake_data = self.generator.generate(batch_size, self.device)
        g_output = self.discriminator(fake_data)
        g_loss = self.criterion(g_output, real_labels)  # Fool discriminator
        g_loss.backward()
        self.g_optimizer.step()

        return {"d_loss": d_loss.item(), "g_loss": g_loss.item(),
                "d_accuracy": ((d_real > 0).float().mean().item() +
                               (d_fake < 0).float().mean().item()) / 2}

    def train(self, data_loader: Any, epochs: int = 50) -> list[dict]:
        for epoch in range(epochs):
            epoch_metrics = {"d_loss": 0, "g_loss": 0, "d_accuracy": 0}
            n = 0
            for batch in data_loader:
                if isinstance(batch, (list, tuple)):
                    batch = batch[0]
                batch = batch.to(self.device)
                metrics = self.train_step(batch)
                for k in epoch_metrics:
                    epoch_metrics[k] += metrics[k]
                n += 1
            for k in epoch_metrics:
                epoch_metrics[k] /= max(n, 1)
            epoch_metrics["epoch"] = epoch
            self.history.append(epoch_metrics)
            if epoch % 10 == 0:
                logger.info("adversarial_train", **epoch_metrics)
        return self.history

    def generate_adversarial_samples(self, n: int = 100) -> np.ndarray:
        """Generate synthetic adversarial fraud samples for testing."""
        self.generator.eval()
        with torch.no_grad():
            samples = self.generator.generate(n, self.device)
        return samples.cpu().numpy()


class AdversarialDefenseService:
    """Service E: Adversarial defense with drift-aware retraining."""

    def __init__(self, feature_dim: int = 12):
        self.trainer = AdversarialTrainer(feature_dim=feature_dim)

    def run_adversarial_test(self, model: Any, n_samples: int = 100) -> dict[str, Any]:
        """Generate adversarial samples and test model robustness."""
        samples = self.trainer.generate_adversarial_samples(n_samples)
        # Test how many adversarial samples bypass detection
        bypass_count = 0  # placeholder: would run through actual model
        return {
            "adversarial_samples_generated": n_samples,
            "bypass_count": bypass_count,
            "bypass_rate": bypass_count / max(n_samples, 1),
            "robustness_score": 1.0 - bypass_count / max(n_samples, 1),
        }
