-- ═══════════════════════════════════════════════════════════════════════════
-- FinGuard 2026 — PostgreSQL Schema
-- Core tables for users, decisions, audit, biometric profiles
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    phone_hash VARCHAR(128),
    email_hash VARCHAR(128),
    country_code VARCHAR(3),
    account_type VARCHAR(20) DEFAULT 'standard',
    is_unbanked BOOLEAN DEFAULT FALSE,
    risk_tier VARCHAR(20) DEFAULT 'unknown'
);

CREATE INDEX idx_users_external ON users(external_id);
CREATE INDEX idx_users_risk ON users(risk_tier);

-- ─── Decisions (Audit Trail) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    decision_id VARCHAR(24) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    decision_type VARCHAR(20) NOT NULL,
    model_version VARCHAR(32) DEFAULT 'v1.0.0',
    fraud_score FLOAT,
    credit_score FLOAT,
    risk_level VARCHAR(20),
    reason_codes JSONB,
    shap_values JSONB,
    reason_memo TEXT,
    input_features JSONB,
    latency_ms FLOAT,
    is_shadow BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_decisions_user ON decisions(user_id);
CREATE INDEX idx_decisions_type_date ON decisions(decision_type, created_at DESC);
CREATE INDEX idx_decisions_shadow ON decisions(is_shadow) WHERE is_shadow = TRUE;

-- ─── Biometric Profiles ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biometric_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    keystroke_profile JSONB,
    touch_profile JSONB,
    device_tilt_profile JSONB,
    navigation_profile JSONB,
    num_sessions_trained INT DEFAULT 0,
    confidence_score FLOAT DEFAULT 0.0
);

CREATE INDEX idx_biometric_user ON biometric_profiles(user_id);

-- ─── Audit Logs (Immutable) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    action VARCHAR(50) NOT NULL,
    actor VARCHAR(64) NOT NULL,
    resource_type VARCHAR(30) NOT NULL,
    resource_id VARCHAR(36) NOT NULL,
    details JSONB,
    ip_address VARCHAR(64)
);

CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_action ON audit_logs(action);

-- ─── Model Registry ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name VARCHAR(64) NOT NULL,
    version VARCHAR(32) NOT NULL,
    deployed_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT FALSE,
    is_shadow BOOLEAN DEFAULT FALSE,
    metrics JSONB,
    checkpoint_path VARCHAR(256)
);

CREATE INDEX idx_model_active ON model_registry(model_name) WHERE is_active = TRUE;
