"""
FinGuard 2026 — OAuth2/JWT Authentication.

Service-to-service JWT authentication and OAuth2/OIDC integration
for the API gateway and internal microservices.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from base64 import urlsafe_b64decode, urlsafe_b64encode
from typing import Any, Optional

from config.logging_config import get_logger

logger = get_logger(__name__)

# JWT secret (in production, use RSA keys or JWKS endpoint)
_JWT_SECRET = "finguard-jwt-secret-change-in-production-2026"
_JWT_ALGORITHM = "HS256"
_JWT_EXPIRY_SECONDS = 3600


def _b64encode(data: bytes) -> str:
    return urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64decode(data: str) -> bytes:
    padding = 4 - len(data) % 4
    return urlsafe_b64decode(data + "=" * padding)


def _sign(payload: str, secret: str) -> str:
    return _b64encode(
        hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest()
    )


def create_jwt(subject: str, roles: list[str] | None = None,
               extra_claims: dict | None = None,
               expiry_seconds: int = _JWT_EXPIRY_SECONDS) -> str:
    """
    Create a JWT token for service-to-service authentication.

    Args:
        subject: User/service identifier.
        roles: List of roles (e.g., ["admin", "fraud_analyst"]).
        extra_claims: Additional JWT claims.
        expiry_seconds: Token validity in seconds.

    Returns:
        Signed JWT string.
    """
    header = {"alg": _JWT_ALGORITHM, "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + expiry_seconds,
        "roles": roles or [],
        **(extra_claims or {}),
    }

    header_b64 = _b64encode(json.dumps(header).encode())
    payload_b64 = _b64encode(json.dumps(payload).encode())
    signing_input = f"{header_b64}.{payload_b64}"
    signature = _sign(signing_input, _JWT_SECRET)

    return f"{header_b64}.{payload_b64}.{signature}"


def verify_jwt(token: str) -> Optional[dict[str, Any]]:
    """
    Verify and decode a JWT token.

    Returns:
        Decoded payload dict, or None if invalid/expired.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        header_b64, payload_b64, signature = parts
        signing_input = f"{header_b64}.{payload_b64}"
        expected_sig = _sign(signing_input, _JWT_SECRET)

        if not hmac.compare_digest(signature, expected_sig):
            logger.warning("jwt_invalid_signature")
            return None

        payload = json.loads(_b64decode(payload_b64))

        # Check expiry
        if payload.get("exp", 0) < time.time():
            logger.warning("jwt_expired", subject=payload.get("sub"))
            return None

        return payload

    except Exception as e:
        logger.warning("jwt_verification_failed", error=str(e))
        return None


def require_role(payload: dict[str, Any], required_role: str) -> bool:
    """Check if a JWT payload contains the required role."""
    roles = payload.get("roles", [])
    return required_role in roles


# ─── FastAPI Dependency ─────────────────────────────────────────────────────

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer_scheme = HTTPBearer(auto_error=False)


async def verify_jwt_token(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer_scheme),
) -> dict[str, Any]:
    """FastAPI dependency: verify Bearer JWT token."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    payload = verify_jwt(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired JWT token",
        )

    return payload


def require_admin(payload: dict = Depends(verify_jwt_token)) -> dict:
    """Dependency: require admin role."""
    if not require_role(payload, "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                          detail="Admin role required")
    return payload
