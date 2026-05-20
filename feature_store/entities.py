"""
FinGuard 2026 — Feast Entity Definitions.

Defines the core entities for the feature store:
- User: primary entity for fraud and credit scoring
- Device: device fingerprint entity
- Merchant: merchant entity
"""

from feast import Entity, ValueType

# ─── Core Entities ──────────────────────────────────────────────────────────

user_entity = Entity(
    name="user_id",
    value_type=ValueType.STRING,
    description="Anonymized user/account identifier",
)

device_entity = Entity(
    name="device_id",
    value_type=ValueType.STRING,
    description="Device fingerprint hash",
)

merchant_entity = Entity(
    name="merchant_id",
    value_type=ValueType.STRING,
    description="Merchant identifier",
)
