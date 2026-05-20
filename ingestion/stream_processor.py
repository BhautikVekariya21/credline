"""
FinGuard 2026 — Stream Processor.

Computes real-time features from transaction event streams:
- Transaction velocity (count per time window)
- Amount statistics (mean, std, max in rolling windows)
- Geo-velocity (distance / time between consecutive transactions)
- Device usage patterns
"""

from __future__ import annotations

import math
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Any


class RealTimeFeatureComputer:
    """
    Computes real-time features from streaming transaction events.

    Maintains per-user sliding windows of recent transactions
    to compute velocity, amount statistics, and anomaly indicators.
    """

    def __init__(self, window_minutes: int = 60, max_history: int = 1000):
        self.window_minutes = window_minutes
        self.max_history = max_history

        # Per-user transaction history (deque for efficient sliding window)
        self._user_history: dict[str, deque[dict]] = defaultdict(
            lambda: deque(maxlen=max_history)
        )
        # Per-device usage tracking
        self._device_users: dict[str, set[str]] = defaultdict(set)
        # Per-IP usage tracking
        self._ip_users: dict[str, set[str]] = defaultdict(set)

    def process(self, transaction: dict[str, Any]) -> dict[str, float]:
        """
        Process a single transaction and compute real-time features.

        Args:
            transaction: Dict with user_id, amount, timestamp, device_id,
                        ip_address, location (lat/lon), etc.

        Returns:
            Dict of computed feature name → value.
        """
        user_id = transaction["user_id"]
        amount = float(transaction.get("amount", 0))
        timestamp = self._parse_timestamp(transaction.get("timestamp"))
        device_id = transaction.get("device_id", "")
        ip_address = transaction.get("ip_address", "")
        lat = float(transaction.get("latitude", 0))
        lon = float(transaction.get("longitude", 0))

        # Add to history
        self._user_history[user_id].append({
            "amount": amount, "timestamp": timestamp,
            "lat": lat, "lon": lon, "device_id": device_id,
        })
        self._device_users[device_id].add(user_id)
        self._ip_users[ip_address].add(user_id)

        # Get recent transactions in window
        cutoff = timestamp - timedelta(minutes=self.window_minutes)
        recent = [
            tx for tx in self._user_history[user_id]
            if tx["timestamp"] >= cutoff
        ]

        features: dict[str, float] = {}

        # ─── Velocity Features ─────────────────────────────────────────
        features["tx_count_1h"] = float(len(recent))
        features["tx_count_5m"] = float(sum(
            1 for tx in recent
            if tx["timestamp"] >= timestamp - timedelta(minutes=5)
        ))

        # ─── Amount Features ───────────────────────────────────────────
        amounts = [tx["amount"] for tx in recent]
        features["amount_mean_1h"] = sum(amounts) / max(len(amounts), 1)
        features["amount_max_1h"] = max(amounts) if amounts else 0.0
        features["amount_sum_1h"] = sum(amounts)

        if len(amounts) >= 2:
            mean = features["amount_mean_1h"]
            features["amount_std_1h"] = math.sqrt(
                sum((a - mean) ** 2 for a in amounts) / len(amounts)
            )
            # Z-score of current transaction
            std = features["amount_std_1h"]
            features["amount_zscore"] = (
                (amount - mean) / std if std > 0 else 0.0
            )
        else:
            features["amount_std_1h"] = 0.0
            features["amount_zscore"] = 0.0

        # ─── Time Delta Features ───────────────────────────────────────
        if len(recent) >= 2:
            sorted_recent = sorted(recent, key=lambda x: x["timestamp"])
            deltas = [
                (sorted_recent[i]["timestamp"] - sorted_recent[i - 1]["timestamp"]).total_seconds()
                for i in range(1, len(sorted_recent))
            ]
            features["time_since_last_tx_sec"] = deltas[-1] if deltas else 0.0
            features["avg_time_between_tx_sec"] = sum(deltas) / len(deltas)
            features["min_time_between_tx_sec"] = min(deltas)
        else:
            features["time_since_last_tx_sec"] = 0.0
            features["avg_time_between_tx_sec"] = 0.0
            features["min_time_between_tx_sec"] = 0.0

        # ─── Geo-Velocity ──────────────────────────────────────────────
        if len(recent) >= 2:
            sorted_recent = sorted(recent, key=lambda x: x["timestamp"])
            prev = sorted_recent[-2]
            dist_km = self._haversine(
                prev["lat"], prev["lon"], lat, lon
            )
            time_diff_h = max(
                (timestamp - prev["timestamp"]).total_seconds() / 3600, 0.001
            )
            features["geo_velocity_kmh"] = dist_km / time_diff_h
            features["distance_from_last_km"] = dist_km
        else:
            features["geo_velocity_kmh"] = 0.0
            features["distance_from_last_km"] = 0.0

        # ─── Device / IP Sharing ───────────────────────────────────────
        features["device_user_count"] = float(len(self._device_users.get(device_id, set())))
        features["ip_user_count"] = float(len(self._ip_users.get(ip_address, set())))

        return features

    @staticmethod
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Compute haversine distance in kilometers."""
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) ** 2)
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    @staticmethod
    def _parse_timestamp(ts: Any) -> datetime:
        if isinstance(ts, datetime):
            return ts
        if isinstance(ts, str):
            for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f",
                       "%Y-%m-%d %H:%M:%S"):
                try:
                    return datetime.strptime(ts, fmt)
                except ValueError:
                    continue
        return datetime.utcnow()

    def get_user_feature_vector(self, user_id: str) -> dict[str, float]:
        """Get the latest computed features for a user."""
        history = self._user_history.get(user_id)
        if not history:
            return {}
        return self.process({
            "user_id": user_id,
            "amount": history[-1]["amount"],
            "timestamp": history[-1]["timestamp"],
            "device_id": history[-1]["device_id"],
            "latitude": history[-1]["lat"],
            "longitude": history[-1]["lon"],
        })
