"""
FinGuard 2026 — Centralized Configuration via Pydantic Settings.

All configuration is driven by environment variables (.env file or system env).
This module provides typed, validated settings objects for every subsystem.
"""

from __future__ import annotations

from enum import Enum
from pathlib import Path
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class AppSettings(BaseSettings):
    """Top-level application settings."""

    model_config = SettingsConfigDict(env_prefix="APP_", env_file=".env", extra="ignore")

    name: str = "finguard"
    env: Environment = Environment.DEVELOPMENT
    debug: bool = True
    log_level: str = "INFO"

    @property
    def is_production(self) -> bool:
        return self.env == Environment.PRODUCTION


class APISettings(BaseSettings):
    """FastAPI gateway configuration."""

    model_config = SettingsConfigDict(env_prefix="API_", env_file=".env", extra="ignore")

    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 4
    key: str = "changeme-generate-a-secure-key"
    rate_limit_rpm: int = 120


class KafkaSettings(BaseSettings):
    """Apache Kafka connection and topic settings."""

    model_config = SettingsConfigDict(env_prefix="KAFKA_", env_file=".env", extra="ignore")

    bootstrap_servers: str = "localhost:9092"
    transaction_topic: str = "transactions"
    consumer_group: str = "finguard-consumer"
    auto_offset_reset: str = "latest"


class FeastSettings(BaseSettings):
    """Feast Feature Store configuration."""

    model_config = SettingsConfigDict(env_prefix="FEAST_", env_file=".env", extra="ignore")

    repo_path: str = "./feature_store"
    online_store_type: str = "sqlite"
    redis_host: str = "localhost"
    redis_port: int = 6379


class ModelSettings(BaseSettings):
    """ML model architecture and runtime configuration."""

    model_config = SettingsConfigDict(env_prefix="MODEL_", env_file=".env", extra="ignore")

    checkpoint_dir: str = "./artifacts/checkpoints"
    device: str = "cpu"

    # GraphSAGE
    graph_hidden: int = 256
    graph_layers: int = 3

    # Transformer
    transformer_d_model: int = 128
    transformer_nhead: int = 8
    transformer_layers: int = 4
    max_seq_len: int = 64

    @field_validator("checkpoint_dir")
    @classmethod
    def ensure_checkpoint_dir(cls, v: str) -> str:
        Path(v).mkdir(parents=True, exist_ok=True)
        return v


class FederatedSettings(BaseSettings):
    """Flower Federated Learning settings."""

    model_config = SettingsConfigDict(env_prefix="FL_", env_file=".env", extra="ignore")

    server_address: str = "0.0.0.0:8080"
    num_rounds: int = 10
    min_fit_clients: int = 2
    min_evaluate_clients: int = 2
    fraction_fit: float = 1.0


class MonitoringSettings(BaseSettings):
    """Drift detection and metrics configuration."""

    model_config = SettingsConfigDict(env_prefix="", env_file=".env", extra="ignore")

    prometheus_port: int = 9090
    drift_threshold: float = 0.1
    drift_alpha: float = 0.01
    drift_check_interval_sec: int = 3600


class DatabaseSettings(BaseSettings):
    """Database connection settings (PostgreSQL, Neo4j, Redis)."""

    model_config = SettingsConfigDict(env_prefix="", env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./finguard.db"
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "finguard2026"
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0


class GSTPortalSettings(BaseSettings):
    """Authorized GSTN/GSP gateway settings for real GST return filing."""

    model_config = SettingsConfigDict(env_prefix="GST_PORTAL_", env_file=".env", extra="ignore")

    enabled: bool = False
    base_url: str = ""
    submit_return_path: str = ""
    auth_token: str = ""
    client_id: str = ""
    client_secret: str = ""
    taxpayer_username: str = ""
    return_type: str = "GSTR3B"
    timeout_seconds: float = 30.0


# ─── Singleton Accessor ────────────────────────────────────────────────────────


class Settings:
    """Lazy-initialized singleton accessor for all settings groups."""

    _instance: Optional[Settings] = None

    def __init__(self) -> None:
        self.app = AppSettings()
        self.api = APISettings()
        self.kafka = KafkaSettings()
        self.feast = FeastSettings()
        self.model = ModelSettings()
        self.federated = FederatedSettings()
        self.monitoring = MonitoringSettings()
        self.database = DatabaseSettings()
        self.gst_portal = GSTPortalSettings()

    @classmethod
    def get(cls) -> Settings:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset(cls) -> None:
        """Reset singleton — useful for testing."""
        cls._instance = None


def get_settings() -> Settings:
    """Convenience function for dependency injection."""
    return Settings.get()
