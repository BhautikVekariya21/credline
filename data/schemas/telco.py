"""
FinGuard 2026 — Telco Metadata Schema.

Captures telecommunications usage patterns for alternative credit scoring
of unbanked populations. Telco data is a primary signal for the "thin-file"
credit engine.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class TopUpRecord(BaseModel):
    """Single prepaid top-up event."""

    date: date
    amount: float = Field(..., gt=0)
    channel: str = Field(
        default="mobile_money",
        description="Top-up channel: mobile_money, agent, bank, online",
    )


class TelcoProfile(BaseModel):
    """
    Telecommunications usage profile for a user.

    Captures behavioral stability signals that correlate with creditworthiness:
    - Regular top-up patterns indicate income stability
    - Consistent data usage indicates economic activity
    - Long SIM tenure indicates residential stability
    """

    user_id: str = Field(..., description="Anonymized user identifier")
    phone_hash: str = Field(..., description="Hashed phone number")
    carrier: str = Field(..., description="Telecom carrier name")

    # SIM metadata
    sim_registration_date: date = Field(
        ..., description="Date the SIM was first registered"
    )
    sim_tenure_months: int = Field(
        ..., ge=0, description="Months since SIM registration"
    )
    is_primary_sim: bool = Field(
        default=True, description="Whether this is the user's primary SIM"
    )

    # Top-up behavior (last 6 months)
    topup_history: list[TopUpRecord] = Field(
        default_factory=list, description="Last 6 months of top-up records"
    )
    avg_monthly_topup: float = Field(
        default=0.0, ge=0, description="Average monthly top-up amount"
    )
    topup_regularity_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Regularity of top-ups (1.0 = perfectly consistent)",
    )
    preferred_topup_day: Optional[int] = Field(
        default=None,
        ge=1,
        le=31,
        description="Most common day of month for top-ups",
    )

    # Usage patterns
    avg_daily_calls_min: float = Field(
        default=0.0, ge=0, description="Average daily call minutes"
    )
    avg_daily_data_mb: float = Field(
        default=0.0, ge=0, description="Average daily data usage (MB)"
    )
    data_usage_consistency: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Consistency of data usage (low variance = high score)",
    )
    sms_per_day: float = Field(
        default=0.0, ge=0, description="Average SMS sent per day"
    )

    # Network quality
    unique_contacts_30d: int = Field(
        default=0, ge=0, description="Unique contacts in last 30 days"
    )
    international_calls_pct: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Percentage of calls that are international",
    )

    # Timestamps
    data_collected_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="When this profile was compiled",
    )

    @property
    def topup_count_6m(self) -> int:
        """Total number of top-ups in the last 6 months."""
        return len(self.topup_history)
