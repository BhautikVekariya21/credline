"""
FinGuard 2026 — Feast On-Demand Feature Transforms.

Computes features at request time that combine multiple sources
or require real-time calculation.
"""

from __future__ import annotations

import pandas as pd
from feast import on_demand_feature_view, Field
from feast.types import Float64

from feature_store.feature_views import user_transaction_features


@on_demand_feature_view(
    sources=[user_transaction_features],
    schema=[
        Field(name="amount_normalized", dtype=Float64),
        Field(name="is_high_value", dtype=Float64),
        Field(name="is_off_hours", dtype=Float64),
    ],
)
def user_transaction_on_demand(inputs: pd.DataFrame) -> pd.DataFrame:
    """Compute on-demand features from transaction data."""
    df = pd.DataFrame()

    # Normalize amount using log transform
    df["amount_normalized"] = inputs["amount"].apply(
        lambda x: min(x / 10000.0, 1.0)  # Cap at 10K
    )

    # High-value transaction flag
    df["is_high_value"] = (inputs["amount"] > 1000).astype(float)

    # Off-hours flag (before 6am or after 11pm)
    df["is_off_hours"] = inputs["hour_of_day"].apply(
        lambda h: 1.0 if h < 6 or h > 23 else 0.0
    )

    return df
