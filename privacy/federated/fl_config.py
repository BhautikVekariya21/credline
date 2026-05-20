"""
FinGuard 2026 — Federated Learning Configuration.

Hyperparameters and strategy settings for Flower-based federated training.
"""

from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class FLConfig:
    """Federated Learning configuration."""

    # Server
    server_address: str = "0.0.0.0:8080"
    num_rounds: int = 10
    min_fit_clients: int = 2
    min_evaluate_clients: int = 2
    min_available_clients: int = 2
    fraction_fit: float = 1.0
    fraction_evaluate: float = 1.0

    # Strategy
    strategy: str = "fedavg"  # fedavg, fedadam, fedprox
    server_learning_rate: float = 1.0  # For FedAdam
    server_momentum: float = 0.0
    proximal_mu: float = 0.1  # For FedProx

    # Client training
    local_epochs: int = 3
    local_batch_size: int = 32
    local_learning_rate: float = 1e-3

    # Privacy
    use_differential_privacy: bool = False
    dp_noise_multiplier: float = 1.0
    dp_max_grad_norm: float = 1.0

    # Security
    use_tls: bool = False
    tls_cert_path: str = ""
    tls_key_path: str = ""
