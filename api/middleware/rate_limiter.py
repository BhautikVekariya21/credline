"""
FinGuard 2026 — Rate Limiter Middleware.

Token bucket rate limiting per API key to prevent abuse.
"""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Any

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint


class TokenBucket:
    """Token bucket rate limiter."""

    def __init__(self, rate: float, capacity: int):
        self.rate = rate  # tokens per second
        self.capacity = capacity
        self.tokens = float(capacity)
        self.last_refill = time.monotonic()

    def consume(self) -> bool:
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
        self.last_refill = now

        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """Per-client rate limiting middleware."""

    def __init__(self, app: Any, requests_per_minute: int = 120):
        super().__init__(app)
        self.rpm = requests_per_minute
        self.rate = requests_per_minute / 60.0
        self._buckets: dict[str, TokenBucket] = defaultdict(
            lambda: TokenBucket(self.rate, self.rpm)
        )

    async def dispatch(self, request: Request,
                       call_next: RequestResponseEndpoint) -> Response:
        # Skip rate limiting for health checks
        if request.url.path in ("/health", "/readiness", "/metrics"):
            return await call_next(request)

        client_id = self._get_client_id(request)
        bucket = self._buckets[client_id]

        if not bucket.consume():
            return Response(
                content='{"detail": "Rate limit exceeded. Try again later."}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": str(int(60 / self.rpm))},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.rpm)
        response.headers["X-RateLimit-Remaining"] = str(int(bucket.tokens))
        return response

    @staticmethod
    def _get_client_id(request: Request) -> str:
        api_key = request.headers.get("X-API-Key", "")
        if api_key:
            return f"key:{api_key}"
        forwarded = request.headers.get("X-Forwarded-For", "")
        if forwarded:
            return f"ip:{forwarded.split(',')[0].strip()}"
        client = request.client
        return f"ip:{client.host}" if client else "unknown"
