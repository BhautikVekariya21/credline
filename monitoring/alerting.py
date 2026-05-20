"""
FinGuard 2026 — Alert Routing.

Routes drift detection and anomaly alerts to external channels
(Slack, PagerDuty, email) based on severity.
"""

from __future__ import annotations

from enum import Enum
from typing import Any

from config.logging_config import get_logger

logger = get_logger(__name__)


class AlertSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertRouter:
    """
    Routes alerts to appropriate channels based on severity.

    In production, connect to actual notification services.
    This implementation logs alerts and maintains an in-memory history.
    """

    def __init__(self, slack_webhook_url: str | None = None,
                 pagerduty_key: str | None = None):
        self.slack_webhook = slack_webhook_url
        self.pagerduty_key = pagerduty_key
        self._alert_history: list[dict[str, Any]] = []

    def send_alert(self, title: str, message: str,
                   severity: AlertSeverity,
                   metadata: dict[str, Any] | None = None) -> None:
        """Route an alert to the appropriate channel."""
        alert = {
            "title": title,
            "message": message,
            "severity": severity.value,
            "metadata": metadata or {},
        }

        self._alert_history.append(alert)

        # Log all alerts
        logger.warning("alert_triggered", **alert)

        # Route based on severity
        if severity in (AlertSeverity.HIGH, AlertSeverity.CRITICAL):
            self._send_to_pagerduty(alert)
        if severity != AlertSeverity.LOW:
            self._send_to_slack(alert)

    def _send_to_slack(self, alert: dict[str, Any]) -> None:
        """Send alert to Slack (placeholder for real webhook integration)."""
        if not self.slack_webhook:
            logger.debug("slack_alert_skipped", reason="no webhook configured")
            return
        # In production: httpx.post(self.slack_webhook, json=payload)
        logger.info("slack_alert_sent", title=alert["title"])

    def _send_to_pagerduty(self, alert: dict[str, Any]) -> None:
        """Send alert to PagerDuty (placeholder for real integration)."""
        if not self.pagerduty_key:
            logger.debug("pagerduty_alert_skipped", reason="no key configured")
            return
        logger.info("pagerduty_alert_sent", title=alert["title"])

    def get_history(self, limit: int = 100) -> list[dict[str, Any]]:
        """Return recent alert history."""
        return self._alert_history[-limit:]
