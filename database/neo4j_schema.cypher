// ═══════════════════════════════════════════════════════════════════════════
// FinGuard 2026 — Neo4j Graph Schema (Cypher)
// Heterogeneous graph: Users, Devices, IPs, Merchants
// Edges: TRANSACTED_AT, USED_DEVICE, USED_IP, FLAGGED_AS
// ═══════════════════════════════════════════════════════════════════════════

// ─── Constraints & Indexes ─────────────────────────────────────────────────

CREATE CONSTRAINT user_id_unique IF NOT EXISTS
FOR (u:User) REQUIRE u.userId IS UNIQUE;

CREATE CONSTRAINT device_id_unique IF NOT EXISTS
FOR (d:Device) REQUIRE d.deviceId IS UNIQUE;

CREATE CONSTRAINT ip_id_unique IF NOT EXISTS
FOR (i:IP) REQUIRE i.ipHash IS UNIQUE;

CREATE CONSTRAINT merchant_id_unique IF NOT EXISTS
FOR (m:Merchant) REQUIRE m.merchantId IS UNIQUE;

CREATE INDEX user_risk_idx IF NOT EXISTS FOR (u:User) ON (u.riskScore);
CREATE INDEX device_flagged_idx IF NOT EXISTS FOR (d:Device) ON (d.isFlagged);
CREATE INDEX merchant_category_idx IF NOT EXISTS FOR (m:Merchant) ON (m.category);

// ─── Node Definitions ──────────────────────────────────────────────────────
// User: { userId, riskScore, isMule, createdAt, country }
// Device: { deviceId, fingerprint, isFlagged, userCount }
// IP: { ipHash, isTor, isVPN, geoCountry }
// Merchant: { merchantId, category, riskLevel, avgTxAmount }

// ─── Sample Data Creation ──────────────────────────────────────────────────

// Create sample users
MERGE (u1:User {userId: 'USR-001', riskScore: 0.15, isMule: false, country: 'US'})
MERGE (u2:User {userId: 'USR-002', riskScore: 0.82, isMule: true, country: 'NG'})
MERGE (u3:User {userId: 'USR-003', riskScore: 0.45, isMule: false, country: 'IN'})

// Create devices
MERGE (d1:Device {deviceId: 'DEV-001', isFlagged: false, userCount: 1})
MERGE (d2:Device {deviceId: 'DEV-002', isFlagged: true, userCount: 3})

// Create IPs
MERGE (ip1:IP {ipHash: 'IP-001', isTor: false, isVPN: false, geoCountry: 'US'})
MERGE (ip2:IP {ipHash: 'IP-002', isTor: true, isVPN: false, geoCountry: 'RO'})

// Create merchants
MERGE (m1:Merchant {merchantId: 'MRC-001', category: 'electronics', riskLevel: 'low'})
MERGE (m2:Merchant {merchantId: 'MRC-002', category: 'crypto', riskLevel: 'high'})

// ─── Relationship Definitions ──────────────────────────────────────────────

// Transaction edges
MERGE (u1)-[:TRANSACTED_AT {amount: 150.0, timestamp: datetime(), channel: 'online'}]->(m1)
MERGE (u2)-[:TRANSACTED_AT {amount: 5000.0, timestamp: datetime(), channel: 'online'}]->(m2)

// Device usage
MERGE (u1)-[:USED_DEVICE {firstSeen: datetime()}]->(d1)
MERGE (u2)-[:USED_DEVICE {firstSeen: datetime()}]->(d2)
MERGE (u3)-[:USED_DEVICE {firstSeen: datetime()}]->(d2)  // Shared device!

// IP usage
MERGE (u1)-[:USED_IP]->(ip1)
MERGE (u2)-[:USED_IP]->(ip2)  // Tor user

// ─── Risk Contagion Query (Multi-hop) ──────────────────────────────────────

// Find users within 3 hops of a known mule
// MATCH path = (mule:User {isMule: true})-[*1..3]-(suspect:User {isMule: false})
// RETURN suspect.userId, length(path) AS distance, mule.userId AS connectedMule
// ORDER BY distance ASC

// ─── Cycle Detection (Money Laundering Loops) ──────────────────────────────

// MATCH cycle = (u:User)-[:TRANSACTED_AT*3..8]->(u)
// WHERE ALL(r IN relationships(cycle) WHERE r.amount > 100)
// RETURN nodes(cycle), relationships(cycle)
// LIMIT 100
