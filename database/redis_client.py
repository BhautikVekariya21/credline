"""
FinGuard 2026 — Redis Client.

Real-time caching for session biometrics, feature store serving,
and rate limiting state.
"""

from __future__ import annotations

import json
from typing import Any, Optional

from config.logging_config import get_logger

logger = get_logger(__name__)


class RedisClient:
    """Redis client for real-time caching and session management."""

    def __init__(self, host: str = "localhost", port: int = 6379, db: int = 0):
        self.host = host
        self.port = port
        self.db = db
        self._client = None

    def _get_client(self) -> Any:
        if self._client is None:
            try:
                import redis
                self._client = redis.Redis(
                    host=self.host, port=self.port, db=self.db,
                    decode_responses=True, socket_connect_timeout=5,
                )
                self._client.ping()
                logger.info("redis_connected", host=self.host, port=self.port)
            except (ImportError, Exception) as e:
                logger.warning("redis_unavailable", error=str(e),
                             msg="Using in-memory fallback")
                self._client = InMemoryCache()
        return self._client

    # ─── Session Biometrics ─────────────────────────────────────────────

    def store_session_biometrics(self, session_id: str, data: dict,
                                  ttl: int = 3600) -> None:
        """Store biometric session data with TTL."""
        client = self._get_client()
        key = f"bio:session:{session_id}"
        client.setex(key, ttl, json.dumps(data, default=str))

    def get_session_biometrics(self, session_id: str) -> Optional[dict]:
        client = self._get_client()
        key = f"bio:session:{session_id}"
        data = client.get(key)
        return json.loads(data) if data else None

    # ─── User Profiles ──────────────────────────────────────────────────

    def cache_user_profile(self, user_id: str, profile: dict,
                            ttl: int = 300) -> None:
        client = self._get_client()
        key = f"user:profile:{user_id}"
        client.setex(key, ttl, json.dumps(profile, default=str))

    def get_user_profile(self, user_id: str) -> Optional[dict]:
        client = self._get_client()
        data = client.get(f"user:profile:{user_id}")
        return json.loads(data) if data else None

    # ─── Real-time Features ─────────────────────────────────────────────

    def cache_features(self, user_id: str, features: dict,
                       ttl: int = 60) -> None:
        client = self._get_client()
        client.setex(f"features:{user_id}", ttl, json.dumps(features))

    def get_cached_features(self, user_id: str) -> Optional[dict]:
        client = self._get_client()
        data = client.get(f"features:{user_id}")
        return json.loads(data) if data else None

    # ─── Shadow Mode State ──────────────────────────────────────────────

    def set_shadow_mode(self, model_name: str, enabled: bool) -> None:
        client = self._get_client()
        client.set(f"shadow:{model_name}", "1" if enabled else "0")

    def is_shadow_mode(self, model_name: str) -> bool:
        client = self._get_client()
        return client.get(f"shadow:{model_name}") == "1"

    # ─── Generic ────────────────────────────────────────────────────────

    def increment(self, key: str) -> int:
        client = self._get_client()
        return int(client.incr(key))

    def close(self) -> None:
        if self._client and hasattr(self._client, "close"):
            self._client.close()


class InMemoryCache:
    """Fallback in-memory cache when Redis is not available."""

    def __init__(self) -> None:
        self._store: dict[str, str] = {}

    def setex(self, key: str, ttl: int, value: str) -> None:
        self._store[key] = value

    def set(self, key: str, value: str) -> None:
        self._store[key] = value

    def get(self, key: str) -> Optional[str]:
        return self._store.get(key)

    def incr(self, key: str) -> int:
        val = int(self._store.get(key, "0")) + 1
        self._store[key] = str(val)
        return val

    def ping(self) -> bool:
        return True
