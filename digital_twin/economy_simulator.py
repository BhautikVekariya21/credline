"""
FinGuard 2026 — Financial Digital Twin: Synthetic Economy Simulator.

Mesa-compatible Agent-Based Model that orchestrates 100,000+ citizen
agents into a self-contained synthetic economy. The simulator outputs
labeled transaction streams with realistic:
  - Circadian rhythms (peak hours, weekend effects)
  - Monthly cycles (rent on the 1st, salary deposits)
  - Fraud ring coordination (dormant → active → layering phases)
  - Alternative credit data for unbanked populations

Usage:
    python -m digital_twin.economy_simulator --citizens 100000 --hours 720
"""

from __future__ import annotations

import argparse
import random
import time
from typing import Any

from config.logging_config import get_logger
from digital_twin.citizen_agents import (
    CitizenAgent,
    CitizenType,
    FraudSyndicate,
    GigWorker,
    SalaryEarner,
    Transaction,
    UnbankedCitizen,
)

logger = get_logger(__name__)


class SyntheticEconomy:
    """
    Agent-Based synthetic economy simulator.

    Populates a world with citizens of various archetypes,
    steps through simulated time, and collects all generated
    transactions with ground-truth fraud labels.

    Distribution (configurable):
      - 60% Salary Earners
      - 20% Gig Workers
      - 15% Unbanked Citizens
      - 5%  Fraud Syndicates
    """

    def __init__(
        self,
        num_citizens: int = 100_000,
        fraud_ratio: float = 0.05,
        gig_ratio: float = 0.20,
        unbanked_ratio: float = 0.15,
        seed: int | None = None,
    ):
        if seed is not None:
            random.seed(seed)

        self.num_citizens = num_citizens
        self.citizens: list[CitizenAgent] = []
        self._step_count = 0
        self._total_tx = 0
        self._total_fraud = 0

        # Population distribution
        n_fraud = int(num_citizens * fraud_ratio)
        n_gig = int(num_citizens * gig_ratio)
        n_unbanked = int(num_citizens * unbanked_ratio)
        n_salary = num_citizens - n_fraud - n_gig - n_unbanked

        logger.info("economy_initializing",
                     total=num_citizens, salary=n_salary,
                     gig=n_gig, unbanked=n_unbanked, fraud=n_fraud)

        # Create fraud rings (groups of 3-8 members)
        fraud_ring_ids: list[list[str]] = []
        remaining_fraud = n_fraud
        while remaining_fraud > 0:
            ring_size = min(random.randint(3, 8), remaining_fraud)
            ring_ids = [f"USR-RING-{len(fraud_ring_ids):03d}-{j}"
                        for j in range(ring_size)]
            fraud_ring_ids.append(ring_ids)
            remaining_fraud -= ring_size

        # Populate
        for _ in range(n_salary):
            self.citizens.append(SalaryEarner())

        for _ in range(n_gig):
            self.citizens.append(GigWorker())

        for _ in range(n_unbanked):
            self.citizens.append(UnbankedCitizen())

        for ring_ids in fraud_ring_ids:
            for uid in ring_ids:
                self.citizens.append(FraudSyndicate(
                    user_id=uid, ring_members=ring_ids))

        random.shuffle(self.citizens)
        logger.info("economy_initialized", citizens=len(self.citizens))

    def step(self, current_time: float | None = None) -> list[Transaction]:
        """
        Advance the simulation by 1 hour.

        Returns all transactions generated in this step.
        """
        if current_time is None:
            current_time = time.time() + self._step_count * 3600

        self._step_count += 1
        all_txs: list[Transaction] = []

        for citizen in self.citizens:
            txs = citizen.step(current_time)
            all_txs.extend(txs)

        self._total_tx += len(all_txs)
        self._total_fraud += sum(1 for t in all_txs if t.is_fraud)

        if self._step_count % 24 == 0:
            logger.info("economy_daily_summary",
                         day=self._step_count // 24,
                         txs_today=len(all_txs),
                         total_txs=self._total_tx,
                         total_fraud=self._total_fraud,
                         fraud_rate=f"{self._total_fraud / max(self._total_tx, 1):.4%}")

        return all_txs

    def run(
        self,
        hours: int = 720,
        start_time: float | None = None,
        callback: Any = None,
    ) -> dict[str, Any]:
        """
        Run the full simulation.

        Args:
            hours: Total simulation hours (720 = 30 days).
            start_time: Unix timestamp for simulation start.
            callback: Optional function(step, transactions) called each step.

        Returns:
            Summary statistics.
        """
        if start_time is None:
            start_time = time.time()

        logger.info("economy_simulation_start", hours=hours,
                     citizens=len(self.citizens))
        wall_start = time.time()

        for h in range(hours):
            sim_time = start_time + h * 3600
            txs = self.step(sim_time)

            if callback:
                callback(h, txs)

        wall_elapsed = time.time() - wall_start
        summary = {
            "simulation_hours": hours,
            "simulation_days": hours / 24,
            "total_citizens": len(self.citizens),
            "total_transactions": self._total_tx,
            "total_fraud_transactions": self._total_fraud,
            "fraud_rate": round(self._total_fraud / max(self._total_tx, 1), 6),
            "wall_clock_seconds": round(wall_elapsed, 2),
            "throughput_txs_per_sec": round(self._total_tx / max(wall_elapsed, 0.001)),
        }

        logger.info("economy_simulation_complete", **summary)
        return summary

    def get_population_stats(self) -> dict[str, int]:
        """Get breakdown of citizen types."""
        stats: dict[str, int] = {}
        for c in self.citizens:
            key = c.citizen_type.value
            stats[key] = stats.get(key, 0) + 1
        return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="FinGuard Digital Twin Economy Simulator")
    parser.add_argument("--citizens", type=int, default=1000,
                        help="Number of citizen agents")
    parser.add_argument("--hours", type=int, default=168,
                        help="Simulation duration in hours")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    economy = SyntheticEconomy(num_citizens=args.citizens, seed=args.seed)
    summary = economy.run(hours=args.hours)

    print("\n📊 Simulation Complete:")
    for k, v in summary.items():
        print(f"  {k}: {v}")
