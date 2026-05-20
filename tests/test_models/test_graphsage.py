"""
FinGuard 2026 — FraudGraphSAGE Unit Tests.

Validates model architecture, forward pass, output shapes,
and gradient flow.
"""

import pytest
import torch

from models.graph.fraud_graphsage import FraudGraphSAGE


class TestFraudGraphSAGE:
    """Test suite for FraudGraphSAGE model."""

    @pytest.fixture
    def model(self):
        return FraudGraphSAGE(in_channels=16, hidden_channels=64, out_channels=32, num_layers=2)

    @pytest.fixture
    def sample_graph(self):
        num_nodes = 50
        num_edges = 150
        x = torch.randn(num_nodes, 16)
        edge_index = torch.randint(0, num_nodes, (2, num_edges))
        batch = torch.zeros(num_nodes, dtype=torch.long)
        return x, edge_index, batch

    def test_forward_embedding_shape(self, model, sample_graph):
        x, edge_index, batch = sample_graph
        out = model(x, edge_index, batch=batch)
        assert out["embedding"].shape == (50, 32)
        assert out["graph_embedding"].shape == (1, 32)

    def test_forward_classification(self, model, sample_graph):
        x, edge_index, batch = sample_graph
        out = model(x, edge_index, batch=batch, return_embedding=False)
        assert out["logits"].shape == (50, 1)
        assert out["probabilities"].shape == (50, 1)
        assert (out["probabilities"] >= 0).all()
        assert (out["probabilities"] <= 1).all()

    def test_gradient_flow(self, model, sample_graph):
        x, edge_index, _ = sample_graph
        model.train()
        out = model(x, edge_index, return_embedding=False)
        loss = out["logits"].sum()
        loss.backward()
        for name, param in model.named_parameters():
            if param.requires_grad:
                assert param.grad is not None, f"No gradient for {name}"

    def test_smoke_test(self, model):
        model.smoke_test(num_nodes=30, num_edges=80)
