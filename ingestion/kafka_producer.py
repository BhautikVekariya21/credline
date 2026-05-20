"""
FinGuard 2026 — Kafka Producer.

Simulates or bridges real transaction streams into Kafka topics.
Used for development/testing with synthetic data, or as a template
for connecting to real payment processor event streams.
"""

from __future__ import annotations

import json
import time
from datetime import datetime
from typing import Any

from config.logging_config import get_logger
from config.settings import get_settings

logger = get_logger(__name__)


class TransactionProducer:
    """
    Kafka producer for transaction event streams.

    In production, this wraps a connection to the payment processor's
    event bus. For development, it generates synthetic events.
    """

    def __init__(self, bootstrap_servers: str | None = None,
                 topic: str | None = None):
        settings = get_settings()
        self.bootstrap_servers = bootstrap_servers or settings.kafka.bootstrap_servers
        self.topic = topic or settings.kafka.transaction_topic
        self._producer = None

    def _get_producer(self) -> Any:
        """Lazy-initialize Kafka producer."""
        if self._producer is None:
            try:
                from confluent_kafka import Producer
                self._producer = Producer({
                    "bootstrap.servers": self.bootstrap_servers,
                    "client.id": "finguard-producer",
                    "acks": "all",
                    "retries": 3,
                    "linger.ms": 10,
                    "batch.size": 16384,
                    "compression.type": "snappy",
                })
                logger.info("kafka_producer_connected",
                           servers=self.bootstrap_servers, topic=self.topic)
            except ImportError:
                logger.warning("confluent_kafka_not_installed",
                             msg="Using mock producer")
                self._producer = MockProducer()
        return self._producer

    def _delivery_callback(self, err: Any, msg: Any) -> None:
        if err is not None:
            logger.error("kafka_delivery_failed", error=str(err))
        else:
            logger.debug("kafka_delivered", topic=msg.topic(),
                        partition=msg.partition(), offset=msg.offset())

    def send_transaction(self, transaction: dict[str, Any]) -> None:
        """Send a single transaction event to Kafka."""
        producer = self._get_producer()
        key = transaction.get("user_id", "unknown").encode("utf-8")
        value = json.dumps(transaction, default=str).encode("utf-8")

        producer.produce(
            topic=self.topic,
            key=key,
            value=value,
            callback=self._delivery_callback,
        )
        producer.poll(0)

    def send_batch(self, transactions: list[dict[str, Any]],
                   rate_limit: float = 0) -> int:
        """Send a batch of transactions."""
        producer = self._get_producer()
        sent = 0

        for tx in transactions:
            self.send_transaction(tx)
            sent += 1

            if rate_limit > 0:
                time.sleep(1.0 / rate_limit)

            # Periodic flush
            if sent % 1000 == 0:
                producer.flush()
                logger.info("kafka_batch_progress", sent=sent,
                           total=len(transactions))

        producer.flush()
        logger.info("kafka_batch_complete", total_sent=sent)
        return sent

    def close(self) -> None:
        if self._producer is not None:
            self._producer.flush()
            logger.info("kafka_producer_closed")


class MockProducer:
    """Mock producer for development without Kafka."""

    def __init__(self) -> None:
        self.messages: list[dict[str, Any]] = []

    def produce(self, topic: str, key: bytes, value: bytes,
                callback: Any = None) -> None:
        self.messages.append({"topic": topic, "key": key, "value": value})

    def poll(self, timeout: float) -> int:
        return 0

    def flush(self) -> None:
        pass
