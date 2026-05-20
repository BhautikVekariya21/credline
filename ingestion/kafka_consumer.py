"""
FinGuard 2026 — Kafka Consumer.

Consumes transaction events from Kafka, computes real-time features,
and pushes them to the Feature Store for model serving.
"""

from __future__ import annotations

import json
import signal
import sys
from typing import Any, Callable

from config.logging_config import get_logger
from config.settings import get_settings

logger = get_logger(__name__)


class TransactionConsumer:
    """
    Kafka consumer that processes transaction events in real-time.

    Pipeline: Kafka → Deserialize → Feature Computation → Feature Store
    """

    def __init__(self, bootstrap_servers: str | None = None,
                 topic: str | None = None, group_id: str | None = None):
        settings = get_settings()
        self.bootstrap_servers = bootstrap_servers or settings.kafka.bootstrap_servers
        self.topic = topic or settings.kafka.transaction_topic
        self.group_id = group_id or settings.kafka.consumer_group
        self._consumer = None
        self._running = False
        self._handlers: list[Callable[[dict], None]] = []

    def _get_consumer(self) -> Any:
        if self._consumer is None:
            try:
                from confluent_kafka import Consumer
                self._consumer = Consumer({
                    "bootstrap.servers": self.bootstrap_servers,
                    "group.id": self.group_id,
                    "auto.offset.reset": "latest",
                    "enable.auto.commit": True,
                    "auto.commit.interval.ms": 5000,
                    "max.poll.interval.ms": 300000,
                    "session.timeout.ms": 30000,
                })
                self._consumer.subscribe([self.topic])
                logger.info("kafka_consumer_connected", topic=self.topic,
                           group=self.group_id)
            except ImportError:
                logger.warning("confluent_kafka_not_installed",
                             msg="Using mock consumer")
                self._consumer = MockConsumer()
        return self._consumer

    def register_handler(self, handler: Callable[[dict], None]) -> None:
        """Register a message handler function."""
        self._handlers.append(handler)

    def start(self, max_messages: int | None = None) -> None:
        """Start consuming messages. Blocks until stopped."""
        consumer = self._get_consumer()
        self._running = True
        processed = 0

        # Graceful shutdown on SIGINT/SIGTERM
        def _shutdown(sig: int, frame: Any) -> None:
            logger.info("consumer_shutdown_signal", signal=sig)
            self._running = False

        signal.signal(signal.SIGINT, _shutdown)
        signal.signal(signal.SIGTERM, _shutdown)

        logger.info("consumer_started", topic=self.topic)

        while self._running:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if hasattr(msg, "error") and msg.error():
                logger.error("kafka_consumer_error", error=str(msg.error()))
                continue

            try:
                value = json.loads(msg.value().decode("utf-8"))
                for handler in self._handlers:
                    handler(value)
                processed += 1

                if processed % 1000 == 0:
                    logger.info("consumer_progress", processed=processed)

            except Exception as e:
                logger.error("message_processing_error", error=str(e))

            if max_messages and processed >= max_messages:
                break

        self.close()
        logger.info("consumer_stopped", total_processed=processed)

    def stop(self) -> None:
        self._running = False

    def close(self) -> None:
        if self._consumer and hasattr(self._consumer, "close"):
            self._consumer.close()


class MockConsumer:
    """Mock consumer for development without Kafka."""

    def subscribe(self, topics: list[str]) -> None:
        pass

    def poll(self, timeout: float = 1.0) -> None:
        import time
        time.sleep(timeout)
        return None

    def close(self) -> None:
        pass
