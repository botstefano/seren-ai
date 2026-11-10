-- =============================================================
-- SEREN AI - Operational schema for churn assessment and recovery
-- Run once in Supabase SQL Editor after the OLTP + DataMart load.
-- This does not alter the validated OLTP or star-schema tables.
-- =============================================================

CREATE SCHEMA IF NOT EXISTS seren_ai;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS seren_ai.agent_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'failed')),
    total_customers INTEGER NOT NULL DEFAULT 0,
    high_risk INTEGER NOT NULL DEFAULT 0,
    medium_risk INTEGER NOT NULL DEFAULT 0,
    low_risk INTEGER NOT NULL DEFAULT 0,
    insufficient_data INTEGER NOT NULL DEFAULT 0,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS seren_ai.churn_assessments (
    assessment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES seren_ai.agent_runs(run_id) ON DELETE CASCADE,
    usuario_key INTEGER NOT NULL
        REFERENCES datamart_origen_spa.dim_usuario_customer(usuario_key),
    days_since_last_purchase INTEGER,
    expected_interval_days NUMERIC(10,2),
    overdue_ratio NUMERIC(10,2),
    risk_level VARCHAR(30) NOT NULL
        CHECK (risk_level IN ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA')),
    risk_score SMALLINT NOT NULL DEFAULT 0
        CHECK (risk_score BETWEEN 0 AND 100),
    explanation TEXT NOT NULL,
    favorite_product_key INTEGER
        REFERENCES datamart_origen_spa.dim_producto(producto_key) ON DELETE SET NULL,
    assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (run_id, usuario_key)
);

CREATE TABLE IF NOT EXISTS seren_ai.reactivation_actions (
    action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL UNIQUE
        REFERENCES seren_ai.churn_assessments(assessment_id) ON DELETE CASCADE,
    usuario_key INTEGER NOT NULL
        REFERENCES datamart_origen_spa.dim_usuario_customer(usuario_key),
    status VARCHAR(20) NOT NULL DEFAULT 'proposed'
        CHECK (status IN ('proposed', 'approved', 'contacted', 'responded', 'reactivated', 'dismissed')),
    favorite_product_key INTEGER
        REFERENCES datamart_origen_spa.dim_producto(producto_key) ON DELETE SET NULL,
    offer_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 10
        CHECK (offer_discount_pct BETWEEN 0 AND 30),
    offer_title VARCHAR(240) NOT NULL,
    personalized_message TEXT NOT NULL,
    approved_at TIMESTAMPTZ,
    contacted_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    reactivated_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_churn_assessments_user_assessed
    ON seren_ai.churn_assessments (usuario_key, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_churn_assessments_risk
    ON seren_ai.churn_assessments (risk_level, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_reactivation_actions_status
    ON seren_ai.reactivation_actions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reactivation_actions_user
    ON seren_ai.reactivation_actions (usuario_key, created_at DESC);

-- Server-side API only. Never grant the service_role key to the browser.
GRANT USAGE ON SCHEMA oltp_origen_spa, datamart_origen_spa, seren_ai TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA oltp_origen_spa TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA datamart_origen_spa TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA seren_ai TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA seren_ai TO service_role;

-- Keep future operational tables available to the backend service role.
ALTER DEFAULT PRIVILEGES IN SCHEMA seren_ai
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA seren_ai
    GRANT USAGE, SELECT ON SEQUENCES TO service_role;

-- These tables are accessed only through the authenticated backend service role.
ALTER TABLE seren_ai.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seren_ai.churn_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE seren_ai.reactivation_actions ENABLE ROW LEVEL SECURITY;
