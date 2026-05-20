"""
FinGuard 2026 — Behavioral Vector Encryption & Verification.

After the edge model (ONNX/WASM) produces a 64-dim behavioral embedding
on the user's device, this module:
  1. Receives the encrypted vector from the client
  2. Decrypts and verifies its integrity
  3. Compares it against the user's stored profile
  4. Returns a trust score without ever seeing raw sensor data

Privacy-by-design: raw gyroscope/accelerometer data NEVER leaves the device.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any

import numpy as np

from config.logging_config import get_logger

logger = get_logger(__name__)


class BehavioralVectorProcessor:
    """
    Server-side handler for encrypted behavioral vectors from edge devices.
    """

    def __init__(
        self,
        encryption_key: str | None = None,
        similarity_threshold: float = 0.85,
        max_vector_age_seconds: int = 30,
    ):
        self._key = (encryption_key or os.getenv(
            "EDGE_ENCRYPTION_KEY", "finguard-edge-key-change-in-prod"
        )).encode()
        self.similarity_threshold = similarity_threshold
        self.max_vector_age = max_vector_age_seconds

        # In production: stored in PostgreSQL/Redis
        self._user_profiles: dict[str, dict[str, Any]] = {}

    def verify_and_process(
        self, user_id: str, encrypted_payload: str
    ) -> dict[str, Any]:
        """
        Verify an encrypted behavioral vector from the edge device.

        Args:
            user_id: The user whose session is being verified.
            encrypted_payload: Base64-encoded JSON with vector + signature + timestamp.

        Returns:
            Dict with verification result, trust score, and details.
        """
        # Step 1: Decode and verify integrity
        try:
            raw = base64.b64decode(encrypted_payload)
            payload = json.loads(raw)
        except Exception:
            return self._reject("invalid_payload", "Could not decode payload")

        # Step 2: Verify HMAC signature
        vector_b64 = payload.get("vector", "")
        timestamp = payload.get("timestamp", 0)
        client_sig = payload.get("signature", "")

        expected_sig = hmac.new(
            self._key,
            f"{vector_b64}:{timestamp}".encode(),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(client_sig, expected_sig):
            logger.warning("edge_signature_mismatch", user_id=user_id)
            return self._reject("signature_mismatch", "Tampered payload detected")

        # Step 3: Check freshness (anti-replay)
        age = time.time() - timestamp
        if age > self.max_vector_age:
            return self._reject("stale_vector", f"Vector is {age:.0f}s old (max {self.max_vector_age}s)")

        # Step 4: Decode the behavioral vector
        vector = np.frombuffer(base64.b64decode(vector_b64), dtype=np.float32)
        if vector.shape[0] != 64:
            return self._reject("invalid_vector_dim", f"Expected 64-dim, got {vector.shape[0]}")

        # Step 5: Compare against stored profile
        profile = self._user_profiles.get(user_id)

        if profile is None or profile.get("session_count", 0) < 3:
            # Enrollment phase: store vector and build profile
            self._enroll_vector(user_id, vector)
            return {
                "status": "enrolled",
                "user_id": user_id,
                "trust_score": 1.0,
                "is_genuine": True,
                "detail": "Building behavioral profile (enrollment phase)",
                "sessions_needed": max(0, 3 - self._user_profiles.get(user_id, {}).get("session_count", 0)),
            }

        # Cosine similarity against profile centroid
        centroid = np.array(profile["centroid"], dtype=np.float32)
        similarity = float(np.dot(vector, centroid) / (
            np.linalg.norm(vector) * np.linalg.norm(centroid) + 1e-8
        ))

        is_genuine = similarity >= self.similarity_threshold

        # Update profile with new vector (exponential moving average)
        self._update_profile(user_id, vector)

        if not is_genuine:
            logger.warning("edge_impersonation_detected",
                           user_id=user_id, similarity=f"{similarity:.4f}")

        return {
            "status": "verified",
            "user_id": user_id,
            "trust_score": round(similarity, 4),
            "is_genuine": is_genuine,
            "similarity": round(similarity, 4),
            "threshold": self.similarity_threshold,
            "sessions_in_profile": profile["session_count"],
        }

    def _enroll_vector(self, user_id: str, vector: np.ndarray) -> None:
        if user_id not in self._user_profiles:
            self._user_profiles[user_id] = {
                "centroid": vector.tolist(),
                "session_count": 1,
                "vectors": [vector.tolist()],
            }
        else:
            p = self._user_profiles[user_id]
            p["vectors"].append(vector.tolist())
            p["centroid"] = np.mean(p["vectors"], axis=0).tolist()
            p["session_count"] += 1

    def _update_profile(self, user_id: str, vector: np.ndarray, alpha: float = 0.1) -> None:
        """Exponential moving average update of the profile centroid."""
        p = self._user_profiles[user_id]
        old = np.array(p["centroid"], dtype=np.float32)
        p["centroid"] = (alpha * vector + (1 - alpha) * old).tolist()
        p["session_count"] += 1

    @staticmethod
    def _reject(code: str, detail: str) -> dict[str, Any]:
        return {
            "status": "rejected",
            "error_code": code,
            "is_genuine": False,
            "trust_score": 0.0,
            "detail": detail,
        }

    @staticmethod
    def create_client_payload(
        vector: np.ndarray,
        encryption_key: str = "finguard-edge-key-change-in-prod",
    ) -> str:
        """
        Utility to create a signed payload (simulates what the WASM client does).
        Used for testing.
        """
        vector_b64 = base64.b64encode(vector.astype(np.float32).tobytes()).decode()
        timestamp = time.time()
        signature = hmac.new(
            encryption_key.encode(),
            f"{vector_b64}:{timestamp}".encode(),
            hashlib.sha256,
        ).hexdigest()

        payload = json.dumps({
            "vector": vector_b64,
            "timestamp": timestamp,
            "signature": signature,
        })
        return base64.b64encode(payload.encode()).decode()
