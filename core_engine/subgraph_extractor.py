"""
Credit Line Fintech Solution — Phase 10: SubGraph Extractor.

Lightning-fast 3-hop neighborhood extraction from Neo4j for GNN inference.
Formats raw Cypher results into torch_geometric.data.Data objects
ready for direct FraudGraphSAGE consumption — zero disk I/O.

Performance target: < 30ms for 3-hop extraction on 10M-node graphs.
"""

from __future__ import annotations

import time
from typing import Any

import numpy as np

from config.logging_config import get_logger

logger = get_logger(__name__)

# ─── Tuned Cypher Queries ────────────────────────────────────────────

SUBGRAPH_3HOP_QUERY = """
MATCH (center:User {id: $user_id})
CALL apoc.path.subgraphAll(center, {
    maxLevel: $hops,
    limit: $max_neighbors,
    relationshipFilter: "TRANSACTED_WITH|USED_DEVICE|FROM_IP"
})
YIELD nodes, relationships
WITH nodes, relationships
UNWIND nodes AS n
WITH collect(DISTINCT {
    id: id(n),
    labels: labels(n),
    props: properties(n)
}) AS node_list,
relationships
UNWIND relationships AS r
WITH node_list, collect(DISTINCT {
    src: id(startNode(r)),
    dst: id(endNode(r)),
    type: type(r),
    props: properties(r)
}) AS edge_list
RETURN node_list, edge_list
"""

# Fallback query when APOC is not installed
SUBGRAPH_FALLBACK_QUERY = """
MATCH path = (center:User {id: $user_id})-[*1..3]-(neighbor)
WITH center, collect(DISTINCT neighbor) AS neighbors,
     collect(DISTINCT relationships(path)) AS all_rels
UNWIND neighbors AS n
WITH collect(DISTINCT {
    id: id(n),
    labels: labels(n),
    props: properties(n)
}) AS node_list, all_rels
UNWIND all_rels AS rels
UNWIND rels AS r
WITH node_list, collect(DISTINCT {
    src: id(startNode(r)),
    dst: id(endNode(r)),
    type: type(r)
}) AS edge_list
RETURN node_list, edge_list
"""


class SubGraphExtractor:
    """
    Extracts k-hop ego-networks from Neo4j and formats them
    as PyG-compatible tensors for GNN inference.
    """

    # Feature dimensions per node type
    NODE_FEAT_DIM = 32

    # Node type → feature extraction
    NODE_TYPE_MAP = {
        "User": 0,
        "Merchant": 1,
        "Device": 2,
        "IP": 3,
    }

    def __init__(self, neo4j_driver: Any = None):
        self._driver = neo4j_driver
        self._use_apoc = True

    async def extract(
        self,
        user_id: str,
        hops: int = 3,
        max_neighbors: int = 50,
    ) -> dict[str, Any]:
        """
        Extract a user's k-hop subgraph and return PyG-ready tensors.

        Returns:
            node_ids, edge_index (2×E), node_features (N×D), metadata
        """
        start = time.perf_counter()

        if self._driver:
            raw = await self._query_neo4j(user_id, hops, max_neighbors)
        else:
            raw = self._generate_synthetic(user_id, hops, max_neighbors)

        # Parse into tensors
        result = self._to_pyg_format(raw, user_id)
        result["extraction_ms"] = round((time.perf_counter() - start) * 1000, 2)

        logger.info(
            "subgraph_extracted",
            user_id=user_id,
            hops=hops,
            num_nodes=result["num_nodes"],
            num_edges=result["num_edges"],
            extraction_ms=result["extraction_ms"],
        )

        return result

    async def _query_neo4j(
        self, user_id: str, hops: int, max_neighbors: int,
    ) -> dict[str, Any]:
        """Execute Cypher and return raw node/edge lists."""
        query = SUBGRAPH_3HOP_QUERY if self._use_apoc else SUBGRAPH_FALLBACK_QUERY
        params = {
            "user_id": user_id,
            "hops": hops,
            "max_neighbors": max_neighbors,
        }

        async with self._driver.session() as session:
            result = await session.run(query, params)
            record = await result.single()

            if not record:
                return {"node_list": [], "edge_list": []}

            return {
                "node_list": record["node_list"],
                "edge_list": record["edge_list"],
            }

    def _generate_synthetic(
        self, user_id: str, hops: int, max_neighbors: int,
    ) -> dict[str, Any]:
        """Generate realistic synthetic subgraph for dev/testing."""
        rng = np.random.default_rng(hash(user_id) % 2**32)
        num_nodes = min(rng.integers(20, 80), max_neighbors * hops)
        num_edges = num_nodes * 2

        nodes = []
        for i in range(num_nodes):
            node_type = rng.choice(["User", "Merchant", "Device", "IP"],
                                   p=[0.4, 0.3, 0.15, 0.15])
            nodes.append({
                "id": i,
                "labels": [node_type],
                "props": {
                    "id": f"{node_type[:1]}-{rng.integers(1000, 9999)}",
                    "tx_count": int(rng.integers(1, 200)),
                    "total_amount": float(rng.uniform(100, 50000)),
                },
            })

        edges = []
        for _ in range(num_edges):
            src = int(rng.integers(0, num_nodes))
            dst = int(rng.integers(0, num_nodes))
            if src != dst:
                edges.append({
                    "src": src,
                    "dst": dst,
                    "type": rng.choice([
                        "TRANSACTED_WITH", "USED_DEVICE", "FROM_IP"]),
                })

        return {"node_list": nodes, "edge_list": edges}

    def _to_pyg_format(
        self, raw: dict[str, Any], center_user: str,
    ) -> dict[str, Any]:
        """Convert raw Neo4j data to PyG-compatible numpy arrays."""
        nodes = raw.get("node_list", [])
        edges = raw.get("edge_list", [])

        if not nodes:
            return {
                "num_nodes": 0,
                "num_edges": 0,
                "node_ids": [],
                "edge_index": [[], []],
                "node_features": [],
                "center_node_idx": 0,
            }

        # Build node ID mapping
        id_to_idx = {}
        for i, node in enumerate(nodes):
            id_to_idx[node["id"]] = i

        # Node features: [type_onehot(4) + tx_count(1) + total_amount(1) + pad]
        num_nodes = len(nodes)
        feat_dim = self.NODE_FEAT_DIM
        features = np.zeros((num_nodes, feat_dim), dtype=np.float32)

        for i, node in enumerate(nodes):
            label = node["labels"][0] if node["labels"] else "User"
            type_idx = self.NODE_TYPE_MAP.get(label, 0)
            features[i, type_idx] = 1.0  # One-hot

            props = node.get("props", {})
            if "tx_count" in props:
                features[i, 4] = np.log1p(props["tx_count"])
            if "total_amount" in props:
                features[i, 5] = np.log1p(props["total_amount"]) / 12.0

        # Edge index
        edge_src = []
        edge_dst = []
        for e in edges:
            src_idx = id_to_idx.get(e["src"])
            dst_idx = id_to_idx.get(e["dst"])
            if src_idx is not None and dst_idx is not None:
                edge_src.append(src_idx)
                edge_dst.append(dst_idx)
                # Undirected
                edge_src.append(dst_idx)
                edge_dst.append(src_idx)

        return {
            "num_nodes": num_nodes,
            "num_edges": len(edge_src),
            "node_ids": [n["id"] for n in nodes],
            "edge_index": [edge_src, edge_dst],
            "node_features": features.tolist(),
            "feat_dim": feat_dim,
            "center_node_idx": 0,
        }
