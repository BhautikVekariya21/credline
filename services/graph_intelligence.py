"""
FinGuard 2026 — Service B: Neural Graph Intelligence.

Risk contagion propagation and money laundering cycle detection
using the Neo4j transaction graph. Escalates risk when users
are connected to known mule accounts through shared infrastructure.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np

from config.logging_config import get_logger
from database.neo4j_client import Neo4jClient

logger = get_logger(__name__)


class RiskContagionEngine:
    """
    Propagates risk through the transaction graph.

    If a user is N hops from a known mule account, their risk score
    is escalated based on the decay function: risk_boost = base_risk / (distance^decay)
    """

    def __init__(self, neo4j_client: Neo4jClient | None = None,
                 decay_factor: float = 2.0, max_hops: int = 3,
                 contagion_weight: float = 0.3):
        self.neo4j = neo4j_client or Neo4jClient()
        self.decay_factor = decay_factor
        self.max_hops = max_hops
        self.contagion_weight = contagion_weight

    def compute_contagion_risk(self, user_id: str) -> dict[str, Any]:
        """
        Compute risk contagion score for a user based on graph proximity
        to known mule accounts.
        """
        connections = self.neo4j.get_risk_contagion(user_id, self.max_hops)

        if not connections:
            return {
                "user_id": user_id,
                "contagion_risk": 0.0,
                "connected_mules": 0,
                "closest_mule_distance": None,
                "risk_paths": [],
            }

        total_risk = 0.0
        risk_paths = []

        for conn in connections:
            distance = conn.get("distance", self.max_hops)
            mule_risk = conn.get("mule_risk", 1.0)

            # Decay function: risk decreases with distance
            hop_risk = mule_risk / (distance ** self.decay_factor)
            total_risk += hop_risk

            risk_paths.append({
                "mule_id": conn.get("mule_id"),
                "distance": distance,
                "contributed_risk": round(hop_risk, 6),
                "path": conn.get("path_nodes", []),
            })

        # Normalize contagion risk to [0, 1]
        contagion_risk = min(1.0, total_risk * self.contagion_weight)

        closest = min(connections, key=lambda c: c.get("distance", 999))

        return {
            "user_id": user_id,
            "contagion_risk": round(contagion_risk, 6),
            "connected_mules": len(set(c.get("mule_id") for c in connections)),
            "closest_mule_distance": closest.get("distance"),
            "risk_paths": risk_paths[:10],
        }


class CycleDetector:
    """
    Detects money laundering cycles in the transaction graph.

    Money laundering typically involves:
    1. Placement: Illicit funds enter the system
    2. Layering: Funds are moved through multiple accounts (cycles)
    3. Integration: Funds appear legitimate

    This detector focuses on Step 2 — finding closed loops.
    """

    def __init__(self, neo4j_client: Neo4jClient | None = None,
                 min_cycle_length: int = 3, max_cycle_length: int = 8,
                 min_amount: float = 500.0):
        self.neo4j = neo4j_client or Neo4jClient()
        self.min_cycle_length = min_cycle_length
        self.max_cycle_length = max_cycle_length
        self.min_amount = min_amount

    def detect_cycles(self) -> list[dict[str, Any]]:
        """Run cycle detection on the transaction graph."""
        raw_cycles = self.neo4j.detect_cycles(
            min_length=self.min_cycle_length,
            max_length=self.max_cycle_length,
            min_amount=self.min_amount,
        )

        scored_cycles = []
        for cycle in raw_cycles:
            risk_score = self._score_cycle(cycle)
            scored_cycles.append({
                "origin_user": cycle.get("origin_user"),
                "cycle_length": cycle.get("cycle_length"),
                "total_amount": cycle.get("total_amount"),
                "risk_score": risk_score,
                "nodes": cycle.get("cycle_nodes", []),
                "alert_level": self._classify_alert(risk_score),
            })

        return sorted(scored_cycles, key=lambda c: c["risk_score"], reverse=True)

    def _score_cycle(self, cycle: dict) -> float:
        """Score a cycle based on length, amount, and velocity."""
        length = cycle.get("cycle_length", 3)
        amount = cycle.get("total_amount", 0)

        # Longer cycles with higher amounts are more suspicious
        length_score = min(1.0, length / self.max_cycle_length)
        amount_score = min(1.0, math.log1p(amount) / math.log1p(100000))
        return round((length_score * 0.4 + amount_score * 0.6), 4)

    @staticmethod
    def _classify_alert(score: float) -> str:
        if score >= 0.8:
            return "critical"
        elif score >= 0.6:
            return "high"
        elif score >= 0.3:
            return "medium"
        return "low"


class GraphIntelligenceService:
    """
    Service B: Combined graph intelligence — risk contagion + cycle detection.
    """

    def __init__(self, neo4j_client: Neo4jClient | None = None):
        client = neo4j_client or Neo4jClient()
        self.risk_engine = RiskContagionEngine(client)
        self.cycle_detector = CycleDetector(client)
        self.neo4j = client

    def analyze_user(self, user_id: str) -> dict[str, Any]:
        """Full graph intelligence analysis for a user."""
        contagion = self.risk_engine.compute_contagion_risk(user_id)
        neighborhood = self.neo4j.get_user_neighborhood(user_id, depth=2)

        return {
            "user_id": user_id,
            "contagion": contagion,
            "neighborhood": neighborhood,
        }

    def run_cycle_scan(self) -> list[dict]:
        """Scan for money laundering cycles."""
        return self.cycle_detector.detect_cycles()
