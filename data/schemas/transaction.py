"""
FinGuard 2026 — Transaction Event Schema.

Defines the canonical transaction event structure used across ingestion,
feature engineering, model inference, and API request/response payloads.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class GeoLocation(BaseModel):
    """Geographic coordinates for transaction origin."""

    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    country_code: str = Field(..., min_length=2, max_length=3)
    city: Optional[str] = None


class MerchantCategory(str, Enum):
    """Merchant Category Codes (simplified)."""

    GROCERY = "grocery"
    ELECTRONICS = "electronics"
    RESTAURANT = "restaurant"
    GAS_STATION = "gas_station"
    ONLINE_RETAIL = "online_retail"
    TRAVEL = "travel"
    HEALTHCARE = "healthcare"
    ENTERTAINMENT = "entertainment"
    UTILITIES = "utilities"
    ATM_WITHDRAWAL = "atm_withdrawal"
    PEER_TO_PEER = "p2p"
    OTHER = "other"


class TransactionEvent(BaseModel):
    """
    Core transaction event — the primary data object flowing through the system.

    This represents a single financial transaction as captured from a payment
    processor or banking core system.
    """

    transaction_id: str = Field(
        ..., description="Unique transaction identifier (UUID)"
    )
    user_id: str = Field(
        ..., description="Anonymized user/account identifier"
    )
    merchant_id: str = Field(
        ..., description="Merchant identifier"
    )
    amount: float = Field(
        ..., gt=0, description="Transaction amount in base currency"
    )
    currency: str = Field(
        default="USD", min_length=3, max_length=3, description="ISO 4217 currency code"
    )
    timestamp: datetime = Field(
        ..., description="UTC timestamp of the transaction"
    )
    device_id: str = Field(
        ..., description="Device fingerprint hash"
    )
    ip_address: str = Field(
        ..., description="Source IP address (hashed for privacy)"
    )
    location: GeoLocation = Field(
        ..., description="Geographic origin of the transaction"
    )
    channel: Literal["online", "pos", "atm", "mobile"] = Field(
        ..., description="Transaction channel"
    )
    merchant_category: MerchantCategory = Field(
        default=MerchantCategory.OTHER, description="Merchant category"
    )

    # ─── Labels (optional — None for unlabeled / real-time) ────────────────
    is_fraud: Optional[bool] = Field(
        default=None, description="Ground truth fraud label (None = unlabeled)"
    )
    fraud_type: Optional[str] = Field(
        default=None, description="Type of fraud if labeled (e.g., 'account_takeover')"
    )

    # ─── Derived / Enriched fields ─────────────────────────────────────────
    hour_of_day: Optional[int] = Field(default=None, ge=0, le=23)
    day_of_week: Optional[int] = Field(default=None, ge=0, le=6)
    is_weekend: Optional[bool] = None
    amount_log: Optional[float] = None

    def enrich(self) -> TransactionEvent:
        """Compute derived fields from raw transaction data."""
        self.hour_of_day = self.timestamp.hour
        self.day_of_week = self.timestamp.weekday()
        self.is_weekend = self.day_of_week >= 5
        self.amount_log = float(__import__("math").log1p(self.amount))
        return self


class TransactionBatch(BaseModel):
    """Batch of transaction events for bulk processing."""

    events: list[TransactionEvent]
    batch_id: str
    source: str = "kafka"
    received_at: datetime = Field(default_factory=datetime.utcnow)

    @property
    def size(self) -> int:
        return len(self.events)
