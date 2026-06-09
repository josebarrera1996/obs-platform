-- ── Anomaly Detection Results ──
-- Stores anomaly findings from the ML engine for historical analysis
-- and trend tracking of anomaly patterns.

CREATE TABLE IF NOT EXISTS feature_store.anomaly_results (
    id              BIGSERIAL PRIMARY KEY,
    service_id      TEXT NOT NULL,
    metric_name     TEXT NOT NULL,
    namespace       TEXT NOT NULL DEFAULT 'custom',
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    severity        TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    z_score         DOUBLE PRECISION NOT NULL,
    current_value   DOUBLE PRECISION NOT NULL,
    baseline_mean   DOUBLE PRECISION NOT NULL,
    baseline_std    DOUBLE PRECISION NOT NULL,
    is_resolved     BOOLEAN DEFAULT FALSE,
    resolved_at     TIMESTAMPTZ,
    description     TEXT,
    -- Embedding vector for similarity search (future: group similar anomalies)
    embedding       vector(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomalies_service
    ON feature_store.anomaly_results (service_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity
    ON feature_store.anomaly_results (severity, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_resolved
    ON feature_store.anomaly_results (is_resolved, detected_at DESC);

-- Anomaly patterns (recurring anomaly types per service)
CREATE TABLE IF NOT EXISTS feature_store.anomaly_patterns (
    id              BIGSERIAL PRIMARY KEY,
    service_id      TEXT NOT NULL,
    metric_name     TEXT NOT NULL,
    pattern_type    TEXT NOT NULL CHECK (pattern_type IN (
                        'spike', 'dip', 'plateau',
                        'gradual_increase', 'gradual_decrease',
                        'recurring', 'outlier'
                    )),
    frequency       INTERVAL,              -- how often it recurs
    last_occurrence TIMESTAMPTZ,
    avg_severity    TEXT NOT NULL DEFAULT 'medium',
    occurrences     INTEGER NOT NULL DEFAULT 1,
    confidence      DOUBLE PRECISION,      -- 0-1 pattern confidence
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (service_id, metric_name, pattern_type)
);