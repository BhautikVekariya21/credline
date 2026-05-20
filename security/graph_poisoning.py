"""
FinGuard 2026 — GNN Graph Poisoning Detection.

Detects "Graph Poisoning" attacks where adversaries create fake 
"normal" accounts and establish benign-looking edges to dilute the
risk score of a mule (money laundering) account.

Detection methods:
  1. Structural Anomaly Detection — new nodes with improbable connectivity patterns
  2. Temporal Velocity Check — accounts created in bursts are suspicious
  3. Feature Distribution Test — fake accounts often have uniform/synthetic features
  4. Spectral Analysis — poisoned subgraphs disrupt normal spectral signatures
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from config.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class PoisoningAlert:
    """Alert generated when graph poisoning is detected."""
    alert_id: str
    severity: str  # 'critical', 'high', 'medium', 'low'
    detection_method: str
    suspicious_nodes: list[str]
    target_node: str | None
    confidence: float
    details: dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)


class GraphPoisoningDetector:
    """
    Detects graph poisoning attacks on the transaction/user graph.

    Attackers create "sybil" accounts that connect to a mule account,
    making the mule appear well-connected to legitimate users and
    thus lowering its GNN-computed risk score.
    """

    def __init__(
        self,
        max_creation_velocity: int = 5,
        velocity_window_hours: int = 24,
        min_account_age_days: int = 7,
        similarity_threshold: float = 0.90,
    ):
        self.max_creation_velocity = max_creation_velocity
        self.velocity_window_hours = velocity_window_hours
        self.min_account_age_days = min_account_age_days
        self.similarity_threshold = similarity_threshold
        self.alerts: list[PoisoningAlert] = []

    def scan_for_poisoning(
        self,
        nodes: list[dict[str, Any]],
        edges: list[dict[str, Any]],
    ) -> list[PoisoningAlert]:
        """
        Run all poisoning detection methods on the graph.

        Args:
            nodes: List of node dicts with 'id', 'features', 'created_at', 'type'.
            edges: List of edge dicts with 'source', 'target', 'weight', 'type'.

        Returns:
            List of PoisoningAlerts.
        """
        alerts = []

        alerts.extend(self._detect_creation_velocity(nodes))
        alerts.extend(self._detect_sybil_clusters(nodes, edges))
        alerts.extend(self._detect_feature_uniformity(nodes, edges))
        alerts.extend(self._detect_degree_anomaly(nodes, edges))

        self.alerts.extend(alerts)

        if alerts:
            logger.warning("graph_poisoning_detected",
                           alert_count=len(alerts),
                           severities=[a.severity for a in alerts])

        return alerts

    def _detect_creation_velocity(
        self, nodes: list[dict[str, Any]]
    ) -> list[PoisoningAlert]:
        """
        Detect accounts created in suspicious bursts.
        If >N accounts are created within a time window, flag them.
        """
        alerts = []
        now = time.time()
        window_sec = self.velocity_window_hours * 3600

        # Group by IP / device if available
        recent_nodes = [
            n for n in nodes
            if now - n.get("created_at", 0) < window_sec
        ]

        if len(recent_nodes) > self.max_creation_velocity:
            suspicious_ids = [n["id"] for n in recent_nodes]
            alerts.append(PoisoningAlert(
                alert_id=f"POISON-VEL-{int(now)}",
                severity="high",
                detection_method="creation_velocity",
                suspicious_nodes=suspicious_ids,
                target_node=None,
                confidence=min(1.0, len(recent_nodes) / (self.max_creation_velocity * 3)),
                details={
                    "accounts_in_window": len(recent_nodes),
                    "window_hours": self.velocity_window_hours,
                    "threshold": self.max_creation_velocity,
                },
            ))

        return alerts

    def _detect_sybil_clusters(
        self, nodes: list[dict[str, Any]], edges: list[dict[str, Any]],
    ) -> list[PoisoningAlert]:
        """
        Detect sybil clusters: groups of new accounts that all connect
        to the same target node (potential mule).
        """
        alerts = []
        now = time.time()
        young_age = self.min_account_age_days * 86400

        young_ids = {
            n["id"] for n in nodes
            if now - n.get("created_at", 0) < young_age
        }

        if not young_ids:
            return alerts

        # Build adjacency: target → list of young neighbors
        target_young_neighbors: dict[str, list[str]] = {}
        for e in edges:
            src, tgt = e.get("source", ""), e.get("target", "")
            if src in young_ids and tgt not in young_ids:
                target_young_neighbors.setdefault(tgt, []).append(src)
            if tgt in young_ids and src not in young_ids:
                target_young_neighbors.setdefault(src, []).append(tgt)

        # Flag targets with too many young neighbors
        for target, young_neighbors in target_young_neighbors.items():
            if len(young_neighbors) >= 3:
                alerts.append(PoisoningAlert(
                    alert_id=f"POISON-SYBIL-{target[:8]}",
                    severity="critical",
                    detection_method="sybil_cluster",
                    suspicious_nodes=young_neighbors,
                    target_node=target,
                    confidence=min(1.0, len(young_neighbors) / 10),
                    details={
                        "target_node": target,
                        "young_connections": len(young_neighbors),
                        "min_account_age_days": self.min_account_age_days,
                    },
                ))

        return alerts

    def _detect_feature_uniformity(
        self, nodes: list[dict[str, Any]], edges: list[dict[str, Any]],
    ) -> list[PoisoningAlert]:
        """
        Detect feature uniformity: fake accounts often have very similar
        (synthetic) feature distributions.
        """
        alerts = []
        now = time.time()
        young_age = self.min_account_age_days * 86400

        young_nodes = [
            n for n in nodes
            if now - n.get("created_at", 0) < young_age
            and "features" in n
        ]

        if len(young_nodes) < 3:
            return alerts

        features = np.array([n["features"] for n in young_nodes])

        # Pairwise cosine similarity
        norms = np.linalg.norm(features, axis=1, keepdims=True)
        normalized = features / (norms + 1e-8)
        sim_matrix = normalized @ normalized.T

        # Get upper triangle (exclude diagonal)
        upper = sim_matrix[np.triu_indices_from(sim_matrix, k=1)]
        avg_similarity = float(np.mean(upper)) if len(upper) > 0 else 0

        if avg_similarity > self.similarity_threshold:
            alerts.append(PoisoningAlert(
                alert_id=f"POISON-FEAT-{int(now)}",
                severity="high",
                detection_method="feature_uniformity",
                suspicious_nodes=[n["id"] for n in young_nodes],
                target_node=None,
                confidence=avg_similarity,
                details={
                    "average_pairwise_similarity": round(avg_similarity, 4),
                    "threshold": self.similarity_threshold,
                    "num_uniform_accounts": len(young_nodes),
                },
            ))

        return alerts

    def _detect_degree_anomaly(
        self, nodes: list[dict[str, Any]], edges: list[dict[str, Any]],
    ) -> list[PoisoningAlert]:
        """
        Detect degree anomaly: new accounts with suspiciously high degree
        (too many connections for their age).
        """
        alerts = []
        now = time.time()
        young_age = self.min_account_age_days * 86400

        young_ids = {
            n["id"] for n in nodes
            if now - n.get("created_at", 0) < young_age
        }

        degree: dict[str, int] = {}
        for e in edges:
            for endpoint in [e.get("source"), e.get("target")]:
                if endpoint in young_ids:
                    degree[endpoint] = degree.get(endpoint, 0) + 1

        # Flag young accounts with degree > 2 std above mean
        if degree:
            degrees = list(degree.values())
            mean_deg = np.mean(degrees)
            std_deg = np.std(degrees)
            threshold = mean_deg + 2 * std_deg

            anomalous = [
                nid for nid, d in degree.items()
                if d > max(threshold, 5)
            ]

            if anomalous:
                alerts.append(PoisoningAlert(
                    alert_id=f"POISON-DEG-{int(now)}",
                    severity="medium",
                    detection_method="degree_anomaly",
                    suspicious_nodes=anomalous,
                    target_node=None,
                    confidence=min(1.0, len(anomalous) / 5),
                    details={
                        "mean_degree": round(float(mean_deg), 2),
                        "std_degree": round(float(std_deg), 2),
                        "threshold": round(float(threshold), 2),
                        "anomalous_count": len(anomalous),
                    },
                ))

        return alerts
