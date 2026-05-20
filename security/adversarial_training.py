"""
FinGuard 2026 — Adversarial Training & Gradient Masking (Defender Module).

Implements the "Defender" side of the AI-vs-AI hardening loop:
  1. PGD Adversarial Training: generates adversarial examples on-the-fly
     during training to create robust models (Madry et al., 2017).
  2. Gradient Masking: defensive distillation to reduce gradient
     information leakage to attackers.
  3. Input Transformation: stochastic pre-processing to destroy
     carefully crafted perturbations.

Usage:
    trainer = AdversarialTrainingLoop(model, optimizer)
    trainer.train_epoch(dataloader, epsilon=0.05)
"""

from __future__ import annotations

import time
from typing import Any

import numpy as np
import torch
import torch.nn as nn

from config.logging_config import get_logger

logger = get_logger(__name__)


class AdversarialTrainingLoop:
    """
    PGD-AT (Adversarial Training with Projected Gradient Descent).

    During each training batch:
      1. Generate PGD adversarial examples from the current batch
      2. Train on BOTH clean and adversarial examples
      3. Apply gradient masking to reduce information leakage
    """

    def __init__(
        self,
        model: nn.Module,
        optimizer: torch.optim.Optimizer,
        loss_fn: nn.Module | None = None,
        device: str = "cpu",
        pgd_epsilon: float = 0.05,
        pgd_alpha: float = 0.01,
        pgd_steps: int = 10,
        adversarial_ratio: float = 0.5,
    ):
        self.model = model.to(device)
        self.optimizer = optimizer
        self.loss_fn = loss_fn or nn.BCEWithLogitsLoss()
        self.device = device
        self.pgd_epsilon = pgd_epsilon
        self.pgd_alpha = pgd_alpha
        self.pgd_steps = pgd_steps
        self.adversarial_ratio = adversarial_ratio
        self.history: list[dict[str, Any]] = []

    def _generate_pgd_batch(
        self, x: torch.Tensor, y: torch.Tensor
    ) -> torch.Tensor:
        """Generate PGD adversarial examples for a batch."""
        self.model.eval()

        x_adv = x + torch.empty_like(x).uniform_(-self.pgd_epsilon, self.pgd_epsilon)
        x_adv = x_adv.clamp(0, 1).detach()

        for _ in range(self.pgd_steps):
            x_adv.requires_grad_(True)
            output = self.model(x_adv)
            if isinstance(output, dict):
                output = output.get("logits", list(output.values())[0])

            y_view = y.view_as(output) if output.shape != y.shape else y
            loss = self.loss_fn(output, y_view)
            loss.backward()

            with torch.no_grad():
                x_adv = x_adv + self.pgd_alpha * x_adv.grad.sign()
                delta = torch.clamp(x_adv - x, -self.pgd_epsilon, self.pgd_epsilon)
                x_adv = (x + delta).clamp(0, 1).detach()

        self.model.train()
        return x_adv

    def train_step(self, x: torch.Tensor, y: torch.Tensor) -> dict[str, float]:
        """Single adversarial training step."""
        x, y = x.to(self.device), y.to(self.device)

        # Split batch: some clean, some adversarial
        split = int(x.size(0) * self.adversarial_ratio)
        x_clean, y_clean = x[split:], y[split:]
        x_for_adv, y_for_adv = x[:split], y[:split]

        # Generate adversarial examples
        x_adv = self._generate_pgd_batch(x_for_adv, y_for_adv)

        # Combine clean + adversarial
        x_combined = torch.cat([x_clean, x_adv])
        y_combined = torch.cat([y_clean, y_for_adv])

        # Forward pass on combined batch
        self.model.train()
        self.optimizer.zero_grad()

        output = self.model(x_combined)
        if isinstance(output, dict):
            output = output.get("logits", list(output.values())[0])

        y_view = y_combined.view_as(output) if output.shape != y_combined.shape else y_combined
        loss = self.loss_fn(output, y_view)

        # Apply gradient masking: clip gradients to reduce info leakage
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
        self.optimizer.step()

        # Metrics
        with torch.no_grad():
            preds = (output > 0).float()
            accuracy = (preds == y_view).float().mean().item()

        return {
            "loss": loss.item(),
            "accuracy": accuracy,
            "clean_samples": x_clean.size(0),
            "adversarial_samples": x_adv.size(0),
        }

    def train_epoch(self, dataloader: Any, epoch: int = 0) -> dict[str, float]:
        """Train one full epoch with adversarial training."""
        epoch_metrics: dict[str, float] = {"loss": 0, "accuracy": 0}
        n_batches = 0

        for batch in dataloader:
            if isinstance(batch, (list, tuple)):
                x, y = batch[0], batch[1]
            else:
                x, y = batch, torch.zeros(batch.size(0), 1)

            metrics = self.train_step(x, y)
            epoch_metrics["loss"] += metrics["loss"]
            epoch_metrics["accuracy"] += metrics["accuracy"]
            n_batches += 1

        for k in epoch_metrics:
            epoch_metrics[k] /= max(n_batches, 1)
        epoch_metrics["epoch"] = epoch

        self.history.append(epoch_metrics)
        logger.info("adversarial_train_epoch", **epoch_metrics)
        return epoch_metrics


class GradientMaskingDefense:
    """
    Defensive distillation and gradient masking.

    Trains a "student" model on soft labels from a "teacher" model,
    which reduces the gradient information available to attackers.
    """

    def __init__(self, teacher: nn.Module, student: nn.Module, temperature: float = 20.0):
        self.teacher = teacher
        self.student = student
        self.temperature = temperature
        self.teacher.eval()

    def distill_step(
        self,
        x: torch.Tensor,
        optimizer: torch.optim.Optimizer,
    ) -> dict[str, float]:
        """One distillation step: student learns from teacher's soft predictions."""
        with torch.no_grad():
            teacher_out = self.teacher(x)
            if isinstance(teacher_out, dict):
                teacher_out = teacher_out.get("logits", list(teacher_out.values())[0])
            soft_labels = torch.sigmoid(teacher_out / self.temperature)

        student_out = self.student(x)
        if isinstance(student_out, dict):
            student_out = student_out.get("logits", list(student_out.values())[0])

        student_soft = student_out / self.temperature
        loss = nn.functional.binary_cross_entropy_with_logits(student_soft, soft_labels)

        optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.student.parameters(), max_norm=0.5)
        optimizer.step()

        return {"distill_loss": loss.item(), "temperature": self.temperature}


class InputTransformationDefense:
    """
    Stochastic input transformations to destroy adversarial perturbations.

    Applied at inference time before the model processes the input.
    """

    def __init__(
        self,
        noise_std: float = 0.01,
        quantize_bits: int = 8,
        smooth_kernel_size: int = 3,
    ):
        self.noise_std = noise_std
        self.quantize_bits = quantize_bits
        self.smooth_kernel_size = smooth_kernel_size

    def transform(self, x: torch.Tensor) -> torch.Tensor:
        """Apply all defensive transformations."""
        x = self._add_noise(x)
        x = self._quantize(x)
        x = self._smooth(x)
        return x

    def _add_noise(self, x: torch.Tensor) -> torch.Tensor:
        return (x + torch.randn_like(x) * self.noise_std).clamp(0, 1)

    def _quantize(self, x: torch.Tensor) -> torch.Tensor:
        levels = 2 ** self.quantize_bits
        return (x * levels).round() / levels

    def _smooth(self, x: torch.Tensor) -> torch.Tensor:
        if x.dim() < 3:
            return x
        k = self.smooth_kernel_size
        padding = k // 2
        kernel = torch.ones(1, 1, k, device=x.device) / k
        # Apply 1D convolution smoothing per channel
        smoothed = x.clone()
        for c in range(x.size(1)):
            channel = x[:, c:c+1, :]
            smoothed[:, c:c+1, :] = torch.nn.functional.conv1d(channel, kernel, padding=padding)
        return smoothed
