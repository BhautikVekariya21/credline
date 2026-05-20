"""
FinGuard 2026 — Adversarial Attack Simulator (Red Team).

Implements attack methods from the Adversarial Robustness Toolbox (ART) framework
to stress-test FinGuard models. This module acts as the "Attacker" in the
AI-vs-AI adversarial hardening loop.

Attack taxonomy:
  1. FGSM (Fast Gradient Sign Method)  — Single-step gradient attack
  2. PGD  (Projected Gradient Descent)  — Iterative bounded attack
  3. C&W  (Carlini-Wagner L2)          — Optimization-based attack
  4. DeepFool                          — Minimal perturbation attack

Usage:
    python -m security.adversarial_simulator --attack pgd --model tft
"""

from __future__ import annotations

import argparse
import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import torch
import torch.nn as nn

from config.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class AttackResult:
    """Result of an adversarial attack simulation."""
    attack_type: str
    samples_tested: int
    samples_evaded: int
    evasion_rate: float
    mean_perturbation_l2: float
    mean_perturbation_linf: float
    original_accuracy: float
    adversarial_accuracy: float
    execution_time_ms: float
    details: dict[str, Any] = field(default_factory=dict)

    @property
    def robustness_score(self) -> float:
        """1.0 = perfectly robust, 0.0 = completely vulnerable."""
        return 1.0 - self.evasion_rate


class AdversarialAttackSimulator:
    """
    Red Team adversarial attack simulator.

    Generates adversarial examples designed to fool fraud/credit models
    and measures the model's resilience under each attack.
    """

    def __init__(self, model: nn.Module, device: str = "cpu"):
        self.model = model.to(device)
        self.model.eval()
        self.device = device
        self.attack_history: list[AttackResult] = []

    # ─── FGSM Attack ──────────────────────────────────────────────────

    def fgsm_attack(
        self,
        x: torch.Tensor,
        y: torch.Tensor,
        epsilon: float = 0.05,
        loss_fn: nn.Module | None = None,
    ) -> tuple[torch.Tensor, AttackResult]:
        """
        Fast Gradient Sign Method (Goodfellow et al., 2014).

        Single-step attack: x_adv = x + ε * sign(∇_x L(θ, x, y))
        """
        start = time.time()
        if loss_fn is None:
            loss_fn = nn.BCEWithLogitsLoss()

        x_adv = x.clone().detach().requires_grad_(True).to(self.device)
        y = y.to(self.device)

        output = self.model(x_adv)
        if isinstance(output, dict):
            output = output.get("logits", output.get("probability", list(output.values())[0]))
        if output.shape != y.shape:
            y = y.view_as(output)

        loss = loss_fn(output, y)
        loss.backward()

        # Perturb in direction of gradient sign
        perturbation = epsilon * x_adv.grad.sign()
        x_adv = (x + perturbation).clamp(0, 1).detach()

        result = self._evaluate_attack("FGSM", x, x_adv, y, start)
        self.attack_history.append(result)
        return x_adv, result

    # ─── PGD Attack ────────────────────────────────────────────────────

    def pgd_attack(
        self,
        x: torch.Tensor,
        y: torch.Tensor,
        epsilon: float = 0.05,
        alpha: float = 0.01,
        num_steps: int = 40,
        loss_fn: nn.Module | None = None,
    ) -> tuple[torch.Tensor, AttackResult]:
        """
        Projected Gradient Descent (Madry et al., 2017).

        Iterative attack with L∞ ball projection:
          x_t+1 = Π(x_t + α * sign(∇_x L(θ, x_t, y)))
        """
        start = time.time()
        if loss_fn is None:
            loss_fn = nn.BCEWithLogitsLoss()

        x = x.to(self.device)
        y = y.to(self.device)

        # Random start within epsilon ball
        x_adv = x + torch.empty_like(x).uniform_(-epsilon, epsilon)
        x_adv = x_adv.clamp(0, 1).detach()

        for _ in range(num_steps):
            x_adv.requires_grad_(True)
            output = self.model(x_adv)
            if isinstance(output, dict):
                output = output.get("logits", list(output.values())[0])
            if output.shape != y.shape:
                y_view = y.view_as(output)
            else:
                y_view = y

            loss = loss_fn(output, y_view)
            loss.backward()

            # Step + project back into epsilon ball
            with torch.no_grad():
                x_adv = x_adv + alpha * x_adv.grad.sign()
                perturbation = torch.clamp(x_adv - x, -epsilon, epsilon)
                x_adv = (x + perturbation).clamp(0, 1).detach()

        result = self._evaluate_attack("PGD", x, x_adv, y, start)
        self.attack_history.append(result)
        return x_adv, result

    # ─── C&W Attack (Simplified) ──────────────────────────────────────

    def cw_attack(
        self,
        x: torch.Tensor,
        y: torch.Tensor,
        confidence: float = 0.0,
        learning_rate: float = 0.01,
        num_steps: int = 100,
    ) -> tuple[torch.Tensor, AttackResult]:
        """
        Carlini & Wagner L2 attack (simplified).

        Minimizes: ‖δ‖₂ + c * f(x + δ)
        where f is a loss that drives misclassification.
        """
        start = time.time()
        x = x.to(self.device)
        y = y.to(self.device)

        # Use tanh-space parameterization
        w = torch.zeros_like(x, requires_grad=True, device=self.device)
        optimizer = torch.optim.Adam([w], lr=learning_rate)

        best_adv = x.clone()
        best_l2 = float("inf")

        for step in range(num_steps):
            x_adv = 0.5 * (torch.tanh(w) + 1)  # Map to [0, 1]
            
            output = self.model(x_adv)
            if isinstance(output, dict):
                output = output.get("logits", list(output.values())[0])

            # L2 distance
            l2_dist = torch.sum((x_adv - x) ** 2)

            # Misclassification loss
            target = 1 - y  # Flip labels
            if output.shape != target.shape:
                target = target.view_as(output)
            cls_loss = torch.clamp(output * (2 * y.view_as(output) - 1) - confidence, min=0).sum()

            loss = l2_dist + 10.0 * cls_loss

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            # Track best adversarial
            with torch.no_grad():
                curr_l2 = l2_dist.item()
                if curr_l2 < best_l2:
                    best_l2 = curr_l2
                    best_adv = x_adv.detach().clone()

        result = self._evaluate_attack("C&W-L2", x, best_adv, y, start)
        self.attack_history.append(result)
        return best_adv, result

    # ─── DeepFool (Minimal Perturbation) ──────────────────────────────

    def deepfool_attack(
        self,
        x: torch.Tensor,
        y: torch.Tensor,
        max_iterations: int = 50,
        overshoot: float = 0.02,
    ) -> tuple[torch.Tensor, AttackResult]:
        """
        DeepFool attack: finds the minimal perturbation to cross the decision boundary.
        """
        start = time.time()
        x = x.to(self.device)
        y = y.to(self.device)
        x_adv = x.clone().detach()

        for _ in range(max_iterations):
            x_adv.requires_grad_(True)
            output = self.model(x_adv)
            if isinstance(output, dict):
                output = output.get("logits", list(output.values())[0])

            pred = (output > 0).float()
            if not torch.equal(pred.view(-1), y.view(-1)):
                break

            loss = output.sum()
            loss.backward()

            with torch.no_grad():
                grad = x_adv.grad
                grad_norm = torch.norm(grad.view(grad.size(0), -1), dim=1, keepdim=True)
                grad_norm = grad_norm.view(-1, *([1] * (grad.dim() - 1)))
                perturbation = (output.view(-1, *([1] * (grad.dim() - 1))) / (grad_norm + 1e-8)) * grad
                x_adv = (x_adv + (1 + overshoot) * perturbation).clamp(0, 1).detach()

        result = self._evaluate_attack("DeepFool", x, x_adv, y, start)
        self.attack_history.append(result)
        return x_adv, result

    # ─── Evaluation ───────────────────────────────────────────────────

    def _evaluate_attack(
        self, attack_name: str,
        x_orig: torch.Tensor, x_adv: torch.Tensor,
        y_true: torch.Tensor, start_time: float,
    ) -> AttackResult:
        """Evaluate attack success rate and perturbation magnitude."""
        with torch.no_grad():
            # Original predictions
            out_orig = self.model(x_orig.to(self.device))
            if isinstance(out_orig, dict):
                out_orig = out_orig.get("logits", list(out_orig.values())[0])
            pred_orig = (out_orig > 0).float().view(-1)

            # Adversarial predictions
            out_adv = self.model(x_adv.to(self.device))
            if isinstance(out_adv, dict):
                out_adv = out_adv.get("logits", list(out_adv.values())[0])
            pred_adv = (out_adv > 0).float().view(-1)

            y_flat = y_true.view(-1)

            orig_correct = (pred_orig == y_flat).float()
            adv_correct = (pred_adv == y_flat).float()

            # Evaded = originally correct but now wrong
            evaded = ((orig_correct == 1) & (adv_correct == 0)).sum().item()
            testable = orig_correct.sum().item()

            # Perturbation norms
            delta = (x_adv - x_orig).view(x_orig.size(0), -1)
            l2_norms = torch.norm(delta, p=2, dim=1)
            linf_norms = torch.norm(delta, p=float("inf"), dim=1)

        elapsed = (time.time() - start_time) * 1000

        result = AttackResult(
            attack_type=attack_name,
            samples_tested=x_orig.size(0),
            samples_evaded=int(evaded),
            evasion_rate=evaded / max(testable, 1),
            mean_perturbation_l2=float(l2_norms.mean()),
            mean_perturbation_linf=float(linf_norms.mean()),
            original_accuracy=float(orig_correct.mean()),
            adversarial_accuracy=float(adv_correct.mean()),
            execution_time_ms=elapsed,
        )

        logger.info(
            "adversarial_attack",
            attack=attack_name,
            evasion_rate=f"{result.evasion_rate:.4f}",
            robustness=f"{result.robustness_score:.4f}",
            l2=f"{result.mean_perturbation_l2:.6f}",
        )
        return result

    def run_full_suite(
        self,
        x: torch.Tensor,
        y: torch.Tensor,
        epsilon: float = 0.05,
    ) -> dict[str, AttackResult]:
        """Run all attacks and return a comprehensive robustness report."""
        results = {}
        results["fgsm"] = self.fgsm_attack(x, y, epsilon)[1]
        results["pgd"] = self.pgd_attack(x, y, epsilon)[1]
        results["cw"] = self.cw_attack(x, y)[1]
        results["deepfool"] = self.deepfool_attack(x, y)[1]

        avg_robustness = np.mean([r.robustness_score for r in results.values()])
        logger.info("adversarial_suite_complete",
                     attacks=len(results),
                     avg_robustness=f"{avg_robustness:.4f}")
        return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FinGuard Adversarial Attack Simulator")
    parser.add_argument("--attack", choices=["fgsm", "pgd", "cw", "deepfool", "all"], default="all")
    parser.add_argument("--epsilon", type=float, default=0.05)
    parser.add_argument("--samples", type=int, default=100)
    args = parser.parse_args()

    # Demo with a simple model
    model = nn.Sequential(nn.Linear(12, 64), nn.ReLU(), nn.Linear(64, 1))
    simulator = AdversarialAttackSimulator(model)

    x = torch.randn(args.samples, 12).clamp(0, 1)
    y = torch.randint(0, 2, (args.samples, 1)).float()

    if args.attack == "all":
        results = simulator.run_full_suite(x, y, args.epsilon)
        for name, r in results.items():
            print(f"  {name}: evasion={r.evasion_rate:.2%}, robustness={r.robustness_score:.2%}")
    else:
        attack_fn = getattr(simulator, f"{args.attack}_attack")
        _, result = attack_fn(x, y, epsilon=args.epsilon)
        print(f"  {result.attack_type}: robustness={result.robustness_score:.2%}")
