// ═══════════════════════════════════════════════════════════════════════
// eshodha fintech solution — Phase 10: High-Frequency Transaction Engine
//
// Rust Kafka consumer processing 10K+ TPS with concurrent:
//   1. Neo4j graph upserts (Nodes + Edges via UNWIND batching)
//   2. Redis sliding-window feature hydration
//   3. gRPC calls to Python ML scoring services
//
// Architecture:
//   Kafka ──► Rust Consumer ──┬──► Neo4j (graph mutation)
//                             ├──► Redis (feature hydration)
//                             └──► gRPC ──► Python ML scoring
// ═══════════════════════════════════════════════════════════════════════

use anyhow::Result;
use chrono::Utc;
use dashmap::DashMap;
use rdkafka::config::ClientConfig;
use rdkafka::consumer::{Consumer, StreamConsumer};
use rdkafka::message::Message;
use rdkafka::producer::{FutureProducer, FutureRecord};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Semaphore;
use tracing::{error, info, warn};
use uuid::Uuid;

// ─── Transaction Schema ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub transaction_id: String,
    pub user_id: String,
    pub merchant_id: String,
    pub amount: f64,
    pub currency: String,
    pub category: String,
    pub device_id: Option<String>,
    pub ip_address: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoringResult {
    pub transaction_id: String,
    pub decision: String, // APPROVE, DECLINE, STEP_UP_AUTH
    pub risk_score: f64,
    pub graph_score: Option<f64>,
    pub xgboost_score: Option<f64>,
    pub biometric_score: Option<f64>,
    pub latency_ms: f64,
    pub circuit_breaker_active: bool,
}

// ─── Idempotency Cache ──────────────────────────────────────────────

/// Thread-safe LRU-style cache to deduplicate transactions.
/// If a tx_id was seen in the last 5 minutes, return the cached result.
struct IdempotencyCache {
    cache: DashMap<String, (ScoringResult, i64)>,
    ttl_secs: i64,
}

impl IdempotencyCache {
    fn new(ttl_secs: i64) -> Self {
        Self {
            cache: DashMap::new(),
            ttl_secs,
        }
    }

    fn get(&self, tx_id: &str) -> Option<ScoringResult> {
        if let Some(entry) = self.cache.get(tx_id) {
            let (result, inserted_at) = entry.value();
            if Utc::now().timestamp() - inserted_at < self.ttl_secs {
                return Some(result.clone());
            }
            drop(entry);
            self.cache.remove(tx_id);
        }
        None
    }

    fn insert(&self, tx_id: String, result: ScoringResult) {
        self.cache.insert(tx_id, (result, Utc::now().timestamp()));
    }

    /// Evict expired entries (run periodically)
    fn evict_expired(&self) {
        let now = Utc::now().timestamp();
        self.cache.retain(|_, (_, ts)| now - *ts < self.ttl_secs);
    }
}

// ─── Neo4j Graph Writer ─────────────────────────────────────────────

/// Batch-writes transactions to Neo4j using UNWIND for lock-free perf.
///
/// Creates/updates:
///   - (:User {id}) nodes
///   - (:Merchant {id}) nodes
///   - (:Device {id}) nodes (if present)
///   - [:TRANSACTED_WITH] edges (User→Merchant)
///   - [:USED_DEVICE] edges (User→Device)
///   - [:FROM_IP] edges (Transaction→IP)
struct GraphWriter {
    // In production: neo4rs::Graph connection pool
    batch_size: usize,
    buffer: tokio::sync::Mutex<Vec<Transaction>>,
}

impl GraphWriter {
    fn new(batch_size: usize) -> Self {
        Self {
            batch_size,
            buffer: tokio::sync::Mutex::new(Vec::with_capacity(batch_size)),
        }
    }

    async fn push(&self, tx: Transaction) -> Result<()> {
        let mut buf = self.buffer.lock().await;
        buf.push(tx);
        if buf.len() >= self.batch_size {
            let batch: Vec<Transaction> = buf.drain(..).collect();
            drop(buf);
            self.flush_batch(batch).await?;
        }
        Ok(())
    }

    async fn flush_batch(&self, batch: Vec<Transaction>) -> Result<()> {
        // Cypher UNWIND query — executed as a single transaction for atomicity
        let _cypher = r#"
            UNWIND $txs AS tx
            MERGE (u:User {id: tx.user_id})
            ON CREATE SET u.first_seen = tx.timestamp
            SET u.last_active = tx.timestamp

            MERGE (m:Merchant {id: tx.merchant_id})
            ON CREATE SET m.category = tx.category

            MERGE (u)-[r:TRANSACTED_WITH]->(m)
            ON CREATE SET r.count = 1, r.total_amount = tx.amount,
                          r.first_tx = tx.timestamp
            ON MATCH SET  r.count = r.count + 1,
                          r.total_amount = r.total_amount + tx.amount

            WITH u, tx
            WHERE tx.device_id IS NOT NULL
            MERGE (d:Device {id: tx.device_id})
            MERGE (u)-[:USED_DEVICE]->(d)
        "#;

        info!(
            batch_size = batch.len(),
            "neo4j_batch_flushed"
        );
        // In production: graph.run(query, params).await?;
        Ok(())
    }
}

// ─── Redis Feature Hydrator ─────────────────────────────────────────

/// Updates sliding-window aggregations for real-time feature serving.
///
/// Keys written:
///   user:{id}:amt_1h     — Total amount in last 1 hour
///   user:{id}:amt_24h    — Total amount in last 24 hours
///   user:{id}:tx_count_1h — Transaction count in last 1 hour
///   user:{id}:merchants_1h — Unique merchants in last 1 hour
struct FeatureHydrator {
    // In production: redis::aio::ConnectionManager
}

impl FeatureHydrator {
    fn new() -> Self {
        Self {}
    }

    async fn hydrate(&self, tx: &Transaction) -> Result<()> {
        let _key_prefix = format!("user:{}:", tx.user_id);

        // Redis pipeline (atomic):
        //   ZADD user:{id}:txlog {timestamp} {tx_json}   — sorted set for windowing
        //   ZREMRANGEBYSCORE user:{id}:txlog -inf {1h_ago} — evict old entries
        //   INCRBYFLOAT user:{id}:amt_1h {amount}
        //   INCR user:{id}:tx_count_1h
        //   SADD user:{id}:merchants_1h {merchant_id}
        //   EXPIRE user:{id}:amt_1h 3600

        Ok(())
    }
}

// ─── Dead Letter Queue ──────────────────────────────────────────────

struct DeadLetterQueue {
    // In production: FutureProducer writing to "transactions.dlq" topic
}

impl DeadLetterQueue {
    fn new() -> Self {
        Self {}
    }

    async fn send(&self, tx: &Transaction, error: &str) -> Result<()> {
        warn!(
            tx_id = %tx.transaction_id,
            error = error,
            "dead_letter_enqueued"
        );
        // producer.send(FutureRecord::to("transactions.dlq")...).await
        Ok(())
    }
}

// ─── Core Engine ────────────────────────────────────────────────────

struct CoreEngine {
    graph_writer: Arc<GraphWriter>,
    feature_hydrator: Arc<FeatureHydrator>,
    idempotency: Arc<IdempotencyCache>,
    dlq: Arc<DeadLetterQueue>,
    concurrency: Arc<Semaphore>,
}

impl CoreEngine {
    fn new() -> Self {
        Self {
            graph_writer: Arc::new(GraphWriter::new(100)),
            feature_hydrator: Arc::new(FeatureHydrator::new()),
            idempotency: Arc::new(IdempotencyCache::new(300)), // 5 min TTL
            dlq: Arc::new(DeadLetterQueue::new()),
            concurrency: Arc::new(Semaphore::new(500)), // max 500 concurrent
        }
    }

    async fn process(&self, tx: Transaction) -> Result<ScoringResult> {
        // ── Step 1: Idempotency check ────────────────────────
        if let Some(cached) = self.idempotency.get(&tx.transaction_id) {
            info!(tx_id = %tx.transaction_id, "idempotent_cache_hit");
            return Ok(cached);
        }

        // ── Step 2: Acquire concurrency permit ───────────────
        let _permit = self.concurrency.acquire().await?;
        let start = std::time::Instant::now();

        // ── Step 3: Concurrent graph write + feature hydration
        let gw = self.graph_writer.clone();
        let fh = self.feature_hydrator.clone();
        let tx_g = tx.clone();
        let tx_f = tx.clone();

        let (graph_res, feat_res) = tokio::join!(
            async move { gw.push(tx_g).await },
            async move { fh.hydrate(&tx_f).await },
        );

        if let Err(e) = graph_res {
            error!(tx_id = %tx.transaction_id, err = %e, "graph_write_failed");
        }
        if let Err(e) = feat_res {
            error!(tx_id = %tx.transaction_id, err = %e, "feature_hydration_failed");
        }

        // ── Step 4: ML scoring (placeholder — via gRPC in prod)
        let result = ScoringResult {
            transaction_id: tx.transaction_id.clone(),
            decision: "APPROVE".to_string(),
            risk_score: 0.12,
            graph_score: Some(0.08),
            xgboost_score: Some(0.15),
            biometric_score: Some(0.05),
            latency_ms: start.elapsed().as_secs_f64() * 1000.0,
            circuit_breaker_active: false,
        };

        // ── Step 5: Cache for idempotency ────────────────────
        self.idempotency
            .insert(tx.transaction_id.clone(), result.clone());

        info!(
            tx_id = %tx.transaction_id,
            decision = %result.decision,
            latency_ms = result.latency_ms,
            "transaction_scored"
        );

        Ok(result)
    }
}

// ─── Main ───────────────────────────────────────────────────────────

#[tokio::main]
async fn main() -> Result<()> {
    // Structured JSON logging
    tracing_subscriber::fmt()
        .json()
        .with_env_filter("info")
        .init();

    info!("eshodha_core_engine_starting");

    let engine = Arc::new(CoreEngine::new());

    // Kafka consumer config
    let consumer: StreamConsumer = ClientConfig::new()
        .set("group.id", "eshodha-core-engine")
        .set("bootstrap.servers", "localhost:9092")
        .set("enable.auto.commit", "false")
        .set("auto.offset.reset", "latest")
        .set("fetch.min.bytes", "1024")
        .set("fetch.wait.max.ms", "50")
        .set("max.partition.fetch.bytes", "1048576")
        .create()
        .expect("Kafka consumer creation failed");

    consumer
        .subscribe(&["transactions"])
        .expect("Topic subscription failed");

    info!("kafka_consumer_ready topic=transactions");

    // Background: evict expired idempotency entries every 60s
    let cache = engine.idempotency.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(60)).await;
            cache.evict_expired();
        }
    });

    // Main consumer loop
    use rdkafka::consumer::stream_consumer::StreamConsumer;
    use futures::StreamExt;

    let mut stream = consumer.stream();
    while let Some(msg_result) = stream.next().await {
        match msg_result {
            Ok(msg) => {
                if let Some(payload) = msg.payload() {
                    match serde_json::from_slice::<Transaction>(payload) {
                        Ok(tx) => {
                            let eng = engine.clone();
                            tokio::spawn(async move {
                                if let Err(e) = eng.process(tx).await {
                                    error!(err = %e, "process_failed");
                                }
                            });
                        }
                        Err(e) => {
                            warn!(err = %e, "malformed_transaction");
                        }
                    }
                }
            }
            Err(e) => {
                error!(err = %e, "kafka_recv_error");
            }
        }
    }

    Ok(())
}
