"""
FinGuard 2026 — TransactionTransformer Model.

TFT variant for analyzing sequences of spending patterns with
Variable Selection Networks, GRNs, and multi-head self-attention.
"""

from __future__ import annotations

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from models.temporal.positional_encoding import TemporalPositionalEncoding


class GatedResidualNetwork(nn.Module):
    """Gated Residual Network — core TFT building block."""

    def __init__(self, d_input: int, d_hidden: int, d_output: int,
                 dropout: float = 0.1, context_dim: int | None = None):
        super().__init__()
        self.fc1 = nn.Linear(d_input, d_hidden)
        self.elu = nn.ELU()
        self.fc2 = nn.Linear(d_hidden, d_output)
        self.dropout = nn.Dropout(dropout)
        self.gate_fc = nn.Linear(d_input, d_output)
        self.context_fc = nn.Linear(context_dim, d_hidden, bias=False) if context_dim else None
        self.skip = nn.Linear(d_input, d_output, bias=False) if d_input != d_output else None
        self.layer_norm = nn.LayerNorm(d_output)

    def forward(self, x: torch.Tensor, context: torch.Tensor | None = None) -> torch.Tensor:
        h = self.fc1(x)
        if self.context_fc is not None and context is not None:
            h = h + self.context_fc(context)
        h = self.dropout(self.fc2(self.elu(h)))
        gate = torch.sigmoid(self.gate_fc(x))
        skip = self.skip(x) if self.skip is not None else x
        return self.layer_norm(gate * h + skip)


class VariableSelectionNetwork(nn.Module):
    """Learns which input variables are most relevant."""

    def __init__(self, num_features: int, d_model: int, dropout: float = 0.1):
        super().__init__()
        self.num_features = num_features
        self.feature_grns = nn.ModuleList(
            [GatedResidualNetwork(1, d_model, d_model, dropout) for _ in range(num_features)]
        )
        self.selection_grn = GatedResidualNetwork(
            num_features * d_model, d_model, num_features, dropout
        )

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        processed = [self.feature_grns[i](x[..., i:i+1]) for i in range(self.num_features)]
        stacked = torch.stack(processed, dim=-2)
        flat = stacked.reshape(*x.shape[:-1], -1)
        weights = F.softmax(self.selection_grn(flat), dim=-1)
        selected = (stacked * weights.unsqueeze(-1)).sum(dim=-2)
        return selected, weights


class TransactionTransformer(nn.Module):
    """
    TFT variant for spending pattern analysis.
    Output: 128-dim temporal embedding + attention weights for interpretability.
    """

    def __init__(self, num_features: int, d_model: int = 128, nhead: int = 8,
                 num_encoder_layers: int = 4, dropout: float = 0.1, max_seq_len: int = 64):
        super().__init__()
        self.num_features = num_features
        self.d_model = d_model
        self.nhead = nhead

        self.variable_selection = VariableSelectionNetwork(num_features, d_model, dropout)
        self.temporal_encoding = TemporalPositionalEncoding(d_model, max_seq_len, dropout)

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead, dim_feedforward=d_model * 4,
            dropout=dropout, activation="gelu", batch_first=True, norm_first=True,
        )
        self.transformer_encoder = nn.TransformerEncoder(encoder_layer, num_encoder_layers)

        self.output_grn = GatedResidualNetwork(d_model, d_model * 2, d_model, dropout)
        self.attention_pool = nn.Sequential(
            nn.Linear(d_model, d_model // 2), nn.Tanh(), nn.Linear(d_model // 2, 1)
        )
        self.layer_norm = nn.LayerNorm(d_model)
        self._init_weights()

    def _init_weights(self) -> None:
        for p in self.parameters():
            if p.dim() > 1:
                nn.init.xavier_uniform_(p)

    def forward(self, x: torch.Tensor, time_deltas: torch.Tensor | None = None,
                hours: torch.Tensor | None = None, days_of_week: torch.Tensor | None = None,
                mask: torch.Tensor | None = None, return_attention: bool = False
                ) -> dict[str, torch.Tensor]:
        selected, var_weights = self.variable_selection(x)
        encoded = self.temporal_encoding(selected, time_deltas=time_deltas,
                                         hours=hours, days_of_week=days_of_week)
        causal_mask = nn.Transformer.generate_square_subsequent_mask(
            x.size(1), device=x.device)
        transformer_out = self.transformer_encoder(encoded, mask=causal_mask,
                                                    src_key_padding_mask=mask)
        processed = self.layer_norm(self.output_grn(transformer_out))

        attn_w = self.attention_pool(processed)
        if mask is not None:
            attn_w = attn_w.masked_fill(mask.unsqueeze(-1), float("-inf"))
        attn_w = F.softmax(attn_w, dim=1)
        embedding = (processed * attn_w).sum(dim=1)

        result: dict[str, torch.Tensor] = {"embedding": embedding, "sequence_output": processed}
        if return_attention:
            result["variable_weights"] = var_weights
            result["temporal_attention"] = attn_w.squeeze(-1)
        return result

    def get_embedding(self, x: torch.Tensor, **kw: torch.Tensor) -> torch.Tensor:
        return self.forward(x, **kw)["embedding"]

    def smoke_test(self, batch_size: int = 4, seq_len: int = 32) -> None:
        self.eval()
        with torch.no_grad():
            x = torch.randn(batch_size, seq_len, self.num_features)
            out = self.forward(x, return_attention=True)
            assert out["embedding"].shape == (batch_size, self.d_model)
            assert out["variable_weights"].shape == (batch_size, seq_len, self.num_features)
        print(f"✅ TransactionTransformer smoke test passed: embedding={out['embedding'].shape}")
