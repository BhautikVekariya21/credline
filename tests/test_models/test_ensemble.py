"""
FinGuard 2026 — FinModel Ensemble Unit Tests.
"""

import pytest
import torch

from models.ensemble.fin_model import FinModel


class TestFinModel:

    @pytest.fixture
    def model(self):
        return FinModel(graph_dim=32, temporal_dim=32, biometric_dim=16, fusion_dim=32)

    def test_output_shapes(self, model):
        g = torch.randn(4, 32)
        t = torch.randn(4, 32)
        b = torch.randn(4, 16)
        out = model(g, t, b)
        assert out["fraud_score"].shape == (4,)
        assert out["credit_score"].shape == (4,)
        assert out["attention_weights"].shape == (4, 3)

    def test_fraud_score_range(self, model):
        g = torch.randn(8, 32)
        t = torch.randn(8, 32)
        b = torch.randn(8, 16)
        out = model(g, t, b)
        assert (out["fraud_score"] >= 0).all()
        assert (out["fraud_score"] <= 1).all()

    def test_credit_score_range(self, model):
        g = torch.randn(8, 32)
        t = torch.randn(8, 32)
        b = torch.randn(8, 16)
        out = model(g, t, b)
        assert (out["credit_score"] >= 300).all()
        assert (out["credit_score"] <= 850).all()

    def test_attention_weights_sum(self, model):
        g = torch.randn(4, 32)
        t = torch.randn(4, 32)
        b = torch.randn(4, 16)
        out = model(g, t, b)
        # Attention weights should sum to 1 (softmax)
        sums = out["attention_weights"].sum(dim=1)
        assert torch.allclose(sums, torch.ones_like(sums), atol=1e-5)

    def test_gradient_flow(self, model):
        model.train()
        g = torch.randn(2, 32)
        t = torch.randn(2, 32)
        b = torch.randn(2, 16)
        out = model(g, t, b)
        loss = out["fraud_score"].sum() + out["credit_score"].sum()
        loss.backward()
        for name, p in model.named_parameters():
            if p.requires_grad:
                assert p.grad is not None, f"No gradient for {name}"
