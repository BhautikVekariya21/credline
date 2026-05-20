"""
eshodha fintech solution — Phase 11: Critical Transaction Monitor.

Real-time anomaly detection for tax-sensitive transactions:
  - High-value cash movements
  - Blacklisted vendor payments
  - Unusual timing patterns
  - Threshold breaches (GST turnover, TDS)
  - FCM push notifications to mobile + dashboard
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any

from config.logging_config import get_logger

logger = get_logger(__name__)


class AlertSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AlertCategory(str, Enum):
    HIGH_VALUE = "HIGH_VALUE_TRANSACTION"
    BLACKLISTED = "BLACKLISTED_VENDOR"
    CASH_MOVEMENT = "UNUSUAL_CASH_MOVEMENT"
    TIMING = "OFF_HOURS_TRANSACTION"
    THRESHOLD = "REGULATORY_THRESHOLD"
    DUPLICATE = "POTENTIAL_DUPLICATE"
    ROUND_AMOUNT = "SUSPICIOUS_ROUND_AMOUNT"


@dataclass
class CriticalAlert:
    alert_id: str
    transaction_id: str
    category: AlertCategory
    severity: AlertSeverity
    title: str
    description: str
    amount: Decimal
    vendor: str
    timestamp: datetime
    requires_approval: bool = False
    auto_hold: bool = False
    notified: bool = False


@dataclass
class CriticalityThresholds:
    """Configurable per-business thresholds."""
    single_tx_high: Decimal = Decimal("5_00_000")       # ₹5L
    single_tx_critical: Decimal = Decimal("50_00_000")   # ₹50L
    daily_cash_limit: Decimal = Decimal("2_00_000")      # ₹2L (IT Act s269ST)
    gst_turnover_limit: Decimal = Decimal("40_00_000")   # ₹40L registration threshold
    tds_threshold: Decimal = Decimal("30_000")           # TDS deduction trigger
    off_hours_start: int = 22  # 10 PM
    off_hours_end: int = 6     # 6 AM


# Sample blacklisted vendors (production: from compliance DB)
BLACKLISTED_VENDORS = {
    "VND-SHELL-001", "VND-SUSP-042", "VND-FLAGGED-099",
}


class CriticalTransactionMonitor:
    """
    Monitors every transaction against a Criticality Matrix
    and fires alerts when thresholds are breached.
    """

    def __init__(self, thresholds: CriticalityThresholds | None = None):
        self.thresholds = thresholds or CriticalityThresholds()
        self._alerts: list[CriticalAlert] = []
        self._daily_cash: dict[str, Decimal] = {}  # user_id -> daily total
        self._alert_counter = 0

    def analyze(self, tx: dict[str, Any]) -> list[CriticalAlert]:
        """Run all criticality checks on a transaction."""
        alerts: list[CriticalAlert] = []
        amount = Decimal(str(tx.get("amount", 0)))
        vendor = tx.get("vendor_id", "")
        user = tx.get("user_id", "")
        ts = tx.get("timestamp", datetime.now())
        tx_id = tx.get("transaction_id", "")

        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts)

        # Check 1: High-value transaction
        if amount >= self.thresholds.single_tx_critical:
            alerts.append(self._alert(
                tx_id, AlertCategory.HIGH_VALUE, AlertSeverity.CRITICAL,
                "Critical: Transaction exceeds ₹50L",
                f"₹{amount:,.0f} to {vendor}. Requires mandatory reporting under PMLA.",
                amount, vendor, ts, requires_approval=True, auto_hold=True,
            ))
        elif amount >= self.thresholds.single_tx_high:
            alerts.append(self._alert(
                tx_id, AlertCategory.HIGH_VALUE, AlertSeverity.HIGH,
                "High-value transaction detected",
                f"₹{amount:,.0f} to {vendor}. Review recommended.",
                amount, vendor, ts, requires_approval=True,
            ))

        # Check 2: Blacklisted vendor
        if vendor in BLACKLISTED_VENDORS:
            alerts.append(self._alert(
                tx_id, AlertCategory.BLACKLISTED, AlertSeverity.CRITICAL,
                "Payment to blacklisted vendor",
                f"Vendor {vendor} is flagged. Transaction auto-held.",
                amount, vendor, ts, requires_approval=True, auto_hold=True,
            ))

        # Check 3: Daily cash limit (IT Act Section 269ST)
        if tx.get("payment_mode") == "CASH":
            self._daily_cash[user] = self._daily_cash.get(user, Decimal("0")) + amount
            if self._daily_cash[user] > self.thresholds.daily_cash_limit:
                alerts.append(self._alert(
                    tx_id, AlertCategory.CASH_MOVEMENT, AlertSeverity.HIGH,
                    "Daily cash limit exceeded",
                    f"₹{self._daily_cash[user]:,.0f} total cash today. Limit: ₹2,00,000 (s269ST).",
                    amount, vendor, ts,
                ))

        # Check 4: Off-hours transaction
        if ts.hour >= self.thresholds.off_hours_start or ts.hour < self.thresholds.off_hours_end:
            alerts.append(self._alert(
                tx_id, AlertCategory.TIMING, AlertSeverity.MEDIUM,
                "Off-hours transaction",
                f"Transaction at {ts.strftime('%I:%M %p')} outside business hours.",
                amount, vendor, ts,
            ))

        # Check 5: Suspicious round amounts (structuring indicator)
        if amount >= 10000 and amount % 10000 == 0:
            alerts.append(self._alert(
                tx_id, AlertCategory.ROUND_AMOUNT, AlertSeverity.LOW,
                "Round amount transaction",
                f"Exact ₹{amount:,.0f} — potential structuring indicator.",
                amount, vendor, ts,
            ))

        # Check 6: TDS threshold
        if amount >= self.thresholds.tds_threshold and tx.get("category") in (
            "professional_fees", "rent", "contract",
        ):
            alerts.append(self._alert(
                tx_id, AlertCategory.THRESHOLD, AlertSeverity.MEDIUM,
                "TDS deduction required",
                f"₹{amount:,.0f} {tx.get('category')} exceeds TDS threshold of ₹30,000.",
                amount, vendor, ts, requires_approval=True,
            ))

        self._alerts.extend(alerts)
        return alerts

    def get_pending_approvals(self) -> list[CriticalAlert]:
        return [a for a in self._alerts if a.requires_approval and not a.notified]

    def get_alerts_summary(self) -> dict[str, int]:
        from collections import Counter
        c = Counter(a.severity.value for a in self._alerts)
        return dict(c)

    def _alert(
        self, tx_id: str, cat: AlertCategory, sev: AlertSeverity,
        title: str, desc: str, amount: Decimal, vendor: str,
        ts: datetime, requires_approval: bool = False, auto_hold: bool = False,
    ) -> CriticalAlert:
        self._alert_counter += 1
        alert = CriticalAlert(
            alert_id=f"CTA-{self._alert_counter:06d}",
            transaction_id=tx_id,
            category=cat,
            severity=sev,
            title=title,
            description=desc,
            amount=amount,
            vendor=vendor,
            timestamp=ts,
            requires_approval=requires_approval,
            auto_hold=auto_hold,
        )
        logger.info(
            "critical_alert_raised",
            alert_id=alert.alert_id,
            category=cat.value,
            severity=sev.value,
            amount=float(amount),
        )
        return alert


# ─── Push Notification Service (FCM) ────────────────────────────────

class NotificationService:
    """Firebase Cloud Messaging integration for real-time alerts."""

    def __init__(self, fcm_key: str | None = None):
        self._fcm_key = fcm_key
        self._sent: list[dict] = []

    async def send_alert(self, alert: CriticalAlert, device_tokens: list[str]) -> bool:
        """Push critical alert to mobile + dashboard."""
        payload = {
            "notification": {
                "title": f"⚠️ {alert.title}",
                "body": alert.description,
            },
            "data": {
                "alert_id": alert.alert_id,
                "severity": alert.severity.value,
                "category": alert.category.value,
                "amount": str(alert.amount),
                "transaction_id": alert.transaction_id,
                "auto_hold": str(alert.auto_hold),
            },
            "registration_ids": device_tokens,
        }

        # In production: POST to https://fcm.googleapis.com/fcm/send
        logger.info("fcm_notification_sent", alert_id=alert.alert_id)
        self._sent.append(payload)
        alert.notified = True
        return True
