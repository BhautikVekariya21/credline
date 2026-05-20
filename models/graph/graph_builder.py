"""
FinGuard 2026 — Dynamic Graph Builder.

Constructs PyTorch Geometric HeteroData / Data objects from transaction
batches. Handles dynamic entity registration, edge creation, and
topological feature injection for the FraudGraphSAGE model.
"""

from __future__ import annotations

import hashlib
from collections import defaultdict
from typing import Any

import numpy as np
import torch
from torch_geometric.data import Data, HeteroData


class TransactionGraphBuilder:
    """
    Builds transaction graphs from raw event data.

    Graph structure (homogeneous mode):
        - All entities (users, merchants, devices, IPs) are nodes
        - Edges represent relationships: transacted_at, used_device, used_ip

    Graph structure (heterogeneous mode):
        - Separate node types for users, merchants, devices, IPs
        - Typed edges between them

    The builder maintains a global entity registry to assign stable node IDs
    across incremental graph updates.
    """

    def __init__(self, mode: str = "homogeneous"):
        """
        Args:
            mode: "homogeneous" (single node/edge type) or "heterogeneous"
        """
        assert mode in ("homogeneous", "heterogeneous")
        self.mode = mode

        # Entity → global node ID mapping
        self.entity_to_id: dict[str, int] = {}
        self.id_to_entity: dict[int, str] = {}
        self.entity_types: dict[str, str] = {}  # entity_id → type

        # Node features accumulated during build
        self._node_features: dict[int, list[float]] = {}
        self._node_labels: dict[int, float] = {}

    def _get_or_create_id(self, entity_id: str, entity_type: str) -> int:
        """Register an entity and return its stable node ID."""
        if entity_id not in self.entity_to_id:
            nid = len(self.entity_to_id)
            self.entity_to_id[entity_id] = nid
            self.id_to_entity[nid] = entity_id
            self.entity_types[entity_id] = entity_type
        return self.entity_to_id[entity_id]

    def build_from_transactions(
        self,
        transactions: list[dict[str, Any]],
        feature_dim: int = 16,
    ) -> Data:
        """
        Build a homogeneous graph from transaction records.

        Args:
            transactions: List of transaction dicts with keys:
                user_id, merchant_id, device_id, ip_address, amount,
                hour_of_day, day_of_week, is_fraud (optional)
            feature_dim: Dimensionality of generated node features.

        Returns:
            PyG Data object with x, edge_index, y (if labels exist).
        """
        edges_src: list[int] = []
        edges_dst: list[int] = []
        edge_attrs: list[list[float]] = []

        for tx in transactions:
            user_nid = self._get_or_create_id(tx["user_id"], "user")
            merchant_nid = self._get_or_create_id(tx["merchant_id"], "merchant")
            device_nid = self._get_or_create_id(tx["device_id"], "device")
            ip_nid = self._get_or_create_id(tx["ip_address"], "ip")

            amount = float(tx.get("amount", 0))
            hour = float(tx.get("hour_of_day", 0)) / 24.0
            dow = float(tx.get("day_of_week", 0)) / 7.0

            # user → merchant
            edges_src.append(user_nid)
            edges_dst.append(merchant_nid)
            edge_attrs.append([amount, hour, dow])

            # user → device
            edges_src.append(user_nid)
            edges_dst.append(device_nid)
            edge_attrs.append([amount, hour, dow])

            # user → ip
            edges_src.append(user_nid)
            edges_dst.append(ip_nid)
            edge_attrs.append([amount, hour, dow])

            # Store fraud label for user nodes
            if tx.get("is_fraud") is not None:
                self._node_labels[user_nid] = 1.0 if tx["is_fraud"] else 0.0

        num_nodes = len(self.entity_to_id)

        # Generate node features (hash-based for consistency)
        x = torch.zeros(num_nodes, feature_dim)
        for entity_id, nid in self.entity_to_id.items():
            # Deterministic feature generation from entity hash
            h = hashlib.sha256(entity_id.encode()).digest()
            features = [float(b) / 255.0 for b in h[:feature_dim]]
            x[nid] = torch.tensor(features)

        # Build edge index (bidirectional)
        edge_index = torch.tensor(
            [edges_src + edges_dst, edges_dst + edges_src], dtype=torch.long
        )

        # Build edge attributes (duplicated for bidirectional)
        if edge_attrs:
            edge_attr = torch.tensor(edge_attrs + edge_attrs, dtype=torch.float)
        else:
            edge_attr = None

        # Build labels
        y = torch.full((num_nodes,), -1.0)  # -1 = unlabeled
        for nid, label in self._node_labels.items():
            y[nid] = label

        data = Data(x=x, edge_index=edge_index, edge_attr=edge_attr, y=y)
        data.num_nodes = num_nodes

        return data

    def build_hetero_from_transactions(
        self,
        transactions: list[dict[str, Any]],
        feature_dim: int = 16,
    ) -> HeteroData:
        """
        Build a heterogeneous graph with typed nodes and edges.

        Returns:
            PyG HeteroData object.
        """
        data = HeteroData()

        # Collect entities by type
        type_entities: dict[str, dict[str, int]] = defaultdict(dict)
        edge_store: dict[tuple[str, str, str], list[tuple[int, int]]] = defaultdict(list)

        for tx in transactions:
            for key, etype in [
                ("user_id", "user"),
                ("merchant_id", "merchant"),
                ("device_id", "device"),
                ("ip_address", "ip"),
            ]:
                eid = tx[key]
                if eid not in type_entities[etype]:
                    type_entities[etype][eid] = len(type_entities[etype])

            uid = type_entities["user"][tx["user_id"]]
            mid = type_entities["merchant"][tx["merchant_id"]]
            did = type_entities["device"][tx["device_id"]]
            iid = type_entities["ip"][tx["ip_address"]]

            edge_store[("user", "transacts_at", "merchant")].append((uid, mid))
            edge_store[("user", "uses_device", "device")].append((uid, did))
            edge_store[("user", "uses_ip", "ip")].append((uid, iid))

        # Set node features
        for ntype, entities in type_entities.items():
            n = len(entities)
            data[ntype].x = torch.randn(n, feature_dim)
            data[ntype].num_nodes = n

        # Set edges (bidirectional)
        for (src_type, rel, dst_type), edges in edge_store.items():
            if edges:
                src_ids, dst_ids = zip(*edges)
                ei = torch.tensor([list(src_ids), list(dst_ids)], dtype=torch.long)
                data[src_type, rel, dst_type].edge_index = ei

                # Reverse edges
                rev_rel = f"rev_{rel}"
                data[dst_type, rev_rel, src_type].edge_index = torch.stack(
                    [ei[1], ei[0]]
                )

        return data

    def reset(self) -> None:
        """Clear entity registry for a fresh graph."""
        self.entity_to_id.clear()
        self.id_to_entity.clear()
        self.entity_types.clear()
        self._node_features.clear()
        self._node_labels.clear()
