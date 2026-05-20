"""
FinGuard 2026 — Circuit Breaker Middleware.

Implements the "Kill Switch" for the FastAPI gateway:
  - Monitors GNN inference latency in real-time
  - If latency exceeds 300ms (indicating a graph-traversal attack or overload),
    automatically falls back to XGBoost-only mode
  - Self-heals back to full GNN mode once latency stabilizes

States:
  CLOSED  → Normal operation, GNN + XGBoost ensemble active
  OPEN    → Kill switch triggered, XGBoost-only fallback
  HALF    → Testing if GNN has recovered
"""

from __future__ import annotations

import asyncio
import time
from collections import deque
from enum import Enum
from typing import Any, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from config.logging_config import get_logger

logger = get_logger(__name__)


class CircuitState(str, Enum):
    CLOSED = "closed"      # Normal: full ensemble
    OPEN = "open"          # Kill switch: XGBoost only
    HALF_OPEN = "half_open"  # Testing recovery


class CircuitBreaker:
    """
    Circuit breaker for GNN latency protection.

    Tracks the rolling p95 latency of GNN-related endpoints.
    Trips to OPEN (XGBoost fallback) when latency exceeds threshold.
    """

    def __init__(
        self,
        latency_threshold_ms: float = 300.0,
        failure_threshold: int = 5,
        recovery_timeout_s: float = 60.0,
        window_size: int = 100,
    ):
        self.latency_threshold_ms = latency_threshold_ms
        self.failure_threshold = failure_threshold
        self.recovery_timeout_s = recovery_timeout_s
        self.window_size = window_size

        self.state = CircuitState.CLOSED
        self._latencies: deque[float] = deque(maxlen=window_size)
        self._failure_count = 0
        self._last_failure_time = 0.0
        self._state_change_time = time.time()
        self._total_trips = 0
        self._total_requests = 0

    @property
    def is_tripped(self) -> bool:
        return self.state == CircuitState.OPEN

    @property
    def p95_latency(self) -> float:
        if not self._latencies:
            return 0.0
        sorted_lat = sorted(self._latencies)
        idx = int(len(sorted_lat) * 0.95)
        return sorted_lat[min(idx, len(sorted_lat) - 1)]

    def record_latency(self, latency_ms: float) -> None:
        """Record a GNN inference latency measurement."""
        self._latencies.append(latency_ms)
        self._total_requests += 1

        if self.state == CircuitState.CLOSED:
            if latency_ms > self.latency_threshold_ms:
                self._failure_count += 1
                self._last_failure_time = time.time()

                if self._failure_count >= self.failure_threshold:
                    self._trip()
            else:
                self._failure_count = max(0, self._failure_count - 1)

        elif self.state == CircuitState.HALF_OPEN:
            if latency_ms <= self.latency_threshold_ms:
                self._close()
            else:
                self._trip()

    def should_allow_gnn(self) -> bool:
        """
        Check if GNN inference should be allowed.

        Returns False when circuit is OPEN (use XGBoost fallback).
        Transitions to HALF_OPEN after recovery timeout.
        """
        if self.state == CircuitState.CLOSED:
            return True

        if self.state == CircuitState.OPEN:
            elapsed = time.time() - self._state_change_time
            if elapsed > self.recovery_timeout_s:
                self.state = CircuitState.HALF_OPEN
                self._state_change_time = time.time()
                logger.info("circuit_half_open", msg="Testing GNN recovery")
                return True  # Allow one probe request
            return False

        # HALF_OPEN: allow probe
        return True

    def _trip(self) -> None:
        """Trip the circuit breaker (activate kill switch)."""
        self.state = CircuitState.OPEN
        self._state_change_time = time.time()
        self._total_trips += 1
        self._failure_count = 0
        logger.warning(
            "circuit_breaker_tripped",
            p95_latency=f"{self.p95_latency:.1f}ms",
            threshold=f"{self.latency_threshold_ms}ms",
            total_trips=self._total_trips,
            msg="KILL SWITCH ACTIVATED: Falling back to XGBoost-only mode",
        )

    def _close(self) -> None:
        """Close the circuit (resume normal GNN operation)."""
        self.state = CircuitState.CLOSED
        self._state_change_time = time.time()
        self._failure_count = 0
        logger.info(
            "circuit_breaker_closed",
            msg="GNN recovered — resuming full ensemble mode",
        )

    def force_trip(self) -> None:
        """Manually trip the circuit breaker (admin kill switch)."""
        self._trip()
        logger.warning("circuit_breaker_manual_trip", msg="Admin forced kill switch")

    def force_close(self) -> None:
        """Manually close the circuit breaker."""
        self._close()
        logger.info("circuit_breaker_manual_close", msg="Admin forced GNN resume")

    def get_status(self) -> dict[str, Any]:
        """Get circuit breaker status for monitoring."""
        return {
            "state": self.state.value,
            "is_tripped": self.is_tripped,
            "p95_latency_ms": round(self.p95_latency, 2),
            "latency_threshold_ms": self.latency_threshold_ms,
            "failure_count": self._failure_count,
            "failure_threshold": self.failure_threshold,
            "total_trips": self._total_trips,
            "total_requests": self._total_requests,
            "recovery_timeout_s": self.recovery_timeout_s,
            "time_in_state_s": round(time.time() - self._state_change_time, 1),
            "samples_in_window": len(self._latencies),
        }


# ─── Singleton ────────────────────────────────────────────────────────

_circuit_breaker: CircuitBreaker | None = None


def get_circuit_breaker() -> CircuitBreaker:
    global _circuit_breaker
    if _circuit_breaker is None:
        _circuit_breaker = CircuitBreaker()
    return _circuit_breaker


# ─── FastAPI Middleware ───────────────────────────────────────────────

class CircuitBreakerMiddleware(BaseHTTPMiddleware):
    """
    Middleware that tracks GNN endpoint latency and injects
    a header indicating whether the GNN is available.
    """

    GNN_PATHS = {"/api/v1/predict/fraud", "/api/v1/services/graph/analyze"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        cb = get_circuit_breaker()
        path = request.url.path

        if path in self.GNN_PATHS:
            start = time.time()
            response = await call_next(request)
            latency_ms = (time.time() - start) * 1000

            cb.record_latency(latency_ms)

            response.headers["X-Circuit-State"] = cb.state.value
            response.headers["X-GNN-Latency-Ms"] = f"{latency_ms:.1f}"

            if cb.is_tripped:
                response.headers["X-Fallback-Mode"] = "xgboost-only"

            return response

        response = await call_next(request)
        return response
