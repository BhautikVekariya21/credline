"""
FinGuard 2026 — Flower Federated Learning Server.

Aggregation server using FedAvg strategy. Coordinates model updates
from multiple bank clients without seeing private data.
"""

from __future__ import annotations

from typing import Any

from config.logging_config import get_logger
from privacy.federated.fl_config import FLConfig

logger = get_logger(__name__)


def create_strategy(config: FLConfig) -> Any:
    """Create a Flower aggregation strategy based on config."""
    try:
        import flwr as fl
        from flwr.server.strategy import FedAvg, FedAdam

        if config.strategy == "fedadam":
            strategy = FedAdam(
                fraction_fit=config.fraction_fit,
                fraction_evaluate=config.fraction_evaluate,
                min_fit_clients=config.min_fit_clients,
                min_evaluate_clients=config.min_evaluate_clients,
                min_available_clients=config.min_available_clients,
                eta=config.server_learning_rate,
                beta_1=0.9,
                beta_2=0.99,
            )
        else:  # Default: FedAvg
            strategy = FedAvg(
                fraction_fit=config.fraction_fit,
                fraction_evaluate=config.fraction_evaluate,
                min_fit_clients=config.min_fit_clients,
                min_evaluate_clients=config.min_evaluate_clients,
                min_available_clients=config.min_available_clients,
            )

        logger.info("fl_strategy_created", strategy=config.strategy)
        return strategy

    except ImportError:
        logger.error("flwr_not_installed",
                    msg="pip install flwr to use federated learning")
        raise


def start_fl_server(config: FLConfig | None = None) -> None:
    """
    Start the Flower federation server.

    This server:
    1. Waits for N bank clients to connect
    2. Sends global model to each client
    3. Receives model updates from each client
    4. Aggregates updates using FedAvg/FedAdam
    5. Repeats for num_rounds
    """
    config = config or FLConfig()

    try:
        import flwr as fl

        strategy = create_strategy(config)

        logger.info("fl_server_starting",
                    address=config.server_address,
                    rounds=config.num_rounds,
                    strategy=config.strategy)

        fl.server.start_server(
            server_address=config.server_address,
            config=fl.server.ServerConfig(num_rounds=config.num_rounds),
            strategy=strategy,
        )

        logger.info("fl_server_complete")

    except ImportError:
        logger.error("flwr_not_installed")
        raise


if __name__ == "__main__":
    from config.logging_config import setup_logging
    setup_logging(log_level="INFO", json_format=False)
    start_fl_server()
