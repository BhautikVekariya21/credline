"""
Credit Line Fintech Solution — Phase 14: Financial Liquidity Oracle.

PyTorch LSTM multivariate model for 90-day cash flow forecasting, combined
with a Monte Carlo simulator for best/worst scenario stress testing.
"""

from __future__ import annotations

import math
import random
from typing import Any

import numpy as np
import torch
import torch.nn as nn


class LiquidityLSTM(nn.Module):
    """
    Multivariate PyTorch LSTM for predicting future cash flows based on
    historical series, macro factors (SOFR, Inflation), and static context.
    """
    def __init__(
        self,
        input_dim: int = 4,      # cash_flow, sofr, inflation, company_size
        hidden_dim: int = 64,
        num_layers: int = 2,
        output_dim: int = 1,     # next-day cash flow prediction
        dropout: float = 0.1,
    ):
        super().__init__()
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.fc = nn.Linear(hidden_dim, output_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: [batch_size, seq_len, input_dim]
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_dim, device=x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_dim, device=x.device)
        
        out, _ = self.lstm(x, (h0, c0))
        # Take the output of the last time step
        out = out[:, -1, :]
        out = self.fc(out)
        return out


class LiquidityOracle:
    """
    Orchestrator for fitting the LiquidityLSTM and generating 90-day Monte Carlo projections.
    """
    def __init__(self, input_dim: int = 4, seq_len: int = 30):
        self.seq_len = seq_len
        self.input_dim = input_dim
        self.model = LiquidityLSTM(input_dim=input_dim)
        self._is_trained = False

    def train_on_history(self, history_data: np.ndarray, epochs: int = 10):
        """
        Train the model on historical records.
        history_data shape: [num_records, input_dim]
        Columns: [cash_flow, sofr_rate, inflation_index, static_context_scale]
        """
        if len(history_data) <= self.seq_len:
            # Not enough data to train properly, initialize weights randomly
            self._is_trained = True
            return

        optimizer = torch.optim.Adam(self.model.parameters(), lr=0.01)
        criterion = nn.MSELoss()

        self.model.train()
        
        # Prepare inputs
        x_train, y_train = [], []
        for i in range(len(history_data) - self.seq_len):
            x_train.append(history_data[i : i + self.seq_len])
            y_train.append([history_data[i + self.seq_len, 0]])  # target is next cash flow

        x_tensor = torch.tensor(np.array(x_train), dtype=torch.float32)
        y_tensor = torch.tensor(np.array(y_train), dtype=torch.float32)

        for _ in range(epochs):
            optimizer.zero_grad()
            outputs = self.model(x_tensor)
            loss = criterion(outputs, y_tensor)
            loss.backward()
            optimizer.step()

        self._is_trained = True

    def forecast_90_days(
        self,
        recent_history: np.ndarray,   # Shape [seq_len, input_dim]
        future_macro_rates: list[float], # Predicted SOFR rate daily indices for 90 days
        future_inflation: list[float],   # Predicted Inflation daily indices for 90 days
        shocks: dict[str, float] | None = None, # e.g. {"churn_growth": 0.05, "revenue_cut": -0.1}
    ) -> dict[str, Any]:
        """
        Forecast a 90-day cash flow runway and run Monte Carlo simulation to get Best/Worst cases.
        """
        self.model.eval()
        shocks = shocks or {}
        
        # Extract shocks
        churn_factor = 1.0 + shocks.get("churn_rate", 0.0)
        growth_factor = 1.0 + shocks.get("sales_growth", 0.0)
        macro_interest_shock = shocks.get("macro_interest_rate", 0.0)

        # Base case prediction loop
        current_seq = recent_history.copy()
        predictions = []

        # We will roll forward the LSTM step-by-step
        with torch.no_grad():
            for i in range(90):
                input_tensor = torch.tensor(np.expand_dims(current_seq, axis=0), dtype=torch.float32)
                pred_cash = self.model(input_tensor).item()

                # Apply scenario shock scaling to predicted values
                # Growth factor increases cash flow, churn factor decreases cash flow
                pred_cash = pred_cash * growth_factor / churn_factor

                # Capture sofr and inflation indices for this step, applying interest shock
                sofr = future_macro_rates[i] + macro_interest_shock
                inflation = future_inflation[i]
                static_val = current_seq[-1, 3] # Keep static context value constant

                predictions.append(pred_cash)

                # Shift sequence window
                new_row = np.array([pred_cash, sofr, inflation, static_val])
                current_seq = np.vstack([current_seq[1:], new_row])

        # Run Monte Carlo simulation for 1000 trajectories
        # Calculate historical residuals/variance to simulate forecast uncertainty
        hist_cash_flows = recent_history[:, 0]
        std_dev = np.std(hist_cash_flows) if len(hist_cash_flows) > 0 else 50000.0
        
        num_simulations = 1000
        trajectories = []

        for _ in range(num_simulations):
            path = []
            curr_cash = predictions[0]
            for i in range(90):
                # Variance increases over time, scaled by square root of steps
                noise = np.random.normal(0, std_dev * (1.0 + math.sqrt(i + 1) * 0.15))
                sim_cash = predictions[i] + noise
                path.append(sim_cash)
            trajectories.append(path)

        trajectories = np.array(trajectories)
        
        # Extract percentiles
        base_case = np.array(predictions)
        worst_case = np.percentile(trajectories, 10, axis=0) # 10th percentile
        best_case = np.percentile(trajectories, 90, axis=0)  # 90th percentile

        # Make sure worst case doesn't show negative infinity or positive growth if base case drops
        worst_case = np.minimum(worst_case, base_case)
        best_case = np.maximum(best_case, base_case)

        return {
            "days": list(range(1, 91)),
            "base_case": base_case.tolist(),
            "worst_case": worst_case.tolist(),
            "best_case": best_case.tolist(),
            "std_dev": float(std_dev),
        }


# Helper data generator for initial startup
def generate_sample_history(seq_len: int = 30) -> np.ndarray:
    """Generate mock historical ledger data to bootstrap the forecasting model."""
    np.random.seed(42)
    history = []
    base_cash = 2500000.0 # Start with ₹25L
    for _ in range(seq_len):
        change = np.random.normal(5000.0, 45000.0) # Daily fluctuations
        base_cash += change
        sofr = 5.3 + np.random.uniform(-0.1, 0.1)
        inflation = 3.2 + np.random.uniform(-0.05, 0.05)
        static_context = 1.0
        history.append([base_cash, sofr, inflation, static_context])
    return np.array(history)
