"""
FinGuard 2026 — Prometheus Metrics Collector.

Exposes application metrics for monitoring:
- Request latency histograms
- Prediction score distributions
- Model version info
- Drift alert counters
"""

from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram, Info


# ─── Request Metrics ────────────────────────────────────────────────────────

REQUEST_LATENCY = Histogram(
    "finguard_request_latency_seconds",
    "Request latency in seconds",
    ["endpoint", "method"],
    buckets=[0.01, 0.025, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3, 0.5, 1.0],
)

REQUEST_COUNT = Counter(
    "finguard_requests_total",
    "Total request count",
    ["endpoint", "method", "status_code"],
)

# ─── Prediction Metrics ─────────────────────────────────────────────────────

FRAUD_SCORE = Histogram(
    "finguard_fraud_score",
    "Distribution of fraud scores",
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
)

CREDIT_SCORE = Histogram(
    "finguard_credit_score",
    "Distribution of credit scores",
    buckets=[300, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850],
)

RISK_LEVEL_COUNT = Counter(
    "finguard_risk_level_total",
    "Count of predictions by risk level",
    ["risk_level"],
)

# ─── Model Metrics ──────────────────────────────────────────────────────────

MODEL_INFO = Info(
    "finguard_model",
    "Model version and metadata",
)

MODEL_LOAD_TIME = Gauge(
    "finguard_model_load_seconds",
    "Time taken to load models",
)

# ─── Drift Metrics ──────────────────────────────────────────────────────────

DRIFT_ALERTS = Counter(
    "finguard_drift_alerts_total",
    "Total drift alerts triggered",
    ["feature", "severity"],
)

DRIFT_KS_STATISTIC = Gauge(
    "finguard_drift_ks_statistic",
    "Latest KS statistic per feature",
    ["feature"],
)


def record_prediction(endpoint: str, fraud_score: float | None = None,
                       credit_score: float | None = None,
                       risk_level: str | None = None) -> None:
    """Record prediction metrics."""
    if fraud_score is not None:
        FRAUD_SCORE.observe(fraud_score)
    if credit_score is not None:
        CREDIT_SCORE.observe(credit_score)
    if risk_level is not None:
        RISK_LEVEL_COUNT.labels(risk_level=risk_level).inc()


def record_drift_alert(feature: str, severity: str,
                        ks_statistic: float) -> None:
    """Record a drift detection alert."""
    DRIFT_ALERTS.labels(feature=feature, severity=severity).inc()
    DRIFT_KS_STATISTIC.labels(feature=feature).set(ks_statistic)
