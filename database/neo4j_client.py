"""
FinGuard 2026 — Neo4j Graph Database Client.

Manages connections to Neo4j for the heterogeneous transaction graph.
Provides methods for risk contagion queries and cycle detection.
"""

from __future__ import annotations

from typing import Any

from config.logging_config import get_logger

logger = get_logger(__name__)


class Neo4jClient:
    """
    Neo4j client for graph intelligence queries.

    Manages the transaction graph where nodes are Users, Devices, IPs,
    and Merchants, with typed relationships between them.
    """

    def __init__(self, uri: str = "bolt://localhost:7687",
                 user: str = "neo4j", password: str = "finguard2026"):
        self.uri = uri
        self.user = user
        self.password = password
        self._driver = None

    def _get_driver(self) -> Any:
        if self._driver is None:
            try:
                from neo4j import GraphDatabase
                self._driver = GraphDatabase.driver(
                    self.uri, auth=(self.user, self.password)
                )
                logger.info("neo4j_connected", uri=self.uri)
            except ImportError:
                logger.warning("neo4j_driver_not_installed")
                self._driver = MockNeo4jDriver()
        return self._driver

    def add_transaction(self, user_id: str, merchant_id: str, device_id: str,
                        ip_hash: str, amount: float, channel: str = "online") -> None:
        """Add a transaction and all entity relationships to the graph."""
        driver = self._get_driver()
        query = """
        MERGE (u:User {userId: $user_id})
        MERGE (m:Merchant {merchantId: $merchant_id})
        MERGE (d:Device {deviceId: $device_id})
        MERGE (i:IP {ipHash: $ip_hash})
        MERGE (u)-[:TRANSACTED_AT {amount: $amount, channel: $channel, 
                                    timestamp: datetime()}]->(m)
        MERGE (u)-[:USED_DEVICE]->(d)
        MERGE (u)-[:USED_IP]->(i)
        WITH d
        SET d.userCount = COALESCE(d.userCount, 0) + 1
        """
        with driver.session() as session:
            session.run(query, user_id=user_id, merchant_id=merchant_id,
                       device_id=device_id, ip_hash=ip_hash,
                       amount=amount, channel=channel)

    def get_risk_contagion(self, user_id: str, max_hops: int = 3
                           ) -> list[dict[str, Any]]:
        """
        Find risk contagion — users connected to known mule accounts
        within N hops through shared devices, IPs, or merchants.
        """
        driver = self._get_driver()
        query = """
        MATCH path = (mule:User {isMule: true})-[*1..$max_hops]-(suspect:User {userId: $user_id})
        RETURN mule.userId AS mule_id, 
               mule.riskScore AS mule_risk,
               length(path) AS distance,
               [n IN nodes(path) | labels(n)[0] + ':' + COALESCE(n.userId, n.deviceId, n.ipHash, n.merchantId, 'unknown')] AS path_nodes
        ORDER BY distance ASC
        LIMIT 20
        """
        with driver.session() as session:
            result = session.run(query, user_id=user_id, max_hops=max_hops)
            return [dict(record) for record in result]

    def detect_cycles(self, min_length: int = 3, max_length: int = 8,
                      min_amount: float = 100.0) -> list[dict[str, Any]]:
        """
        Detect money laundering cycles — closed loops of transactions
        that could indicate layering schemes.
        """
        driver = self._get_driver()
        query = """
        MATCH cycle = (u:User)-[:TRANSACTED_AT*$min_len..$max_len]->(u)
        WHERE ALL(r IN relationships(cycle) WHERE r.amount > $min_amount)
        WITH u, cycle, 
             length(cycle) AS cycle_length,
             REDUCE(total = 0.0, r IN relationships(cycle) | total + r.amount) AS total_amount
        RETURN u.userId AS origin_user,
               cycle_length,
               total_amount,
               [n IN nodes(cycle) | COALESCE(n.userId, n.merchantId, 'unknown')] AS cycle_nodes
        ORDER BY total_amount DESC
        LIMIT 50
        """
        with driver.session() as session:
            result = session.run(query, min_len=min_length,
                               max_len=max_length, min_amount=min_amount)
            return [dict(record) for record in result]

    def get_user_neighborhood(self, user_id: str, depth: int = 2
                               ) -> dict[str, Any]:
        """Get the ego-network of a user for the explorable graph UI."""
        driver = self._get_driver()
        query = """
        MATCH path = (u:User {userId: $user_id})-[*1..$depth]-(connected)
        WITH COLLECT(DISTINCT {
            id: COALESCE(connected.userId, connected.deviceId, connected.ipHash, connected.merchantId),
            type: labels(connected)[0],
            risk: COALESCE(connected.riskScore, 0),
            isFlagged: COALESCE(connected.isFlagged, connected.isMule, false)
        }) AS nodes,
        COLLECT(DISTINCT {
            source: COALESCE(startNode(last(relationships(path))).userId, startNode(last(relationships(path))).deviceId, 'unknown'),
            target: COALESCE(endNode(last(relationships(path))).userId, endNode(last(relationships(path))).merchantId, 'unknown'),
            type: type(last(relationships(path)))
        }) AS edges
        RETURN nodes, edges
        """
        with driver.session() as session:
            result = session.run(query, user_id=user_id, depth=depth)
            record = result.single()
            if record:
                return {"nodes": record["nodes"], "edges": record["edges"]}
            return {"nodes": [], "edges": []}

    def update_risk_score(self, user_id: str, risk_score: float) -> None:
        driver = self._get_driver()
        query = "MATCH (u:User {userId: $user_id}) SET u.riskScore = $risk_score"
        with driver.session() as session:
            session.run(query, user_id=user_id, risk_score=risk_score)

    def flag_mule(self, user_id: str) -> None:
        driver = self._get_driver()
        query = "MATCH (u:User {userId: $user_id}) SET u.isMule = true"
        with driver.session() as session:
            session.run(query, user_id=user_id)

    def close(self) -> None:
        if self._driver and hasattr(self._driver, "close"):
            self._driver.close()


class MockNeo4jDriver:
    """Mock driver for development without Neo4j."""
    def session(self):
        return MockSession()
    def close(self):
        pass

class MockSession:
    def __enter__(self):
        return self
    def __exit__(self, *args):
        pass
    def run(self, query, **kwargs):
        return MockResult()

class MockResult:
    def __iter__(self):
        return iter([])
    def single(self):
        return None
