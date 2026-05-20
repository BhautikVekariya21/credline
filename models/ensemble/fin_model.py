"""
FinGuard 2026 — FinModel Ensemble.

Fuses GraphSAGE, TransactionTransformer, and BiometricHead embeddings
into final Fraud Score (0-1) and Creditworthiness Score (300-850)
using a gated attention mechanism.
"""

from __future__ import annotations
import torch
import torch.nn as nn
import torch.nn.functional as F


class GatedAttentionFusion(nn.Module):
    """Learnable gated attention over multiple embedding sources."""

    def __init__(self, dims: list[int], output_dim: int):
        super().__init__()
        self.projections = nn.ModuleList([nn.Linear(d, output_dim) for d in dims])
        self.attention = nn.Sequential(
            nn.Linear(output_dim * len(dims), len(dims)),
            nn.Softmax(dim=-1),
        )
        self.output_dim = output_dim
        self.n_sources = len(dims)

    def forward(self, embeddings: list[torch.Tensor]) -> tuple[torch.Tensor, torch.Tensor]:
        projected = [proj(emb) for proj, emb in zip(self.projections, embeddings)]
        stacked = torch.stack(projected, dim=1)  # [batch, n_sources, output_dim]
        concat = torch.cat(projected, dim=-1)  # [batch, n_sources * output_dim]
        weights = self.attention(concat)  # [batch, n_sources]
        fused = (stacked * weights.unsqueeze(-1)).sum(dim=1)  # [batch, output_dim]
        return fused, weights


class FinModel(nn.Module):
    """
    Ensemble fusion model combining three specialized sub-models.

    Inputs:
        - graph_embedding: 128-dim from FraudGraphSAGE
        - temporal_embedding: 128-dim from TransactionTransformer
        - biometric_embedding: 64-dim from BiometricHead

    Outputs:
        - fraud_score: float [0, 1] via sigmoid
        - credit_score: float [300, 850] via scaled linear
        - attention_weights: contribution of each sub-model

    Architecture:
        1. Project all embeddings to common dimension
        2. Gated attention fusion
        3. Shared deep layers
        4. Two task-specific prediction heads
    """

    def __init__(self, graph_dim: int = 128, temporal_dim: int = 128,
                 biometric_dim: int = 64, fusion_dim: int = 128, dropout: float = 0.3):
        super().__init__()
        self.graph_dim = graph_dim
        self.temporal_dim = temporal_dim
        self.biometric_dim = biometric_dim

        # Gated attention fusion
        self.fusion = GatedAttentionFusion(
            dims=[graph_dim, temporal_dim, biometric_dim],
            output_dim=fusion_dim,
        )

        # Shared representation layers
        self.shared = nn.Sequential(
            nn.Linear(fusion_dim, fusion_dim * 2),
            nn.LayerNorm(fusion_dim * 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(fusion_dim * 2, fusion_dim),
            nn.LayerNorm(fusion_dim),
            nn.GELU(),
            nn.Dropout(dropout),
        )

        # Fraud prediction head
        self.fraud_head = nn.Sequential(
            nn.Linear(fusion_dim, fusion_dim // 2),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout),
            nn.Linear(fusion_dim // 2, 1),
        )

        # Credit score prediction head
        self.credit_head = nn.Sequential(
            nn.Linear(fusion_dim, fusion_dim // 2),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout),
            nn.Linear(fusion_dim // 2, 1),
        )

        # Credit score scaling parameters
        self.credit_min = 300.0
        self.credit_max = 850.0

        self._init_weights()

    def _init_weights(self) -> None:
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    def forward(self, graph_emb: torch.Tensor, temporal_emb: torch.Tensor,
                biometric_emb: torch.Tensor) -> dict[str, torch.Tensor]:
        """
        Args:
            graph_emb: [batch, graph_dim] from FraudGraphSAGE
            temporal_emb: [batch, temporal_dim] from TransactionTransformer
            biometric_emb: [batch, biometric_dim] from BiometricHead

        Returns:
            Dict with fraud_score, credit_score, attention_weights, shared_repr.
        """
        # Fuse embeddings with gated attention
        fused, attn_weights = self.fusion([graph_emb, temporal_emb, biometric_emb])

        # Shared deep layers
        shared = self.shared(fused)

        # Fraud score [0, 1]
        fraud_logit = self.fraud_head(shared)
        fraud_score = torch.sigmoid(fraud_logit)

        # Credit score [300, 850]
        credit_raw = self.credit_head(shared)
        credit_score = self.credit_min + (self.credit_max - self.credit_min) * torch.sigmoid(credit_raw)

        return {
            "fraud_score": fraud_score.squeeze(-1),
            "fraud_logit": fraud_logit.squeeze(-1),
            "credit_score": credit_score.squeeze(-1),
            "attention_weights": attn_weights,
            "shared_representation": shared,
        }

    def smoke_test(self, batch_size: int = 4) -> None:
        self.eval()
        with torch.no_grad():
            g = torch.randn(batch_size, self.graph_dim)
            t = torch.randn(batch_size, self.temporal_dim)
            b = torch.randn(batch_size, self.biometric_dim)
            out = self.forward(g, t, b)
            assert out["fraud_score"].shape == (batch_size,)
            assert (out["fraud_score"] >= 0).all() and (out["fraud_score"] <= 1).all()
            assert out["credit_score"].shape == (batch_size,)
            assert (out["credit_score"] >= 300).all() and (out["credit_score"] <= 850).all()
            assert out["attention_weights"].shape == (batch_size, 3)
        print(f"✅ FinModel smoke test passed: fraud={out['fraud_score'][:2].tolist()}, "
              f"credit={out['credit_score'][:2].tolist()}")
