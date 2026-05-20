"""
FinGuard 2026 — FraudGraphSAGE Model.

GraphSAGE-based Graph Neural Network for fraud detection on heterogeneous
transaction graphs. Maps relationships between accounts, merchants, IPs,
and devices to detect fraud rings and coordinated attacks.

Architecture:
    - Multi-layer SAGEConv with skip connections
    - GraphNorm after each layer for training stability
    - Xavier initialization for consistent convergence
    - Inductive: can embed unseen nodes without retraining

Output: 128-dim node embedding capturing multi-hop structural risk.
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv, GraphNorm, global_mean_pool


class FraudGraphSAGE(nn.Module):
    """
    GraphSAGE for fraud detection on heterogeneous transaction graphs.

    Nodes represent: users, merchants, devices, IP addresses.
    Edges represent: transacted_at, used_device, used_ip.

    The model produces dense embeddings that capture multi-hop structural
    relationships — enabling detection of fraud rings where individual
    transactions appear normal but the graph neighborhood is suspicious.

    Args:
        in_channels: Dimensionality of input node features.
        hidden_channels: Hidden layer dimensionality (default: 256).
        out_channels: Output embedding dimensionality (default: 128).
        num_layers: Number of SAGEConv message-passing layers (default: 3).
        dropout: Dropout probability for regularization (default: 0.3).
    """

    def __init__(
        self,
        in_channels: int,
        hidden_channels: int = 256,
        out_channels: int = 128,
        num_layers: int = 3,
        dropout: float = 0.3,
    ):
        super().__init__()
        self.in_channels = in_channels
        self.hidden_channels = hidden_channels
        self.out_channels = out_channels
        self.num_layers = num_layers
        self.dropout = dropout

        # ─── SAGEConv Layers ───────────────────────────────────────────────
        self.convs = nn.ModuleList()
        self.norms = nn.ModuleList()
        self.skips = nn.ModuleList()  # Linear projections for skip connections

        for i in range(num_layers):
            in_ch = in_channels if i == 0 else hidden_channels
            out_ch = hidden_channels if i < num_layers - 1 else out_channels

            self.convs.append(
                SAGEConv(
                    in_ch,
                    out_ch,
                    normalize=True,
                    project=True,  # Learnable projection before aggregation
                )
            )
            self.norms.append(GraphNorm(out_ch))

            # Skip connection: project input dimension to match output
            if in_ch != out_ch:
                self.skips.append(nn.Linear(in_ch, out_ch, bias=False))
            else:
                self.skips.append(nn.Identity())

        # ─── Classification Head (optional, for direct node classification) ─
        self.classifier = nn.Sequential(
            nn.Linear(out_channels, out_channels // 2),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout),
            nn.Linear(out_channels // 2, 1),
        )

        # ─── Initialize Weights ───────────────────────────────────────────
        self._init_weights()

    def _init_weights(self) -> None:
        """Xavier initialization for stable training across deep architectures."""
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.xavier_uniform_(module.weight)
                if module.bias is not None:
                    nn.init.zeros_(module.bias)

    def forward(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        batch: torch.Tensor | None = None,
        return_embedding: bool = True,
    ) -> dict[str, torch.Tensor]:
        """
        Forward pass through the GraphSAGE encoder.

        Args:
            x: Node feature matrix [num_nodes, in_channels].
            edge_index: Edge index tensor [2, num_edges].
            batch: Batch assignment vector for graph-level pooling.
            return_embedding: If True, return raw embeddings (for ensemble).
                              If False, return classification logits.

        Returns:
            Dictionary with:
                - 'embedding': Node-level embeddings [num_nodes, out_channels]
                - 'logits': (optional) Classification logits [num_nodes, 1]
                - 'graph_embedding': (optional) Graph-level embedding if batch provided
        """
        h = x

        for i in range(self.num_layers):
            # Message passing
            h_new = self.convs[i](h, edge_index)

            # Normalize
            h_new = self.norms[i](h_new)

            # Skip connection + activation (except last layer)
            h_skip = self.skips[i](h)
            if i < self.num_layers - 1:
                h = F.relu(h_new + h_skip, inplace=True)
                h = F.dropout(h, p=self.dropout, training=self.training)
            else:
                h = h_new + h_skip  # No activation on final layer

        result: dict[str, torch.Tensor] = {"embedding": h}

        # Graph-level pooling if batch provided
        if batch is not None:
            result["graph_embedding"] = global_mean_pool(h, batch)

        # Classification head
        if not return_embedding:
            result["logits"] = self.classifier(h)
            result["probabilities"] = torch.sigmoid(result["logits"])

        return result

    def get_embedding(
        self, x: torch.Tensor, edge_index: torch.Tensor
    ) -> torch.Tensor:
        """Convenience method: extract only the node embeddings."""
        return self.forward(x, edge_index, return_embedding=True)["embedding"]

    def smoke_test(self, num_nodes: int = 100, num_edges: int = 300) -> None:
        """Quick validation that forward pass produces correct output shapes."""
        self.eval()
        with torch.no_grad():
            x = torch.randn(num_nodes, self.in_channels)
            edge_index = torch.randint(0, num_nodes, (2, num_edges))
            batch = torch.zeros(num_nodes, dtype=torch.long)

            out = self.forward(x, edge_index, batch=batch, return_embedding=False)

            assert out["embedding"].shape == (num_nodes, self.out_channels), (
                f"Expected ({num_nodes}, {self.out_channels}), "
                f"got {out['embedding'].shape}"
            )
            assert out["graph_embedding"].shape == (1, self.out_channels)
            assert out["logits"].shape == (num_nodes, 1)

        print(f"✅ FraudGraphSAGE smoke test passed: "
              f"embedding={out['embedding'].shape}, "
              f"graph_embedding={out['graph_embedding'].shape}")
