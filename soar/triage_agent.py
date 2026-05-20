"""
FinGuard 2026 — SOAR Triage Agent.

First responder in the multi-agent swarm. Evaluates incoming fraud alerts
by analyzing the FinModel ensemble score, transaction velocity, amount
anomalies, and graph contagion risk to classify urgency.

Verdicts:
  IMMEDIATE_ACTION      — Freeze account NOW (confidence ≥ 0.90)
  NEEDS_INVESTIGATION   — Hand off to Terminal Agent for deep-dive
  FALSE_POSITIVE        — Close alert (confidence of fraud < 0.30)
"""

from __future__ import annotations

import time
from typing import Any

from config.logging_config import get_logger
from soar.models import (
    FraudAlert,
    TriageResult,
    TriageVerdict,
)

logger = get_logger(__name__)

# ─── Prompt Template ────────────────────────────────────────────────────────

TRIAGE_SYSTEM_PROMPT = """You are a Senior Fraud Analyst performing initial triage on an incoming 
high-risk alert in the FinGuard 2026 autonomous fraud prevention platform.

Your role:
1. Evaluate the ensemble fraud score and its component weights (graph, temporal, biometric).
2. Assess transaction velocity and amount anomalies from real-time features.
3. Check graph contagion risk — is this user connected to known mule accounts?
4. Issue a verdict: IMMEDIATE_ACTION, NEEDS_INVESTIGATION, or FALSE_POSITIVE.

Decision thresholds:
- fraud_score ≥ 0.90 AND multiple risk factors → IMMEDIATE_ACTION
- fraud_score ≥ 0.60 OR suspicious patterns → NEEDS_INVESTIGATION
- fraud_score < 0.30 AND no risk factors → FALSE_POSITIVE

Always explain your reasoning with specific data points from the alert."""

TRIAGE_ALERT_TEMPLATE = """
ALERT: {alert_id}
Transaction: {transaction_id} | User: {user_id}
Amount: {currency} {amount:,.2f} | Merchant: {merchant_id}
Device: {device_id} | IP: {ip_address}
Timestamp: {timestamp}

ENSEMBLE SCORE: {fraud_score:.4f} (risk_level: {risk_level})
  Graph contribution:     {graph_contribution:.4f}
  Temporal contribution:  {temporal_contribution:.4f}
  Biometric contribution: {biometric_contribution:.4f}

REASON CODES:
{reason_codes_formatted}

VELOCITY CHECK:
{velocity_data}

GRAPH CONTAGION:
{contagion_data}
"""


class TriageAgent:
    """
    Triage Agent — first responder in the SOAR swarm.

    Evaluates alert severity using ensemble scores, velocity checks,
    and graph contagion data. Classifies into three verdict categories.
    """

    def __init__(self, neo4j_client: Any = None) -> None:
        self._neo4j = neo4j_client
        self._init_graph_client()

    def _init_graph_client(self) -> None:
        if self._neo4j is None:
            try:
                from database.neo4j_client import Neo4jClient
                self._neo4j = Neo4jClient()
            except Exception as e:
                logger.warning("triage_neo4j_init_failed", error=str(e))

    def evaluate(self, alert: FraudAlert) -> TriageResult:
        """
        Evaluate a fraud alert and produce a triage verdict.

        Uses rule-based analysis with optional LLM enhancement.
        """
        start = time.time()
        logger.info("triage_started", alert_id=alert.alert_id,
                    fraud_score=alert.fraud_score)

        # ── Gather intelligence ─────────────────────────────────────
        velocity = self._check_velocity(alert)
        amount_anomaly = self._check_amount_anomaly(alert)
        contagion = self._check_graph_contagion(alert)

        # ── Compute composite risk factors ──────────────────────────
        risk_factors: list[str] = []

        # 1. Ensemble score analysis
        if alert.fraud_score >= 0.90:
            risk_factors.append(f"Critical ensemble score: {alert.fraud_score:.4f}")
        elif alert.fraud_score >= 0.70:
            risk_factors.append(f"High ensemble score: {alert.fraud_score:.4f}")

        # 2. Component imbalance (one model strongly disagrees)
        weights = [alert.graph_contribution, alert.temporal_contribution,
                   alert.biometric_contribution]
        if max(weights) > 0.6:
            dominant = ["graph", "temporal", "biometric"][weights.index(max(weights))]
            risk_factors.append(f"Score dominated by {dominant} model ({max(weights):.2f})")

        # 3. Velocity anomalies
        if velocity.get("tx_count_1h", 0) > 10:
            risk_factors.append(
                f"High velocity: {velocity['tx_count_1h']} txns in 1h")
        if velocity.get("tx_count_5m", 0) > 3:
            risk_factors.append(
                f"Burst activity: {velocity['tx_count_5m']} txns in 5min")

        # 4. Amount anomaly
        if amount_anomaly.get("z_score", 0) > 3.0:
            risk_factors.append(
                f"Amount anomaly: z-score={amount_anomaly['z_score']:.2f}")
        if amount_anomaly.get("exceeds_daily_limit", False):
            risk_factors.append("Exceeds typical daily transaction limit")

        # 5. Graph contagion
        if contagion.get("connected_mules", 0) > 0:
            risk_factors.append(
                f"Connected to {contagion['connected_mules']} mule account(s) "
                f"(closest: {contagion.get('closest_distance', '?')} hops)")
        if contagion.get("contagion_risk", 0) > 0.3:
            risk_factors.append(
                f"High contagion risk: {contagion['contagion_risk']:.4f}")

        # 6. Reason codes
        for code, impact in alert.reason_codes.items():
            if abs(impact) > 0.15:
                direction = "↑" if impact > 0 else "↓"
                risk_factors.append(f"Reason code: {code} ({direction}{abs(impact):.2f})")

        # ── Determine verdict ───────────────────────────────────────
        confidence, verdict = self._compute_verdict(
            alert.fraud_score, risk_factors, contagion, velocity)

        # ── Build reasoning ─────────────────────────────────────────
        reasoning = self._build_reasoning(
            alert, verdict, confidence, risk_factors, velocity,
            amount_anomaly, contagion)

        elapsed = (time.time() - start) * 1000
        logger.info("triage_complete", alert_id=alert.alert_id,
                    verdict=verdict.value, confidence=round(confidence, 4),
                    risk_factors=len(risk_factors), latency_ms=round(elapsed, 1))

        return TriageResult(
            verdict=verdict,
            confidence=round(confidence, 4),
            risk_factors=risk_factors,
            ensemble_score_analysis=(
                f"Score {alert.fraud_score:.4f} with weights "
                f"G={alert.graph_contribution:.2f} "
                f"T={alert.temporal_contribution:.2f} "
                f"B={alert.biometric_contribution:.2f}"
            ),
            velocity_check=velocity,
            amount_anomaly=amount_anomaly,
            graph_contagion=contagion,
            reasoning=reasoning,
        )

    def _compute_verdict(
        self,
        fraud_score: float,
        risk_factors: list[str],
        contagion: dict,
        velocity: dict,
    ) -> tuple[float, TriageVerdict]:
        """Compute verdict and confidence from gathered intelligence."""
        n_factors = len(risk_factors)
        has_mule_connection = contagion.get("connected_mules", 0) > 0
        high_velocity = velocity.get("tx_count_1h", 0) > 10

        # IMMEDIATE_ACTION: high score + multiple corroborating signals
        if fraud_score >= 0.90 and n_factors >= 3:
            return min(fraud_score + 0.02, 1.0), TriageVerdict.IMMEDIATE_ACTION
        if fraud_score >= 0.85 and has_mule_connection:
            return fraud_score, TriageVerdict.IMMEDIATE_ACTION
        if fraud_score >= 0.80 and n_factors >= 4:
            return fraud_score, TriageVerdict.IMMEDIATE_ACTION

        # FALSE_POSITIVE: low score + no risk factors
        if fraud_score < 0.30 and n_factors == 0:
            return 1.0 - fraud_score, TriageVerdict.FALSE_POSITIVE
        if fraud_score < 0.20:
            return 1.0 - fraud_score, TriageVerdict.FALSE_POSITIVE

        # NEEDS_INVESTIGATION: everything else
        confidence = min(0.5 + (n_factors * 0.08) + (fraud_score * 0.2), 0.95)
        return round(confidence, 4), TriageVerdict.NEEDS_INVESTIGATION

    def _check_velocity(self, alert: FraudAlert) -> dict[str, Any]:
        """Check transaction velocity from streaming features."""
        try:
            from ingestion.stream_processor import RealTimeFeatureComputer
            processor = RealTimeFeatureComputer()
            features = processor.process({
                "user_id": alert.user_id,
                "amount": alert.amount,
                "timestamp": alert.timestamp,
                "device_id": alert.device_id,
                "ip_address": alert.ip_address,
                "latitude": 0.0, "longitude": 0.0,
            })
            return {
                "tx_count_1h": features.get("tx_count_1h", 0),
                "tx_count_5m": features.get("tx_count_5m", 0),
                "amount_sum_1h": features.get("amount_sum_1h", 0),
                "geo_velocity_kmh": features.get("geo_velocity_kmh", 0),
            }
        except Exception:
            return {"tx_count_1h": 0, "tx_count_5m": 0,
                    "amount_sum_1h": 0, "geo_velocity_kmh": 0}

    def _check_amount_anomaly(self, alert: FraudAlert) -> dict[str, Any]:
        """Assess whether the transaction amount is anomalous."""
        # Heuristic thresholds (production: personalized per user)
        daily_limit = 5000.0
        return {
            "amount": alert.amount,
            "z_score": min(alert.amount / 1000.0, 5.0),  # simplified
            "exceeds_daily_limit": alert.amount > daily_limit,
            "daily_limit": daily_limit,
        }

    def _check_graph_contagion(self, alert: FraudAlert) -> dict[str, Any]:
        """Query graph for mule account proximity."""
        if self._neo4j is None:
            return {"connected_mules": 0, "contagion_risk": 0.0}
        try:
            from services.graph_intelligence import RiskContagionEngine
            engine = RiskContagionEngine(self._neo4j)
            result = engine.compute_contagion_risk(alert.user_id)
            return {
                "connected_mules": result.get("connected_mules", 0),
                "contagion_risk": result.get("contagion_risk", 0.0),
                "closest_distance": result.get("closest_mule_distance"),
                "risk_paths": result.get("risk_paths", [])[:3],
            }
        except Exception as e:
            logger.warning("contagion_check_failed", error=str(e))
            return {"connected_mules": 0, "contagion_risk": 0.0}

    def _build_reasoning(
        self, alert: FraudAlert, verdict: TriageVerdict,
        confidence: float, risk_factors: list[str],
        velocity: dict, amount: dict, contagion: dict,
    ) -> str:
        """Build human-readable reasoning summary."""
        lines = [
            f"## Triage Report — {alert.alert_id}",
            f"**Verdict:** {verdict.value.upper()} (confidence: {confidence:.2%})",
            f"**Ensemble Score:** {alert.fraud_score:.4f}",
            "",
            f"### Risk Factors ({len(risk_factors)}):",
        ]
        for i, f in enumerate(risk_factors, 1):
            lines.append(f"  {i}. {f}")

        lines.append("")
        lines.append(f"### Velocity: {velocity.get('tx_count_1h', 0)} txns/1h, "
                      f"{velocity.get('tx_count_5m', 0)} txns/5min")
        lines.append(f"### Amount: ${alert.amount:,.2f} "
                      f"(z-score: {amount.get('z_score', 0):.2f})")

        if contagion.get("connected_mules", 0) > 0:
            lines.append(f"### Graph: Connected to "
                         f"{contagion['connected_mules']} mule(s)")
        return "\n".join(lines)
