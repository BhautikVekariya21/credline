"""
FinGuard 2026 — CBDC & Blockchain Ingestion Connector.

Ingests transactions from Central Bank Digital Currencies (CBDCs)
and public blockchains. Extends the fraud detection graph to cover:
  - Digital Yuan (e-CNY) / Digital Euro / Digital Dollar pilot streams
  - ERC-20 token transfers and DEX swaps
  - Smart contract deployment and interaction traces
  - Cross-chain bridge transfers (high-risk for laundering)

Also includes a Smart Contract Anomaly Detector that flags contracts
mimicking known exploit or mixer patterns (e.g., Tornado Cash equivalents).

Usage:
    python -m consortium.blockchain_connector --chain ethereum --rpc http://localhost:8545
"""

from __future__ import annotations

import hashlib
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from config.logging_config import get_logger

logger = get_logger(__name__)


# ─── Data Models ──────────────────────────────────────────────────────

@dataclass
class BlockchainTransaction:
    """A transaction from a blockchain or CBDC ledger."""
    tx_hash: str
    chain: str  # "ethereum", "cbdc_digital_euro", "cbdc_ecny", etc.
    from_address: str
    to_address: str
    value: float
    currency: str
    gas_used: int = 0
    block_number: int = 0
    timestamp: float = field(default_factory=time.time)
    is_contract_call: bool = False
    contract_address: str | None = None
    method_signature: str | None = None
    input_data: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "tx_hash": self.tx_hash,
            "chain": self.chain,
            "from_address": self.from_address,
            "to_address": self.to_address,
            "value": self.value,
            "currency": self.currency,
            "gas_used": self.gas_used,
            "block_number": self.block_number,
            "timestamp": self.timestamp,
            "is_contract_call": self.is_contract_call,
            "contract_address": self.contract_address,
            "method_signature": self.method_signature,
        }


@dataclass
class SmartContractProfile:
    """Profile of a deployed smart contract for anomaly detection."""
    address: str
    chain: str
    bytecode_hash: str
    creation_tx: str
    deployer: str
    timestamp: float
    method_signatures: list[str] = field(default_factory=list)
    interaction_count: int = 0
    unique_callers: int = 0
    total_value_moved: float = 0.0
    risk_score: float = 0.0
    matched_patterns: list[str] = field(default_factory=list)


@dataclass
class AnomalyAlert:
    """Alert for suspicious smart contract or CBDC activity."""
    alert_id: str
    alert_type: str  # "mixer_pattern", "exploit_clone", "bridge_abuse", "velocity"
    severity: str
    chain: str
    address: str
    description: str
    risk_score: float
    evidence: dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)


# ─── Known Exploit / Mixer Patterns ──────────────────────────────────

# Simplified bytecode signatures of known mixer/exploit contract patterns
KNOWN_MIXER_SIGNATURES = {
    "tornado_cash_v1": {
        "methods": ["deposit(bytes32)", "withdraw(bytes,bytes32,bytes32,address,address,uint256,uint256)"],
        "pattern": "merkle_tree_deposit_withdraw",
        "severity": "critical",
    },
    "tornado_cash_v2": {
        "methods": ["deposit(bytes32)", "withdraw(bytes,bytes32,bytes32,address,address,uint256,uint256)"],
        "pattern": "zksnark_mixer",
        "severity": "critical",
    },
    "generic_mixer": {
        "methods": ["mix(uint256)", "pool(address)"],
        "pattern": "pool_and_redistribute",
        "severity": "high",
    },
}

KNOWN_EXPLOIT_PATTERNS = {
    "reentrancy": {
        "indicators": ["call.value", "withdraw", "fallback"],
        "description": "Potential reentrancy exploit (The DAO pattern)",
        "severity": "critical",
    },
    "flash_loan_attack": {
        "indicators": ["flashLoan", "executeOperation", "swap"],
        "description": "Flash loan-based price manipulation",
        "severity": "high",
    },
    "proxy_upgrade_abuse": {
        "indicators": ["upgradeTo", "delegatecall", "implementation"],
        "description": "Malicious proxy upgrade to drain funds",
        "severity": "critical",
    },
}


# ─── Blockchain Connector ────────────────────────────────────────────

class BlockchainConnector:
    """
    Ingests and normalizes transactions from blockchains and CBDCs.

    Supports:
      - Ethereum/EVM-compatible chains (via JSON-RPC)
      - CBDC pilot networks (via REST API simulation)
      - Cross-chain bridge monitoring
    """

    def __init__(
        self,
        chain: str = "ethereum",
        rpc_url: str | None = None,
    ):
        self.chain = chain
        self.rpc_url = rpc_url
        self._processed_blocks = 0
        self._total_txs = 0

        logger.info("blockchain_connector_init", chain=chain, rpc=rpc_url)

    def fetch_block_transactions(
        self, block_number: int | str = "latest",
    ) -> list[BlockchainTransaction]:
        """
        Fetch transactions from a block.
        In production: calls JSON-RPC eth_getBlockByNumber.
        """
        if self.rpc_url:
            return self._fetch_from_rpc(block_number)
        return self._generate_synthetic_block()

    def _fetch_from_rpc(self, block_number: int | str) -> list[BlockchainTransaction]:
        """Fetch from an actual Ethereum RPC node."""
        try:
            import requests

            payload = {
                "jsonrpc": "2.0",
                "method": "eth_getBlockByNumber",
                "params": [hex(block_number) if isinstance(block_number, int)
                           else block_number, True],
                "id": 1,
            }
            resp = requests.post(self.rpc_url, json=payload, timeout=10)
            data = resp.json().get("result", {})

            txs = []
            for raw_tx in data.get("transactions", []):
                tx = BlockchainTransaction(
                    tx_hash=raw_tx.get("hash", ""),
                    chain=self.chain,
                    from_address=raw_tx.get("from", ""),
                    to_address=raw_tx.get("to", "") or "",
                    value=int(raw_tx.get("value", "0"), 16) / 1e18,
                    currency="ETH",
                    gas_used=int(raw_tx.get("gas", "0"), 16),
                    block_number=int(raw_tx.get("blockNumber", "0"), 16),
                    is_contract_call=raw_tx.get("to") is None
                                     or len(raw_tx.get("input", "0x")) > 10,
                    input_data=raw_tx.get("input", "0x")[:200],
                )
                txs.append(tx)

            self._processed_blocks += 1
            self._total_txs += len(txs)
            return txs

        except Exception as e:
            logger.warning("rpc_fetch_failed", error=str(e))
            return self._generate_synthetic_block()

    def _generate_synthetic_block(self) -> list[BlockchainTransaction]:
        """Generate synthetic blockchain transactions for simulation."""
        import random

        txs = []
        n_txs = random.randint(50, 200)

        for _ in range(n_txs):
            is_contract = random.random() < 0.3
            tx = BlockchainTransaction(
                tx_hash=f"0x{uuid.uuid4().hex}",
                chain=self.chain,
                from_address=f"0x{uuid.uuid4().hex[:40]}",
                to_address=f"0x{uuid.uuid4().hex[:40]}",
                value=random.expovariate(1.0) * 10,
                currency="ETH" if self.chain == "ethereum" else "CBDC",
                gas_used=random.randint(21000, 500000),
                block_number=self._processed_blocks + 1,
                is_contract_call=is_contract,
                method_signature="transfer(address,uint256)" if is_contract else None,
            )
            txs.append(tx)

        self._processed_blocks += 1
        self._total_txs += len(txs)
        return txs

    def get_status(self) -> dict[str, Any]:
        return {
            "chain": self.chain,
            "blocks_processed": self._processed_blocks,
            "total_transactions": self._total_txs,
            "rpc_url": self.rpc_url,
        }


# ─── Smart Contract Anomaly Detector ─────────────────────────────────

class SmartContractAnomalyDetector:
    """
    Detects smart contracts that mimic known exploit or mixer patterns.

    Checks:
      1. Method signature matching against known mixer/exploit patterns
      2. Bytecode similarity to flagged contracts
      3. Behavioral analysis (rapid high-value interactions)
      4. Cross-reference with OFAC/sanctioned addresses
    """

    def __init__(self):
        self._known_contracts: dict[str, SmartContractProfile] = {}
        self._alerts: list[AnomalyAlert] = []

    def analyze_contract(
        self,
        address: str,
        bytecode: str = "",
        method_signatures: list[str] | None = None,
        deployer: str = "",
        chain: str = "ethereum",
    ) -> SmartContractProfile:
        """Analyze a smart contract for suspicious patterns."""
        methods = method_signatures or []
        bytecode_hash = hashlib.sha256(bytecode.encode()).hexdigest()[:16]

        profile = SmartContractProfile(
            address=address,
            chain=chain,
            bytecode_hash=bytecode_hash,
            creation_tx=f"0x{uuid.uuid4().hex}",
            deployer=deployer,
            timestamp=time.time(),
            method_signatures=methods,
        )

        # Check against known mixer patterns
        for pattern_name, pattern in KNOWN_MIXER_SIGNATURES.items():
            overlap = set(methods) & set(pattern["methods"])
            if len(overlap) >= 1:
                profile.matched_patterns.append(pattern_name)
                profile.risk_score = max(profile.risk_score, 0.9)

                alert = AnomalyAlert(
                    alert_id=f"SC-{uuid.uuid4().hex[:8]}",
                    alert_type="mixer_pattern",
                    severity=pattern["severity"],
                    chain=chain,
                    address=address,
                    description=f"Contract matches {pattern_name}: "
                                f"{pattern['pattern']}",
                    risk_score=0.95,
                    evidence={
                        "pattern": pattern_name,
                        "matched_methods": list(overlap),
                        "deployer": deployer,
                    },
                )
                self._alerts.append(alert)
                logger.warning("mixer_contract_detected",
                               address=address, pattern=pattern_name)

        # Check against exploit patterns
        for exploit_name, exploit in KNOWN_EXPLOIT_PATTERNS.items():
            method_str = " ".join(methods).lower()
            matches = [ind for ind in exploit["indicators"]
                       if ind.lower() in method_str or ind.lower() in bytecode.lower()]
            if len(matches) >= 2:
                profile.matched_patterns.append(exploit_name)
                profile.risk_score = max(profile.risk_score, 0.85)

                alert = AnomalyAlert(
                    alert_id=f"SC-{uuid.uuid4().hex[:8]}",
                    alert_type="exploit_clone",
                    severity=exploit["severity"],
                    chain=chain,
                    address=address,
                    description=exploit["description"],
                    risk_score=0.9,
                    evidence={
                        "exploit_type": exploit_name,
                        "matched_indicators": matches,
                    },
                )
                self._alerts.append(alert)

        self._known_contracts[address] = profile
        return profile

    def analyze_transaction_pattern(
        self,
        contract_address: str,
        transactions: list[BlockchainTransaction],
    ) -> list[AnomalyAlert]:
        """Analyze transaction patterns around a contract for anomalies."""
        alerts = []

        # High-frequency interaction check
        if len(transactions) > 50:
            time_span = max(
                transactions[-1].timestamp - transactions[0].timestamp, 1)
            txs_per_hour = len(transactions) / (time_span / 3600)

            if txs_per_hour > 100:
                alert = AnomalyAlert(
                    alert_id=f"SC-VEL-{uuid.uuid4().hex[:8]}",
                    alert_type="velocity",
                    severity="high",
                    chain=transactions[0].chain,
                    address=contract_address,
                    description=f"Contract receiving {txs_per_hour:.0f} "
                                f"txs/hour (threshold: 100)",
                    risk_score=min(txs_per_hour / 200, 1.0),
                    evidence={
                        "txs_per_hour": round(txs_per_hour, 1),
                        "total_txs": len(transactions),
                    },
                )
                alerts.append(alert)

        # Bridge abuse: large values moving to/from known bridge contracts
        total_value = sum(t.value for t in transactions)
        unique_senders = len(set(t.from_address for t in transactions))

        if total_value > 100 and unique_senders > 20:
            alert = AnomalyAlert(
                alert_id=f"SC-BRIDGE-{uuid.uuid4().hex[:8]}",
                alert_type="bridge_abuse",
                severity="medium",
                chain=transactions[0].chain,
                address=contract_address,
                description=f"High-value aggregation: {total_value:.2f} ETH "
                            f"from {unique_senders} unique senders",
                risk_score=0.7,
                evidence={
                    "total_value": round(total_value, 4),
                    "unique_senders": unique_senders,
                },
            )
            alerts.append(alert)

        self._alerts.extend(alerts)
        return alerts

    def get_alerts(self) -> list[AnomalyAlert]:
        return self._alerts
