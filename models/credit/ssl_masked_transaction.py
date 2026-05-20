"""
FinGuard 2026 — Self-Supervised Learning: Masked Transaction Modeling.

Pre-trains a Transformer encoder on unlabeled transaction data by randomly
masking features and training the model to reconstruct them. The learned
representations transfer to downstream fraud detection and credit scoring.
"""

from __future__ import annotations
import torch
import torch.nn as nn
import torch.nn.functional as F
from models.temporal.positional_encoding import TemporalPositionalEncoding


class MaskedTransactionModel(nn.Module):
    """
    Self-Supervised pre-training via Masked Transaction Modeling.

    Strategy (analogous to BERT's MLM):
    1. Randomly mask 15% of transaction features with a [MASK] token
    2. Feed masked sequence through Transformer encoder
    3. Predict original values at masked positions
    4. Transfer encoder weights to TransactionTransformer

    Args:
        num_features: Number of features per transaction timestep.
        d_model: Internal dimensionality (default: 128).
        nhead: Attention heads (default: 8).
        num_layers: Encoder layers (default: 4).
        mask_ratio: Fraction of features to mask (default: 0.15).
        dropout: Dropout rate (default: 0.1).
        max_seq_len: Max sequence length (default: 64).
    """

    def __init__(self, num_features: int, d_model: int = 128, nhead: int = 8,
                 num_layers: int = 4, mask_ratio: float = 0.15,
                 dropout: float = 0.1, max_seq_len: int = 64):
        super().__init__()
        self.num_features = num_features
        self.d_model = d_model
        self.mask_ratio = mask_ratio

        # Feature projection
        self.input_proj = nn.Linear(num_features, d_model)

        # Learnable mask token
        self.mask_token = nn.Parameter(torch.randn(1, 1, d_model) * 0.02)

        # Positional encoding
        self.pos_encoding = TemporalPositionalEncoding(d_model, max_seq_len, dropout)

        # Transformer encoder (shared architecture with TransactionTransformer)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead, dim_feedforward=d_model * 4,
            dropout=dropout, activation="gelu", batch_first=True, norm_first=True,
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers)

        # Reconstruction head: predict original features at masked positions
        self.reconstruction_head = nn.Sequential(
            nn.Linear(d_model, d_model * 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model * 2, num_features),
        )

        self.layer_norm = nn.LayerNorm(d_model)
        self._init_weights()

    def _init_weights(self) -> None:
        for p in self.parameters():
            if p.dim() > 1:
                nn.init.xavier_uniform_(p)

    def create_mask(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Create random feature mask.

        Args:
            x: Input [batch, seq_len, num_features]

        Returns:
            Tuple of (masked_input, mask_indices) where mask_indices is a
            boolean tensor True at masked positions.
        """
        batch, seq_len, _ = x.shape

        # Create mask: True = masked
        mask = torch.rand(batch, seq_len, device=x.device) < self.mask_ratio

        # Ensure at least one position is masked per sequence
        if not mask.any():
            rand_pos = torch.randint(0, seq_len, (batch,), device=x.device)
            mask[torch.arange(batch), rand_pos] = True

        return mask

    def forward(self, x: torch.Tensor,
                time_deltas: torch.Tensor | None = None) -> dict[str, torch.Tensor]:
        """
        Forward pass for pre-training.

        Args:
            x: Raw transaction features [batch, seq_len, num_features]
            time_deltas: Optional time gaps [batch, seq_len]

        Returns:
            Dict with 'loss', 'reconstructed', 'mask', 'encoded'.
        """
        batch, seq_len, _ = x.shape

        # Create mask
        mask = self.create_mask(x)  # [batch, seq_len]

        # Project input
        projected = self.input_proj(x)  # [batch, seq_len, d_model]

        # Replace masked positions with mask token
        mask_expanded = mask.unsqueeze(-1).expand_as(projected)
        masked_input = projected.clone()
        masked_input[mask_expanded] = self.mask_token.expand(batch, seq_len, -1)[mask_expanded]

        # Positional encoding
        encoded = self.pos_encoding(masked_input, time_deltas=time_deltas)

        # Transformer encoding
        encoded = self.encoder(encoded)
        encoded = self.layer_norm(encoded)

        # Reconstruct only at masked positions
        reconstructed = self.reconstruction_head(encoded)

        # Compute loss only at masked positions
        mask_3d = mask.unsqueeze(-1).expand_as(x)
        loss = F.mse_loss(reconstructed[mask_3d], x[mask_3d])

        return {
            "loss": loss,
            "reconstructed": reconstructed,
            "mask": mask,
            "encoded": encoded,
        }

    def get_encoder(self) -> nn.TransformerEncoder:
        """Extract the pre-trained encoder for transfer learning."""
        return self.encoder

    def get_representations(self, x: torch.Tensor) -> torch.Tensor:
        """Get encoded representations without masking (for downstream use)."""
        projected = self.input_proj(x)
        encoded = self.pos_encoding(projected)
        encoded = self.encoder(encoded)
        return self.layer_norm(encoded)

    def smoke_test(self, batch_size: int = 4, seq_len: int = 32) -> None:
        self.eval()
        with torch.no_grad():
            x = torch.randn(batch_size, seq_len, self.num_features)
            out = self.forward(x)
            assert out["loss"].dim() == 0
            assert out["reconstructed"].shape == x.shape
            assert out["mask"].shape == (batch_size, seq_len)
        print(f"✅ MaskedTransactionModel smoke test passed: loss={out['loss'].item():.4f}")
