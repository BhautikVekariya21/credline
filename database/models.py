"""
FinGuard 2026 — PostgreSQL ORM Models.

SQLAlchemy models for users, decisions, audit logs, and session biometrics.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.connection import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    """User/Account entity."""
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    external_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Profile (non-PII — hashed or tokenized)
    phone_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    email_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    country_code: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    account_type: Mapped[str] = mapped_column(String(20), default="standard")
    is_unbanked: Mapped[bool] = mapped_column(Boolean, default=False)
    risk_tier: Mapped[str] = mapped_column(String(20), default="unknown")

    # Relationships
    decisions: Mapped[list["Decision"]] = relationship(back_populates="user")
    biometric_profiles: Mapped[list["BiometricProfile"]] = relationship(back_populates="user")


class Decision(Base):
    """Every model decision is recorded for audit compliance."""
    __tablename__ = "decisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    decision_id: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Decision type
    decision_type: Mapped[str] = mapped_column(String(20))  # "fraud" | "credit"
    model_version: Mapped[str] = mapped_column(String(32), default="v1.0.0")

    # Scores
    fraud_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    credit_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    risk_level: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Explainability
    reason_codes: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    shap_values: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    reason_memo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Input features snapshot
    input_features: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Metadata
    latency_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_shadow: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="decisions")

    __table_args__ = (
        Index("ix_decisions_type_date", "decision_type", "created_at"),
    )


class BiometricProfile(Base):
    """Stored behavioral biometric profile for a user."""
    __tablename__ = "biometric_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Behavioral embeddings (stored as JSON arrays)
    keystroke_profile: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    touch_profile: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    device_tilt_profile: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    navigation_profile: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Profile statistics
    num_sessions_trained: Mapped[int] = mapped_column(default=0)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)

    user: Mapped["User"] = relationship(back_populates="biometric_profiles")


class AuditLog(Base):
    """Immutable audit log for compliance."""
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    action: Mapped[str] = mapped_column(String(50), index=True)
    actor: Mapped[str] = mapped_column(String(64))
    resource_type: Mapped[str] = mapped_column(String(30))
    resource_id: Mapped[str] = mapped_column(String(36))
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)


class ModelRegistry(Base):
    """Track deployed model versions for shadow mode."""
    __tablename__ = "model_registry"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    model_name: Mapped[str] = mapped_column(String(64), index=True)
    version: Mapped[str] = mapped_column(String(32))
    deployed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    is_shadow: Mapped[bool] = mapped_column(Boolean, default=False)
    metrics: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    checkpoint_path: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
