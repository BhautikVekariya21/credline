"""
FinGuard 2026 — TransactionTransformer Unit Tests.
"""

import pytest
import torch

from models.temporal.transaction_transformer import TransactionTransformer


class TestTransactionTransformer:

    @pytest.fixture
    def model(self):
        return TransactionTransformer(num_features=8, d_model=64, nhead=4,
                                       num_encoder_layers=2, max_seq_len=32)

    def test_forward_shape(self, model):
        x = torch.randn(4, 16, 8)
        out = model(x)
        assert out["embedding"].shape == (4, 64)
        assert out["sequence_output"].shape == (4, 16, 64)

    def test_with_temporal_features(self, model):
        x = torch.randn(4, 16, 8)
        td = torch.rand(4, 16)
        hours = torch.randint(0, 24, (4, 16))
        days = torch.randint(0, 7, (4, 16))
        out = model(x, time_deltas=td, hours=hours, days_of_week=days)
        assert out["embedding"].shape == (4, 64)

    def test_attention_weights(self, model):
        x = torch.randn(2, 10, 8)
        out = model(x, return_attention=True)
        assert "variable_weights" in out
        assert out["variable_weights"].shape == (2, 10, 8)

    def test_gradient_flow(self, model):
        model.train()
        x = torch.randn(2, 8, 8)
        out = model(x)
        out["embedding"].sum().backward()
        for name, p in model.named_parameters():
            if p.requires_grad:
                assert p.grad is not None, f"No gradient for {name}"

    def test_smoke(self, model):
        model.smoke_test(batch_size=2, seq_len=8)
