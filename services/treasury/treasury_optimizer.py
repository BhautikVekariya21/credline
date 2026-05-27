"""
Credit Line Fintech Solution — Phase 15: Treasury Optimizer.

Performs cash sweep operations on idle cash forecasting, calculates Sharpe Ratios,
and triggers simulated brokerage sweeps.
"""

from __future__ import annotations
import math
from typing import Dict, List, Any


class TreasuryAsset:
    def __init__(self, name: str, ticker: str, expected_return: float, volatility: float):
        self.name = name
        self.ticker = ticker
        self.expected_return = expected_return  # Annual rate (e.g. 0.0525 for 5.25%)
        self.volatility = volatility            # Annualized volatility

    def get_sharpe_ratio(self, risk_free_rate: float) -> float:
        if self.volatility <= 0.0:
            return 0.0
        return (self.expected_return - risk_free_rate) / self.volatility


class TreasuryOptimizer:
    def __init__(self, risk_free_rate: float = 0.045, max_volatility: float = 0.05):
        self.risk_free_rate = risk_free_rate  # Base comparison rate (e.g., SOFR at 4.5%)
        self.max_volatility = max_volatility  # Maximum allowed annualized volatility

        # Define safe yield assets
        self.assets = [
            TreasuryAsset("1-Month US Treasury Bills", "BIL", 0.0535, 0.002),
            TreasuryAsset("Government Money Market Fund", "VXX", 0.0515, 0.004),
            TreasuryAsset("Ultra-Short Bond ETF", "MINT", 0.0550, 0.012),
            TreasuryAsset("High Yield Corporate Paper", "HYCP", 0.0650, 0.055),  # High volatility!
        ]

    def optimize_allocation(
        self,
        current_cash: float,
        predicted_min_cash_30d: float,
        reserve_threshold: float = 1200000.0
    ) -> Dict[str, Any]:
        """
        Sweeps excess cash (current cash - reserve threshold) into yield assets.
        Only sweeps cash if predicted 30-day minimum remains above reserve threshold.
        """
        idle_cash = max(0.0, min(current_cash - reserve_threshold, predicted_min_cash_30d - reserve_threshold))
        
        # Filter assets by maximum allowed volatility
        allowed_assets = [a for a in self.assets if a.volatility <= self.max_volatility]
        
        # Sort allowed assets by Sharpe Ratio descending
        asset_metrics = []
        best_asset = None
        highest_sharpe = -float('inf')

        for asset in allowed_assets:
            sharpe = asset.get_sharpe_ratio(self.risk_free_rate)
            asset_metrics.append({
                "name": asset.name,
                "ticker": asset.ticker,
                "expected_return": asset.expected_return,
                "volatility": asset.volatility,
                "sharpe_ratio": sharpe,
                "eligible": True
            })
            if sharpe > highest_sharpe:
                highest_sharpe = sharpe
                best_asset = asset

        # List ineligible high-volatility assets
        for asset in self.assets:
            if asset.volatility > self.max_volatility:
                asset_metrics.append({
                    "name": asset.name,
                    "ticker": asset.ticker,
                    "expected_return": asset.expected_return,
                    "volatility": asset.volatility,
                    "sharpe_ratio": asset.get_sharpe_ratio(self.risk_free_rate),
                    "eligible": False
                })

        allocations = {}
        trade_logs = []
        yield_earned_projected_30d = 0.0

        if idle_cash > 0.0 and best_asset:
            # Sweep strategy: 80% to highest Sharpe Ratio asset, 20% to the second best for diversification
            # If only one asset, 100% to it
            sorted_eligible = sorted(
                [a for a in allowed_assets],
                key=lambda a: a.get_sharpe_ratio(self.risk_free_rate),
                reverse=True
            )
            
            if len(sorted_eligible) >= 2:
                primary = sorted_eligible[0]
                secondary = sorted_eligible[1]
                
                amt_primary = idle_cash * 0.8
                amt_secondary = idle_cash * 0.2
                
                allocations[primary.ticker] = amt_primary
                allocations[secondary.ticker] = amt_secondary
                
                trade_logs.append(
                    f"SWEEP SUCCESS: Transferred INR {amt_primary:,.2f} to brokerage account and purchased {primary.name} ({primary.ticker}) @ yield {(primary.expected_return*100):.2f}%"
                )
                trade_logs.append(
                    f"SWEEP SUCCESS: Transferred INR {amt_secondary:,.2f} to brokerage account and purchased {secondary.name} ({secondary.ticker}) @ yield {(secondary.expected_return*100):.2f}%"
                )
                
                # Projected monthly yield (approximate)
                yield_earned_projected_30d += amt_primary * (primary.expected_return / 12.0)
                yield_earned_projected_30d += amt_secondary * (secondary.expected_return / 12.0)
            else:
                primary = sorted_eligible[0]
                allocations[primary.ticker] = idle_cash
                trade_logs.append(
                    f"SWEEP SUCCESS: Transferred INR {idle_cash:,.2f} to brokerage account and purchased {primary.name} ({primary.ticker}) @ yield {(primary.expected_return*100):.2f}%"
                )
                yield_earned_projected_30d += idle_cash * (primary.expected_return / 12.0)
        else:
            trade_logs.append("SWEEP INACTIVE: No excess cash over reserve threshold detected.")

        operating_cash = current_cash - sum(allocations.values())
        allocations["OPERATING_CASH"] = operating_cash

        # Calculate percentage allocations
        allocations_pct = {k: v / current_cash for k, v in allocations.items()}

        return {
            "current_cash": current_cash,
            "idle_cash_detected": idle_cash,
            "allocated_amounts": allocations,
            "allocated_percentages": allocations_pct,
            "yield_earned_projected_30d": yield_earned_projected_30d,
            "risk_free_rate": self.risk_free_rate,
            "max_volatility_cap": self.max_volatility,
            "assets_evaluated": asset_metrics,
            "trade_logs": trade_logs
        }
