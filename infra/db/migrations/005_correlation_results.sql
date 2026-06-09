-- ── Correlation Analysis Results ──
-- Stores cross-service correlation analyses for dependency mapping
-- and cascading failure detection.

CREATE TABLE IF NOT EXISTS feature_store.correlation_results (
    id              BIGSERIAL PRIMARY KEY,
    service_a       TEXT NOT NULL,
    service_b       TEXT NOT NULL,
    correlation     DOUBLE PRECISION NOT NULL,  -- -1 to 1
    relationship    TEXT NOT NULL CHECK (relationship IN (
                        'strong_positive', 'moderate_positive', 'weak',
                        'moderate_negative', 'strong_negative'
                    )),
    lag             INTEGER,                    -- optimal lag in data points
    p_value         DOUBLE PRECISION,           -- significance
    metric_a        TEXT NOT NULL,
    metric_b        TEXT NOT NULL,
    namespace       TEXT NOT NULL DEFAULT 'custom',
    analyzed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_points     INTEGER,
    is_causal       BOOLEAN,                    -- flagged as potential causal relationship
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (service_a, service_b, metric_a, metric_b, analyzed_at)
);

CREATE INDEX IF NOT EXISTS idx_correlation_services
    ON feature_store.correlation_results (service_a, service_b);
CREATE INDEX IF NOT EXISTS idx_correlation_strength
    ON feature_store.correlation_results (correlation DESC)
    WHERE correlation > 0.7 OR correlation < -0.7;
CREATE INDEX IF NOT EXISTS idx_correlation_causal
    ON feature_store.correlation_results (is_causal, analyzed_at DESC)
    WHERE is_causal = TRUE;

-- Service dependency graph (derived from correlations)
CREATE TABLE IF NOT EXISTS feature_store.service_dependencies (
    id              BIGSERIAL PRIMARY KEY,
    source_service  TEXT NOT NULL,
    target_service  TEXT NOT NULL,
    dependency_type TEXT NOT NULL CHECK (dependency_type IN (
                        'hard', 'soft', 'potential', 'unknown'
                    )),
    confidence      DOUBLE PRECISION,       -- 0-1
    avg_latency_ms  DOUBLE PRECISION,
    error_propagation_rate DOUBLE PRECISION, -- % of errors that propagate
    discovered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_verified   TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT TRUE,
    UNIQUE (source_service, target_service)
);

CREATE INDEX IF NOT EXISTS idx_dependencies_source
    ON feature_store.service_dependencies (source_service);
CREATE INDEX IF NOT EXISTS idx_dependencies_target
    ON feature_store.service_dependencies (target_service);