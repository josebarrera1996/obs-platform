-- ── Model Registry ──
-- Stores model versions, metadata, and performance for ML models
-- used in the platform (anomaly detection, forecasting, correlation).

CREATE TABLE IF NOT EXISTS feature_store.model_registry (
    id              BIGSERIAL PRIMARY KEY,
    model_name      TEXT NOT NULL,
    model_version   TEXT NOT NULL,
    model_type      TEXT NOT NULL CHECK (model_type IN (
                        'anomaly_detection', 'forecasting', 'correlation',
                        'pattern_detection', 'classification', 'embedding'
                    )),
    status          TEXT NOT NULL DEFAULT 'staging' CHECK (status IN (
                        'development', 'staging', 'production', 'archived', 'failed'
                    )),
    -- Model parameters (serialized JSON)
    parameters      JSONB DEFAULT '{}',
    -- Performance metrics
    accuracy        DOUBLE PRECISION,
    precision       DOUBLE PRECISION,
    recall          DOUBLE PRECISION,
    f1_score        DOUBLE PRECISION,
    latency_ms      DOUBLE PRECISION,
    -- Training metadata
    trained_at      TIMESTAMPTZ,
    trained_on      TEXT,                   -- dataset description
    training_duration_sec INTEGER,
    feature_count   INTEGER,
    -- Deployment
    deployed_at     TIMESTAMPTZ,
    deployed_by     TEXT,
    is_active       BOOLEAN DEFAULT FALSE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (model_name, model_version)
);

CREATE INDEX IF NOT EXISTS idx_model_registry_active
    ON feature_store.model_registry (is_active, model_type)
    WHERE is_active = TRUE;

-- Model performance tracking over time
CREATE TABLE IF NOT EXISTS feature_store.model_performance_log (
    id              BIGSERIAL PRIMARY KEY,
    model_id        BIGINT REFERENCES feature_store.model_registry(id) ON DELETE CASCADE,
    evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accuracy        DOUBLE PRECISION,
    precision       DOUBLE PRECISION,
    recall          DOUBLE PRECISION,
    f1_score        DOUBLE PRECISION,
    latency_ms      DOUBLE PRECISION,
    sample_count    INTEGER,
    drift_score     DOUBLE PRECISION,       -- data drift detection (0-1)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_perf_model
    ON feature_store.model_performance_log (model_id, evaluated_at DESC);