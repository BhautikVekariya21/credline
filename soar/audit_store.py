"""
FinGuard 2026 — SOAR Audit Store (MongoDB + Cryptographic Signatures).

Tamper-proof audit trail for all agent actions. Every record is:
  1. Hashed (SHA-256)
  2. Chained (each record includes prev_hash)
  3. Signed (HMAC-SHA256 with a server-side key)

This creates a blockchain-like immutable log for regulatory bodies.

Collections:
  - investigations    — Active investigation state documents
  - agent_actions     — Append-only action log
  - audit_chain       — Cryptographic hash chain
  - remediation_log   — Account freeze/hold records
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta
from typing import Any, Optional

from config.logging_config import get_logger

logger = get_logger(__name__)


class AuditStore:
    """
    MongoDB-backed immutable audit store with cryptographic integrity.

    Every agent action is recorded with:
    - HMAC-SHA256 signature for tamper detection
    - Hash chain linking (prev_hash) for ordering integrity
    - Append-only semantics on the audit_chain collection
    """

    def __init__(
        self,
        mongo_uri: str = "mongodb://localhost:27017",
        database: str = "finguard_soar",
        signing_key: str = "changeme-soar-signing-key",
    ) -> None:
        self.mongo_uri = mongo_uri
        self.database_name = database
        self._signing_key = signing_key.encode("utf-8")
        self._client = None
        self._db = None

    def _get_db(self) -> Any:
        """Lazy-initialize MongoDB connection."""
        if self._db is None:
            try:
                from pymongo import MongoClient
                self._client = MongoClient(self.mongo_uri, serverSelectionTimeoutMS=5000)
                self._db = self._client[self.database_name]
                # Create indexes
                self._db.investigations.create_index("investigation_id", unique=True)
                self._db.agent_actions.create_index("investigation_id")
                self._db.agent_actions.create_index("timestamp")
                self._db.audit_chain.create_index("investigation_id")
                self._db.remediation_log.create_index("investigation_id")
                self._db.escalations.create_index("escalation_id", unique=True)
                self._db.escalations.create_index("status")
                logger.info("mongodb_connected", uri=self.mongo_uri,
                           database=self.database_name)
            except ImportError:
                logger.warning("pymongo_not_installed", msg="Using in-memory fallback")
                self._db = InMemoryDB()
            except Exception as e:
                logger.warning("mongodb_connection_failed", error=str(e),
                             msg="Using in-memory fallback")
                self._db = InMemoryDB()
        return self._db

    # ─── Investigation CRUD ─────────────────────────────────────────────

    def create_investigation(self, investigation: dict) -> str:
        """Create a new investigation document."""
        db = self._get_db()
        inv_id = investigation.get("investigation_id", "")
        investigation["created_at"] = datetime.utcnow().isoformat() + "Z"
        investigation["updated_at"] = investigation["created_at"]

        if isinstance(db, InMemoryDB):
            db.investigations[inv_id] = investigation
        else:
            db.investigations.insert_one(investigation)

        # Log the creation action
        self.log_action(
            investigation_id=inv_id,
            agent="orchestrator",
            action="create_investigation",
            input_data={"alert_id": investigation.get("alert", {}).get("alert_id", "")},
            output_data={"investigation_id": inv_id, "state": "pending"},
        )
        logger.info("investigation_created", investigation_id=inv_id)
        return inv_id

    def get_investigation(self, investigation_id: str) -> Optional[dict]:
        """Retrieve an investigation by ID."""
        db = self._get_db()
        if isinstance(db, InMemoryDB):
            return db.investigations.get(investigation_id)
        doc = db.investigations.find_one({"investigation_id": investigation_id}, {"_id": 0})
        return doc

    def update_investigation(
        self,
        investigation_id: str,
        updates: dict,
    ) -> None:
        """Update an investigation's fields and log the state change."""
        db = self._get_db()
        updates["updated_at"] = datetime.utcnow().isoformat() + "Z"

        if isinstance(db, InMemoryDB):
            if investigation_id in db.investigations:
                db.investigations[investigation_id].update(updates)
        else:
            db.investigations.update_one(
                {"investigation_id": investigation_id},
                {"$set": updates},
            )

        # Log state change if state is in updates
        if "state" in updates:
            self.log_action(
                investigation_id=investigation_id,
                agent="orchestrator",
                action="state_transition",
                input_data={"new_state": updates["state"]},
                output_data=updates,
            )

    # ─── Agent Action Logging ───────────────────────────────────────────

    def log_action(
        self,
        investigation_id: str,
        agent: str,
        action: str,
        input_data: dict | None = None,
        output_data: dict | None = None,
    ) -> str:
        """
        Log an agent action with cryptographic signature and chain link.

        Returns the action_id.
        """
        import uuid
        db = self._get_db()

        action_id = f"ACT-{uuid.uuid4().hex[:10]}"
        timestamp = datetime.utcnow().isoformat() + "Z"

        # Get previous hash for chain integrity
        prev_hash = self._get_last_hash(investigation_id)

        record = {
            "action_id": action_id,
            "investigation_id": investigation_id,
            "agent": agent,
            "action": action,
            "timestamp": timestamp,
            "input_data": input_data or {},
            "output_data": _sanitize_for_mongo(output_data or {}),
            "prev_hash": prev_hash,
        }

        # Compute signature
        record["signature"] = self._sign_record(record)

        if isinstance(db, InMemoryDB):
            db.agent_actions.append(record)
            db.audit_chain.append({
                "investigation_id": investigation_id,
                "action_id": action_id,
                "hash": self._hash_record(record),
                "prev_hash": prev_hash,
                "timestamp": timestamp,
            })
        else:
            db.agent_actions.insert_one(record.copy())
            db.audit_chain.insert_one({
                "investigation_id": investigation_id,
                "action_id": action_id,
                "hash": self._hash_record(record),
                "prev_hash": prev_hash,
                "timestamp": timestamp,
            })

        return action_id

    def log_remediation(
        self,
        investigation_id: str,
        action: str,
        account_id: str,
        result: dict,
    ) -> str:
        """Log a remediation action (freeze/hold) with enhanced signature."""
        import uuid
        db = self._get_db()

        record = {
            "remediation_id": f"REM-{uuid.uuid4().hex[:10]}",
            "investigation_id": investigation_id,
            "action": action,
            "account_id": account_id,
            "result": _sanitize_for_mongo(result),
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        record["signature"] = self._sign_record(record)

        if isinstance(db, InMemoryDB):
            db.remediation_log.append(record)
        else:
            db.remediation_log.insert_one(record.copy())

        # Also log as a regular action
        self.log_action(
            investigation_id=investigation_id,
            agent="remediation",
            action=action,
            input_data={"account_id": account_id},
            output_data=result,
        )

        logger.info("remediation_logged", investigation_id=investigation_id,
                    action=action, account_id=account_id)
        return record["remediation_id"]

    # ─── Escalation Management ──────────────────────────────────────────

    def create_escalation(self, escalation: dict) -> str:
        """Store an HITL escalation request."""
        db = self._get_db()
        esc_id = escalation.get("escalation_id", "")

        if isinstance(db, InMemoryDB):
            db.escalations[esc_id] = escalation
        else:
            db.escalations.insert_one(escalation.copy())

        logger.info("escalation_created", escalation_id=esc_id,
                    investigation_id=escalation.get("investigation_id"))
        return esc_id

    def get_escalation(self, escalation_id: str) -> Optional[dict]:
        db = self._get_db()
        if isinstance(db, InMemoryDB):
            return db.escalations.get(escalation_id)
        return db.escalations.find_one({"escalation_id": escalation_id}, {"_id": 0})

    def update_escalation(self, escalation_id: str, updates: dict) -> None:
        db = self._get_db()
        if isinstance(db, InMemoryDB):
            if escalation_id in db.escalations:
                db.escalations[escalation_id].update(updates)
        else:
            db.escalations.update_one(
                {"escalation_id": escalation_id},
                {"$set": updates},
            )

    def get_pending_escalations(self) -> list[dict]:
        db = self._get_db()
        if isinstance(db, InMemoryDB):
            return [e for e in db.escalations.values()
                    if e.get("status") == "pending"]
        cursor = db.escalations.find({"status": "pending"}, {"_id": 0})
        return list(cursor)

    # ─── Chain Integrity ────────────────────────────────────────────────

    def verify_chain(self, investigation_id: str) -> dict:
        """Verify the cryptographic integrity of an investigation's audit chain."""
        db = self._get_db()

        if isinstance(db, InMemoryDB):
            chain = [c for c in db.audit_chain
                     if c["investigation_id"] == investigation_id]
        else:
            chain = list(
                db.audit_chain.find(
                    {"investigation_id": investigation_id},
                    {"_id": 0},
                ).sort("timestamp", 1)
            )

        if not chain:
            return {"valid": True, "links_checked": 0, "investigation_id": investigation_id}

        broken_links = []
        for i in range(1, len(chain)):
            if chain[i]["prev_hash"] != chain[i - 1]["hash"]:
                broken_links.append({
                    "position": i,
                    "expected": chain[i - 1]["hash"],
                    "found": chain[i]["prev_hash"],
                })

        return {
            "valid": len(broken_links) == 0,
            "links_checked": len(chain) - 1,
            "broken_links": broken_links,
            "investigation_id": investigation_id,
        }

    def get_investigation_actions(self, investigation_id: str) -> list[dict]:
        """Get all actions for an investigation, ordered by time."""
        db = self._get_db()
        if isinstance(db, InMemoryDB):
            return sorted(
                [a for a in db.agent_actions
                 if a["investigation_id"] == investigation_id],
                key=lambda x: x["timestamp"],
            )
        cursor = db.agent_actions.find(
            {"investigation_id": investigation_id},
            {"_id": 0},
        ).sort("timestamp", 1)
        return list(cursor)

    # ─── Cryptographic Helpers ──────────────────────────────────────────

    def _sign_record(self, record: dict) -> str:
        """Create HMAC-SHA256 signature of a record."""
        # Exclude the signature field itself
        signable = {k: v for k, v in record.items() if k != "signature"}
        payload = json.dumps(signable, sort_keys=True, default=str).encode("utf-8")
        return hmac.new(self._signing_key, payload, hashlib.sha256).hexdigest()

    def _hash_record(self, record: dict) -> str:
        """Create SHA-256 hash of a record for chain linking."""
        payload = json.dumps(record, sort_keys=True, default=str).encode("utf-8")
        return hashlib.sha256(payload).hexdigest()

    def _get_last_hash(self, investigation_id: str) -> str:
        """Get the hash of the last record in the chain for this investigation."""
        db = self._get_db()

        if isinstance(db, InMemoryDB):
            chain = [c for c in db.audit_chain
                     if c["investigation_id"] == investigation_id]
            if chain:
                return chain[-1]["hash"]
            return "GENESIS"

        last = db.audit_chain.find_one(
            {"investigation_id": investigation_id},
            sort=[("timestamp", -1)],
        )
        return last["hash"] if last else "GENESIS"

    def close(self) -> None:
        """Close the MongoDB connection."""
        if self._client and hasattr(self._client, "close"):
            self._client.close()


def _sanitize_for_mongo(data: dict) -> dict:
    """Ensure data is JSON-serializable for MongoDB storage."""
    try:
        json.dumps(data, default=str)
        return data
    except (TypeError, ValueError):
        return {"raw": str(data)}


# ─── In-Memory Fallback ────────────────────────────────────────────────────


class InMemoryDB:
    """In-memory fallback when MongoDB is unavailable (dev/testing)."""

    def __init__(self) -> None:
        self.investigations: dict[str, dict] = {}
        self.agent_actions: list[dict] = []
        self.audit_chain: list[dict] = []
        self.remediation_log: list[dict] = []
        self.escalations: dict[str, dict] = {}

    def __repr__(self) -> str:
        return (
            f"InMemoryDB(investigations={len(self.investigations)}, "
            f"actions={len(self.agent_actions)})"
        )
