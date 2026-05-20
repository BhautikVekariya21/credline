"""
FinGuard 2026 — Utility Bill Schema.

Captures utility payment history for alternative credit scoring.
Consistent utility payments are a strong signal of creditworthiness
for unbanked populations.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class UtilityType(str, Enum):
    """Types of utility services tracked."""

    ELECTRICITY = "electricity"
    WATER = "water"
    GAS = "gas"
    INTERNET = "internet"
    RENT = "rent"


class PaymentStatus(str, Enum):
    """Payment status for a billing period."""

    PAID_ON_TIME = "paid_on_time"
    PAID_LATE = "paid_late"
    PARTIAL = "partial"
    MISSED = "missed"


class UtilityPayment(BaseModel):
    """Single utility payment record."""

    billing_period: str = Field(
        ..., description="Billing period (e.g., '2026-01')"
    )
    due_date: date
    payment_date: Optional[date] = None
    amount_due: float = Field(..., ge=0)
    amount_paid: float = Field(default=0.0, ge=0)
    status: PaymentStatus = PaymentStatus.MISSED
    days_late: int = Field(default=0, ge=0)


class UtilityProfile(BaseModel):
    """
    Utility payment profile for a user.

    Tracks payment consistency across utility types to build
    a "Virtual Ledger" for creditworthiness assessment.

    Key signals:
    - Same-day payment patterns (stability)
    - Consistent payment amounts (income stability)
    - Payment punctuality (responsibility)
    """

    user_id: str = Field(..., description="Anonymized user identifier")
    utility_type: UtilityType = Field(..., description="Type of utility")
    provider: str = Field(..., description="Utility provider name")
    account_number_hash: str = Field(
        ..., description="Hashed account number"
    )

    # Account metadata
    account_start_date: date = Field(
        ..., description="When the account was opened"
    )
    account_tenure_months: int = Field(
        ..., ge=0, description="Months as customer"
    )

    # Payment history (last 12 months)
    payment_history: list[UtilityPayment] = Field(
        default_factory=list,
        description="Last 12 months of payment records",
    )

    # Computed consistency metrics
    on_time_rate: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Percentage of payments made on time",
    )
    payment_consistency_index: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Consistency of payment amounts (low CoV = high score)",
    )
    avg_monthly_amount: float = Field(
        default=0.0, ge=0, description="Average monthly payment"
    )
    payment_day_consistency: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="How consistently payments land on the same day",
    )
    missed_payments_12m: int = Field(
        default=0, ge=0, description="Number of missed payments in 12 months"
    )
    late_payments_12m: int = Field(
        default=0, ge=0, description="Number of late payments in 12 months"
    )

    # Timestamps
    data_collected_at: datetime = Field(
        default_factory=datetime.utcnow,
    )

    def compute_consistency_metrics(self) -> None:
        """Compute derived consistency metrics from payment history."""
        if not self.payment_history:
            return

        total = len(self.payment_history)
        on_time = sum(
            1 for p in self.payment_history if p.status == PaymentStatus.PAID_ON_TIME
        )
        self.on_time_rate = on_time / total

        self.missed_payments_12m = sum(
            1 for p in self.payment_history if p.status == PaymentStatus.MISSED
        )
        self.late_payments_12m = sum(
            1 for p in self.payment_history if p.status == PaymentStatus.PAID_LATE
        )

        amounts = [p.amount_paid for p in self.payment_history if p.amount_paid > 0]
        if amounts:
            import numpy as np

            mean_amt = float(np.mean(amounts))
            std_amt = float(np.std(amounts))
            self.avg_monthly_amount = mean_amt
            # Coefficient of variation → consistency (inverted)
            cov = std_amt / mean_amt if mean_amt > 0 else 1.0
            self.payment_consistency_index = max(0.0, 1.0 - cov)

        # Day consistency: std of payment days
        payment_days = [
            p.payment_date.day
            for p in self.payment_history
            if p.payment_date is not None
        ]
        if len(payment_days) >= 2:
            import numpy as np

            day_std = float(np.std(payment_days))
            # Normalize: 0 std → 1.0, 15 std → 0.0
            self.payment_day_consistency = max(0.0, 1.0 - day_std / 15.0)
