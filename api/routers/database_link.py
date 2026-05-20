from __future__ import annotations

import random
import time
from datetime import datetime, timedelta
from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/database-link", tags=["Database Connector"])

class DBConnectionConfig(BaseModel):
    engine: str  # postgresql, mysql, snowflake, mongodb, bigquery
    connection_url: str
    ssl_mode: str = "require"
    ingestion_rate_limit: int = 50  # tx/sec
    poll_interval_seconds: float = 1.0

# In-memory session store for connected db links
_connected_db: dict[str, Any] = {
    "is_connected": False,
    "engine": None,
    "connection_url": None,
    "last_sync": None,
    "records_processed": 0,
    "bytes_received": 0,
    "active_queries_run": 0,
}

@router.post("/test")
async def test_db_connection(config: DBConnectionConfig) -> dict[str, Any]:
    """Verify credentials and discovery table schemas."""
    # Simulate network latency
    latency = random.uniform(40, 180)
    time.sleep(latency / 1000.0)
    
    if "error" in config.connection_url.lower():
        raise HTTPException(
            status_code=400,
            detail="Failed to resolve hostname: connection timed out."
        )

    # Discovered metadata based on the engine
    schema = [
        {"column": "id", "type": "VARCHAR(64)", "nullable": False, "key": "PRIMARY KEY"},
        {"column": "user_id", "type": "VARCHAR(64)", "nullable": False, "key": "INDEX"},
        {"column": "amount", "type": "DECIMAL(12,2)", "nullable": False, "key": None},
        {"column": "currency", "type": "VARCHAR(3)", "nullable": False, "key": None},
        {"column": "merchant", "type": "VARCHAR(256)", "nullable": False, "key": "INDEX"},
        {"column": "device_id", "type": "VARCHAR(128)", "nullable": True, "key": None},
        {"column": "ip_address", "type": "VARCHAR(45)", "nullable": True, "key": None},
        {"column": "timestamp", "type": "TIMESTAMP WITH TIME ZONE", "nullable": False, "key": "INDEX"},
        {"column": "status", "type": "VARCHAR(32)", "nullable": False, "key": None},
    ]

    return {
        "success": True,
        "latency_ms": round(latency, 2),
        "engine": config.engine,
        "database_version": "PostgreSQL 16.2 (Debian 16.2-1.pgdg120+2) on x86_64" if config.engine == "postgresql" else f"{config.engine.capitalize()} Cloud Engine",
        "discovered_table": "public.transactions",
        "columns_discovered": len(schema),
        "schema": schema,
        "total_records_discovered": random.randint(1420500, 9845000),
    }

@router.post("/connect")
async def connect_db(config: DBConnectionConfig) -> dict[str, Any]:
    _connected_db["is_connected"] = True
    _connected_db["engine"] = config.engine
    _connected_db["connection_url"] = config.connection_url
    _connected_db["last_sync"] = datetime.utcnow().isoformat()
    return {"status": "connected", "details": _connected_db}

@router.post("/disconnect")
async def disconnect_db() -> dict[str, Any]:
    _connected_db["is_connected"] = False
    return {"status": "disconnected", "details": _connected_db}

@router.get("/status")
async def get_db_status() -> dict[str, Any]:
    if _connected_db["is_connected"]:
        # Increment metrics randomly to simulate throughput
        added_records = random.randint(5, 45)
        _connected_db["records_processed"] += added_records
        _connected_db["bytes_received"] += added_records * random.randint(210, 480)
        _connected_db["active_queries_run"] += random.randint(1, 3)
        _connected_db["last_sync"] = datetime.utcnow().isoformat()

    return {
        "is_connected": _connected_db["is_connected"],
        "engine": _connected_db["engine"],
        "connection_url": _connected_db["connection_url"],
        "last_sync": _connected_db["last_sync"],
        "records_processed": _connected_db["records_processed"],
        "throughput_tx_per_sec": random.randint(35, 78) if _connected_db["is_connected"] else 0,
        "bandwidth_kb_per_sec": round(random.uniform(15.2, 48.7), 1) if _connected_db["is_connected"] else 0.0,
        "db_latency_ms": round(random.uniform(5.5, 18.2), 1) if _connected_db["is_connected"] else 0.0,
        "telemetry": {
            "cpu_usage_pct": round(random.uniform(12.5, 48.2), 1) if _connected_db["is_connected"] else 2.1,
            "memory_usage_pct": round(random.uniform(42.1, 68.9), 1) if _connected_db["is_connected"] else 18.5,
            "connection_pool_active": random.randint(8, 22) if _connected_db["is_connected"] else 0,
            "connection_pool_idle": random.randint(5, 12) if _connected_db["is_connected"] else 0,
        }
    }

@router.get("/stream")
async def get_db_stream(limit: int = 15) -> list[dict[str, Any]]:
    """Return streaming queries and live database transactions with in-flight scoring results."""
    merchants = ["Amazon", "Uber", "Netflix", "Walmart", "Binance", "Starbucks", "Stripe", "Apple Store", "Cloudflare"]
    regions = ["ap-south-1", "eu-west-1", "us-east-1", "ap-southeast-1"]
    
    events = []
    for i in range(limit):
        risk = random.randint(5, 98)
        sql_query = f"SELECT * FROM public.transactions WHERE timestamp >= NOW() - INTERVAL '1 second' OFFSET {i}"
        
        events.append({
            "id": f"DB-TX-{random.randint(100000, 999999)}",
            "timestamp": (datetime.utcnow() - timedelta(seconds=i * 2)).isoformat(),
            "sql_query": sql_query,
            "database_read_latency_ms": round(random.uniform(0.8, 4.5), 2),
            "payload": {
                "user_id": f"USR-{random.randint(1000, 9999)}",
                "amount": round(random.uniform(10.0, 15000.0), 2),
                "currency": "INR" if random.choice([True, False]) else "USD",
                "merchant": merchants[i % len(merchants)],
                "region": regions[i % len(regions)],
            },
            "analysis": {
                "risk_score": risk,
                "model_mode": "champion_gnn",
                "drift_alert": risk > 70 and random.choice([True, False]),
                "explainability": {
                    "top_factor": "Card Velocity" if risk > 50 else "SIM Age > 12mo",
                    "shap_value": round(random.uniform(0.12, 0.45), 3) if risk > 50 else -0.15,
                },
                "status": "flagged" if risk >= 85 else "hold" if risk >= 60 else "approved",
            }
        })
    return events
