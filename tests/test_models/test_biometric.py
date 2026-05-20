"""
FinGuard 2026 — BiometricHead Unit Tests.
"""

import pytest
import torch

from models.biometric.biometric_head import BiometricHead


class TestBiometricHead:

    @pytest.fixture
    def model(self):
        return BiometricHead(sensor_channels=6, keystroke_dim=32,
                              cnn_filters=[16, 32, 64], lstm_hidden=32,
                              output_dim=32)

    def test_forward_embedding(self, model):
        sensor = torch.randn(4, 6, 100)
        keys = torch.randn(4, 32)
        out = model(sensor, keys)
        assert out["embedding"].shape == (4, 32)

    def test_forward_classification(self, model):
        sensor = torch.randn(4, 6, 100)
        keys = torch.randn(4, 32)
        out = model(sensor, keys, return_embedding=False)
        assert out["logits"].shape == (4, 1)
        assert (out["probability"] >= 0).all()
        assert (out["probability"] <= 1).all()

    def test_gradient_flow(self, model):
        model.train()
        sensor = torch.randn(2, 6, 64)
        keys = torch.randn(2, 32)
        out = model(sensor, keys, return_embedding=False)
        out["logits"].sum().backward()
        for name, p in model.named_parameters():
            if p.requires_grad:
                assert p.grad is not None, f"No gradient for {name}"
