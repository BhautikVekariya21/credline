"""
FinGuard 2026 — Kafka Injection Pipeline for Digital Twin.

Streams synthetic transactions from the Digital Twin economy directly
into the Phase 1 Kafka ingestion layer. The transactions arrive
indistinguishable from live production data, enabling:
  - Cold-start model pre-training
  - SOAR agent stress-testing
  - Chaos engineering with realistic loads
  - Regression testing of the full ML pipeline

Usage:
    python -m digital_twin.kafka_injector --citizens 10000 --hours 24 --topic transactions
"""

from __future__ import annotations

import argparse
import json
import time
from typing import Any

from config.logging_config import get_logger
from digital_twin.citizen_agents import Transaction
from digital_twin.economy_simulator import SyntheticEconomy

logger = get_logger(__name__)


class KafkaInjector:
    """
    Streams Digital Twin transactions into Kafka topics.

    Supports:
      - Real-time injection (1 sim-hour per wall-clock interval)
      - Burst mode (as fast as possible)
      - Separate topics for transactions, fraud labels, credit data
    """

    def __init__(
        self,
        bootstrap_servers: str = "localhost:9092",
        transaction_topic: str = "transactions",
        fraud_label_topic: str = "fraud_labels",
        credit_data_topic: str = "alternative_credit",
        batch_size: int = 500,
    ):
        self.bootstrap_servers = bootstrap_servers
        self.transaction_topic = transaction_topic
        self.fraud_label_topic = fraud_label_topic
        self.credit_data_topic = credit_data_topic
        self.batch_size = batch_size

        self._producer = None
        self._total_sent = 0
        self._total_fraud_sent = 0

    def _get_producer(self) -> Any:
        """Lazy-load Kafka producer."""
        if self._producer is None:
            try:
                from kafka import KafkaProducer
                self._producer = KafkaProducer(
                    bootstrap_servers=self.bootstrap_servers,
                    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                    acks="all",
                    retries=3,
                    linger_ms=10,
                    batch_size=16384,
                )
                logger.info("kafka_producer_connected",
                            servers=self.bootstrap_servers)
            except ImportError:
                logger.warning("kafka_not_installed",
                               msg="Using mock producer — transactions logged but not sent")
                self._producer = _MockProducer()
            except Exception as e:
                logger.warning("kafka_connect_failed", error=str(e))
                self._producer = _MockProducer()
        return self._producer

    def inject_transactions(self, transactions: list[Transaction]) -> int:
        """Send a batch of transactions to Kafka."""
        producer = self._get_producer()
        sent = 0

        for tx in transactions:
            tx_dict = tx.to_dict()

            # Main transaction topic
            producer.send(self.transaction_topic, value=tx_dict)
            sent += 1

            # Separate fraud label topic (for model training ground truth)
            if tx.is_fraud:
                label = {
                    "transaction_id": tx.transaction_id,
                    "is_fraud": True,
                    "fraud_type": tx.fraud_type,
                    "user_id": tx.user_id,
                    "timestamp": tx.timestamp,
                }
                producer.send(self.fraud_label_topic, value=label)
                self._total_fraud_sent += 1

        # Flush periodically
        if sent >= self.batch_size:
            producer.flush()

        self._total_sent += sent
        return sent

    def run_simulation(
        self,
        num_citizens: int = 10000,
        hours: int = 24,
        realtime: bool = False,
        realtime_speedup: float = 60.0,
    ) -> dict[str, Any]:
        """
        Run a Digital Twin simulation and inject all output into Kafka.

        Args:
            num_citizens: Population size.
            hours: Simulation duration.
            realtime: If True, pace injection to match wall-clock time.
            realtime_speedup: Speedup factor (60 = 1 sim-hour per wall-minute).
        """
        economy = SyntheticEconomy(num_citizens=num_citizens)
        start = time.time()

        logger.info("kafka_injection_start",
                     citizens=num_citizens, hours=hours, realtime=realtime)

        def on_step(step_num: int, txs: list[Transaction]) -> None:
            n = self.inject_transactions(txs)

            if step_num % 24 == 0:
                logger.info("kafka_injection_daily",
                            day=step_num // 24, txs_sent=n,
                            total=self._total_sent,
                            fraud=self._total_fraud_sent)

            if realtime and n > 0:
                target_delay = 3600 / realtime_speedup
                elapsed = time.time() - start - step_num * target_delay
                if elapsed < 0:
                    time.sleep(min(-elapsed, target_delay))

        summary = economy.run(hours=hours, callback=on_step)

        # Final flush
        producer = self._get_producer()
        producer.flush()

        injection_summary = {
            **summary,
            "total_kafka_messages": self._total_sent,
            "fraud_labels_sent": self._total_fraud_sent,
            "kafka_topic": self.transaction_topic,
            "bootstrap_servers": self.bootstrap_servers,
        }

        logger.info("kafka_injection_complete", **injection_summary)
        return injection_summary


class _MockProducer:
    """Mock Kafka producer for development without Kafka."""

    _logged = False

    def send(self, topic: str, value: Any = None, **kwargs) -> None:
        if not _MockProducer._logged:
            logger.info("mock_producer_active",
                        msg="Transactions logged but not sent to Kafka")
            _MockProducer._logged = True

    def flush(self) -> None:
        pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Inject Digital Twin data into Kafka")
    parser.add_argument("--citizens", type=int, default=1000)
    parser.add_argument("--hours", type=int, default=24)
    parser.add_argument("--topic", default="transactions")
    parser.add_argument("--kafka", default="localhost:9092")
    parser.add_argument("--realtime", action="store_true")
    args = parser.parse_args()

    injector = KafkaInjector(
        bootstrap_servers=args.kafka,
        transaction_topic=args.topic,
    )
    summary = injector.run_simulation(
        num_citizens=args.citizens,
        hours=args.hours,
        realtime=args.realtime,
    )

    print("\n🚀 Kafka Injection Complete:")
    for k, v in summary.items():
        print(f"  {k}: {v}")
