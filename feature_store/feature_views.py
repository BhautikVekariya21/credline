"""
FinGuard 2026 — Feast Feature View Definitions.

Defines feature views for real-time and batch features:
- Transaction velocity (real-time)
- User spending profile (batch)
- Utility payment consistency (batch)
- Telco profile features (batch)
"""

from datetime import timedelta

from feast import FeatureView, Field, FileSource
from feast.types import Float32, Float64, Int64, String

from feature_store.entities import user_entity

# ─── Data Sources ───────────────────────────────────────────────────────────

transaction_source = FileSource(
    path="data/synthetic/output/transactions.csv",
    timestamp_field="timestamp",
)

# ─── Feature Views ──────────────────────────────────────────────────────────

user_transaction_features = FeatureView(
    name="user_transaction_features",
    entities=[user_entity],
    ttl=timedelta(days=1),
    schema=[
        Field(name="amount", dtype=Float64),
        Field(name="amount_log", dtype=Float64),
        Field(name="hour_of_day", dtype=Int64),
        Field(name="day_of_week", dtype=Int64),
        Field(name="channel", dtype=String),
        Field(name="merchant_category", dtype=String),
        Field(name="country_code", dtype=String),
    ],
    source=transaction_source,
    online=True,
    description="Per-transaction features for user activity",
)
