"""
FinGuard 2026 — HashiCorp Vault Secrets Management.

Provides integration with Vault for secure storage and retrieval
of database credentials, JWT keys, and API tokens.
Falls back to environment variables / .env when Vault is unavailable.
"""

from __future__ import annotations

import os
from typing import Any

from config.logging_config import get_logger

logger = get_logger(__name__)


class VaultClient:
    """
    HashiCorp Vault client for secrets management.

    Secret paths:
      secret/finguard/database    — PostgreSQL, Neo4j, Redis creds
      secret/finguard/jwt         — JWT signing keys
      secret/finguard/api         — API keys, external service tokens
      secret/finguard/kafka       — Kafka SASL credentials
      secret/finguard/mlflow      — MLflow tracking credentials
    """

    def __init__(
        self,
        vault_addr: str | None = None,
        vault_token: str | None = None,
        mount_path: str = "secret",
    ):
        self.vault_addr = vault_addr or os.getenv("VAULT_ADDR", "http://localhost:8200")
        self.vault_token = vault_token or os.getenv("VAULT_TOKEN", "")
        self.mount_path = mount_path
        self._client = None
        self._cache: dict[str, Any] = {}
        self._init_client()

    def _init_client(self) -> None:
        if not self.vault_token:
            logger.info("vault_no_token", msg="Using env variable fallback")
            return
        try:
            import hvac

            self._client = hvac.Client(url=self.vault_addr, token=self.vault_token)
            if self._client.is_authenticated():
                logger.info("vault_connected", addr=self.vault_addr)
            else:
                logger.warning("vault_auth_failed")
                self._client = None
        except ImportError:
            logger.warning("hvac_not_installed", msg="Using env variable fallback")
        except Exception as e:
            logger.warning("vault_connection_failed", error=str(e))

    def get_secret(self, path: str, key: str, default: str = "") -> str:
        """
        Retrieve a secret value.

        Args:
            path: Vault path under the mount (e.g., "finguard/database")
            key: Secret key name (e.g., "password")
            default: Fallback value if Vault is unavailable.
        """
        cache_key = f"{path}/{key}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        if self._client:
            try:
                response = self._client.secrets.kv.v2.read_secret_version(
                    path=path, mount_point=self.mount_path
                )
                value = response["data"]["data"].get(key, default)
                self._cache[cache_key] = value
                return value
            except Exception as e:
                logger.warning("vault_read_failed", path=path, key=key, error=str(e))

        # Fallback to environment variable
        env_key = f"{path.replace('/', '_').upper()}_{key.upper()}"
        return os.getenv(env_key, default)

    def get_database_secrets(self) -> dict[str, str]:
        """Get all database-related secrets."""
        return {
            "postgres_url": self.get_secret(
                "finguard/database", "postgres_url", "sqlite:///./finguard.db"
            ),
            "neo4j_password": self.get_secret(
                "finguard/database", "neo4j_password", "finguard2026"
            ),
            "redis_password": self.get_secret(
                "finguard/database", "redis_password", ""
            ),
        }

    def get_jwt_secret(self) -> str:
        return self.get_secret(
            "finguard/jwt", "signing_key",
            "finguard-jwt-secret-change-in-production-2026",
        )

    def get_api_key(self) -> str:
        return self.get_secret(
            "finguard/api", "api_key", "changeme-generate-a-secure-key"
        )


# ─── Vault Policy Templates ────────────────────────────────────────────────

VAULT_POLICY_TEMPLATE = """
# FinGuard 2026 — Vault Policy
# Apply with: vault policy write finguard-api finguard-policy.hcl

path "secret/data/finguard/*" {
  capabilities = ["read", "list"]
}

path "secret/metadata/finguard/*" {
  capabilities = ["list"]
}
"""

VAULT_SETUP_SCRIPT = """#!/bin/bash
# FinGuard 2026 — Vault Secret Initialization
# Run this once to seed Vault with initial secrets

vault kv put secret/finguard/database \\
  postgres_url="postgresql://finguard:CHANGE_ME@db:5432/finguard" \\
  neo4j_password="CHANGE_ME" \\
  redis_password=""

vault kv put secret/finguard/jwt \\
  signing_key="$(openssl rand -hex 32)"

vault kv put secret/finguard/api \\
  api_key="$(openssl rand -hex 24)"

vault kv put secret/finguard/kafka \\
  sasl_username="finguard" \\
  sasl_password="CHANGE_ME"

vault kv put secret/finguard/mlflow \\
  tracking_uri="http://mlflow:5000" \\
  artifact_store="s3://finguard-artifacts"

echo "✅ Vault secrets initialized for FinGuard 2026"
"""
