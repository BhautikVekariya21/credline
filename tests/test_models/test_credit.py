"""
FinGuard 2026 — Credit Model Unit Tests.
"""

import pytest
import numpy as np

from models.credit.ssl_masked_transaction import MaskedTransactionModel


class TestMaskedTransactionModel:

    @pytest.fixture
    def model(self):
        import torch
        return MaskedTransactionModel(num_features=10, d_model=64,
                                       nhead=4, num_layers=2)

    def test_forward_shape(self, model):
        import torch
        x = torch.randn(4, 16, 10)
        out = model(x)
        assert out["reconstructed"].shape == (4, 16, 10)
        assert out["mask"].shape == (4, 16)
        assert out["loss"].dim() == 0

    def test_masking(self, model):
        import torch
        x = torch.randn(4, 16, 10)
        out = model(x)
        # At least some positions should be masked
        assert out["mask"].any()

    def test_representations(self, model):
        import torch
        x = torch.randn(2, 8, 10)
        reps = model.get_representations(x)
        assert reps.shape == (2, 8, 64)

    def test_smoke(self, model):
        model.smoke_test(batch_size=2, seq_len=8)
