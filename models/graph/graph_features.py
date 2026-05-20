"""
FinGuard 2026 — Topological Feature Extraction.

Computes graph-theoretic features (PageRank, degree centrality, clustering
coefficient) that are injected as additional node features to enrich the
GNN's input representation.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import torch
from torch_geometric.data import Data
from torch_geometric.utils import degree, to_networkx


class TopologicalFeatureExtractor:
    """
    Extract topological features from a PyG graph and inject them
    as additional node features.

    Features computed:
    - Degree centrality (normalized)
    - In-degree / Out-degree ratio
    - PageRank score
    - Local clustering coefficient
    - Number of triangles
    """

    def __init__(self, use_networkx: bool = True):
        """
        Args:
            use_networkx: If True, convert to NetworkX for advanced metrics.
                          If False, only compute PyG-native features (faster).
        """
        self.use_networkx = use_networkx

    def extract(self, data: Data) -> torch.Tensor:
        """
        Compute topological features for all nodes.

        Args:
            data: PyG Data object with edge_index and num_nodes.

        Returns:
            Tensor of shape [num_nodes, num_features] with topological features.
        """
        num_nodes = data.num_nodes
        features: list[torch.Tensor] = []

        # 1. Degree centrality (normalized)
        deg = degree(data.edge_index[0], num_nodes=num_nodes).float()
        max_deg = deg.max().clamp(min=1.0)
        deg_norm = deg / max_deg
        features.append(deg_norm.unsqueeze(1))

        # 2. Log degree (captures scale)
        log_deg = torch.log1p(deg).unsqueeze(1)
        features.append(log_deg)

        if self.use_networkx:
            try:
                import networkx as nx

                G = to_networkx(data, to_undirected=True)

                # 3. PageRank
                pr = nx.pagerank(G, alpha=0.85, max_iter=100)
                pr_tensor = torch.tensor(
                    [pr.get(i, 0.0) for i in range(num_nodes)], dtype=torch.float
                ).unsqueeze(1)
                features.append(pr_tensor)

                # 4. Clustering coefficient
                cc = nx.clustering(G)
                cc_tensor = torch.tensor(
                    [cc.get(i, 0.0) for i in range(num_nodes)], dtype=torch.float
                ).unsqueeze(1)
                features.append(cc_tensor)

                # 5. Betweenness centrality (sampled for large graphs)
                if num_nodes < 5000:
                    bc = nx.betweenness_centrality(G, k=min(100, num_nodes))
                else:
                    bc = nx.betweenness_centrality(G, k=100)
                bc_tensor = torch.tensor(
                    [bc.get(i, 0.0) for i in range(num_nodes)], dtype=torch.float
                ).unsqueeze(1)
                features.append(bc_tensor)

            except ImportError:
                # Fallback: pad with zeros if networkx not available
                for _ in range(3):
                    features.append(torch.zeros(num_nodes, 1))

        return torch.cat(features, dim=1)

    def augment_node_features(self, data: Data) -> Data:
        """
        Compute topological features and concatenate with existing node features.

        Args:
            data: PyG Data with existing x features.

        Returns:
            Same Data object with augmented x tensor.
        """
        topo_features = self.extract(data)

        if data.x is not None:
            data.x = torch.cat([data.x, topo_features], dim=1)
        else:
            data.x = topo_features

        return data
