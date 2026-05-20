"""
FinGuard 2026 — Custom Temporal Positional Encoding.

Provides time-aware positional encodings for the TransactionTransformer.
Financial transactions are irregularly spaced, so standard sinusoidal
positional encoding is augmented with time-delta encoding.
"""

from __future__ import annotations

import math

import torch
import torch.nn as nn


class SinusoidalPositionalEncoding(nn.Module):
    """
    Standard sinusoidal positional encoding (Vaswani et al., 2017).

    Used as a base encoding for sequence position.
    """

    def __init__(self, d_model: int, max_len: int = 512, dropout: float = 0.1):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout)

        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(
            torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model)
        )

        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term[: d_model // 2])

        pe = pe.unsqueeze(0)  # [1, max_len, d_model]
        self.register_buffer("pe", pe)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Input tensor [batch_size, seq_len, d_model]
        Returns:
            Positionally encoded tensor of same shape.
        """
        x = x + self.pe[:, : x.size(1), :]
        return self.dropout(x)


class TemporalPositionalEncoding(nn.Module):
    """
    Time-delta aware positional encoding for irregularly-spaced transactions.

    Instead of encoding absolute position, this encodes the time gap
    between consecutive transactions. This captures patterns like:
    - Rapid-fire transactions (fraud signal)
    - Regular weekly/monthly patterns (stability signal)
    - Long gaps followed by bursts (behavioral change)

    Combines:
    1. Learned time-delta embedding (continuous → d_model)
    2. Sinusoidal position encoding for sequence order
    3. Cyclic encodings for hour-of-day and day-of-week
    """

    def __init__(
        self,
        d_model: int,
        max_len: int = 512,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.d_model = d_model

        # Sinusoidal base encoding
        self.sinusoidal = SinusoidalPositionalEncoding(d_model, max_len, dropout=0.0)

        # Learned time-delta projection
        # Input: 1 (time delta in hours) → d_model
        self.time_delta_proj = nn.Sequential(
            nn.Linear(1, d_model // 2),
            nn.GELU(),
            nn.Linear(d_model // 2, d_model),
        )

        # Cyclic time encoding (hour_of_day, day_of_week)
        # Input: 4 (sin_hour, cos_hour, sin_dow, cos_dow) → d_model
        self.cyclic_proj = nn.Sequential(
            nn.Linear(4, d_model // 2),
            nn.GELU(),
            nn.Linear(d_model // 2, d_model),
        )

        # Fusion gate
        self.gate = nn.Sequential(
            nn.Linear(d_model * 3, d_model),
            nn.Sigmoid(),
        )

        self.layer_norm = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(
        self,
        x: torch.Tensor,
        time_deltas: torch.Tensor | None = None,
        hours: torch.Tensor | None = None,
        days_of_week: torch.Tensor | None = None,
    ) -> torch.Tensor:
        """
        Apply temporal positional encoding.

        Args:
            x: Input [batch, seq_len, d_model]
            time_deltas: Time gaps in hours [batch, seq_len, 1]
            hours: Hour of day [batch, seq_len] (0-23)
            days_of_week: Day of week [batch, seq_len] (0-6)

        Returns:
            Encoded tensor [batch, seq_len, d_model]
        """
        batch_size, seq_len, _ = x.shape

        # Base sinusoidal encoding
        pos_enc = self.sinusoidal(torch.zeros_like(x))

        # Time delta encoding
        if time_deltas is not None:
            if time_deltas.dim() == 2:
                time_deltas = time_deltas.unsqueeze(-1)
            # Log-transform for better scale handling
            td_log = torch.log1p(time_deltas.abs())
            td_enc = self.time_delta_proj(td_log)
        else:
            td_enc = torch.zeros_like(x)

        # Cyclic time encoding
        if hours is not None and days_of_week is not None:
            h_rad = hours.float() * (2 * math.pi / 24)
            d_rad = days_of_week.float() * (2 * math.pi / 7)
            cyclic = torch.stack(
                [torch.sin(h_rad), torch.cos(h_rad), torch.sin(d_rad), torch.cos(d_rad)],
                dim=-1,
            )
            cyc_enc = self.cyclic_proj(cyclic)
        else:
            cyc_enc = torch.zeros_like(x)

        # Gated fusion of all three encodings
        combined = torch.cat([pos_enc, td_enc, cyc_enc], dim=-1)
        gate_weights = self.gate(combined)

        encoded = x + gate_weights * (pos_enc + td_enc + cyc_enc)
        return self.dropout(self.layer_norm(encoded))
