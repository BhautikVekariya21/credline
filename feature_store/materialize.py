"""
FinGuard 2026 — Feast Materialization Scripts.

Handles syncing features from offline store to online store
for real-time serving.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta

from config.logging_config import get_logger, setup_logging

logger = get_logger(__name__)


def materialize_features(days_back: int = 7) -> None:
    """Materialize features from offline to online store."""
    try:
        from feast import FeatureStore

        store = FeatureStore(repo_path="./feature_store")

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days_back)

        logger.info("materialization_start",
                    start=start_date.isoformat(),
                    end=end_date.isoformat())

        store.materialize(
            start_date=start_date,
            end_date=end_date,
        )

        logger.info("materialization_complete")
    except ImportError:
        logger.warning("feast_not_installed",
                      msg="Skipping materialization")
    except Exception as e:
        logger.error("materialization_failed", error=str(e))
        raise


def materialize_incremental() -> None:
    """Incrementally materialize only new features."""
    try:
        from feast import FeatureStore

        store = FeatureStore(repo_path="./feature_store")

        end_date = datetime.utcnow()
        logger.info("incremental_materialization_start",
                    end=end_date.isoformat())

        store.materialize_incremental(end_date=end_date)

        logger.info("incremental_materialization_complete")
    except ImportError:
        logger.warning("feast_not_installed")
    except Exception as e:
        logger.error("materialization_failed", error=str(e))
        raise


if __name__ == "__main__":
    setup_logging(log_level="INFO", json_format=False)
    parser = argparse.ArgumentParser()
    parser.add_argument("--incremental", action="store_true")
    parser.add_argument("--days-back", type=int, default=7)
    args = parser.parse_args()

    if args.incremental:
        materialize_incremental()
    else:
        materialize_features(days_back=args.days_back)
