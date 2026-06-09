-- ── Feature Store: Time-Series Metrics ──
-- Stores raw and aggregated metrics for ML training and inference.
-- Partitioned by month for efficient time-range queries.

-- Enable pgvector for similarity search (future: log clustering, anomaly vector search)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS feature_store;
CREATE SCHEMA IF NOT EXISTS anomaly;
CREATE SCHEMA IF NOT EXISTS predictions;
CREATE SCHEMA IF NOT EXISTS models;
CREATE SCHEMA IF NOT EXISTS correlations;

-- Metric features — the core fact table for ML
CREATE TABLE IF NOT EXISTS feature_store.metrics (
    id              BIGSERIAL,
    timestamp       TIMESTAMPTZ NOT NULL,
    metric_name     TEXT NOT NULL,
    namespace       TEXT NOT NULL DEFAULT 'custom',
    service_id      TEXT,
    account_id      TEXT,
    region          TEXT NOT NULL DEFAULT 'us-east-1',
    value           DOUBLE PRECISION NOT NULL,
    unit            TEXT NOT NULL DEFAULT 'Count',
    dimensions      JSONB DEFAULT '{}',
    -- Derived features (computed at ingest time for ML)
    z_score         DOUBLE PRECISION,       -- anomaly score
    rolling_avg_5   DOUBLE PRECISION,       -- 5-point rolling avg
    rolling_avg_20  DOUBLE PRECISION,       -- 20-point rolling avg
    rate_of_change  DOUBLE PRECISION,       -- delta from previous point
    hour_of_day     SMALLINT,               -- extracted for seasonality
    day_of_week     SMALLINT,               -- extracted for seasonality
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (timestamp, id)
) PARTITION BY RANGE (timestamp);

-- Monthly partitions (created automatically by the app or manually)
CREATE TABLE IF NOT EXISTS feature_store.metrics_default
    PARTITION OF feature_store.metrics
    FOR VALUES FROM ('2020-01-01') TO ('2030-12-31');

-- Index for metric lookups by name + time range
CREATE INDEX IF NOT EXISTS idx_metrics_name_time
    ON feature_store.metrics (metric_name, timestamp DESC);

-- Index for service-level rollups
CREATE INDEX IF NOT EXISTS idx_metrics_service
    ON feature_store.metrics (service_id, timestamp DESC);

-- Index for namespace-level rollups
CREATE INDEX IF NOT EXISTS idx_metrics_namespace_time
    ON feature_store.metrics (namespace, timestamp DESC);

-- Index for anomaly queries
CREATE INDEX IF NOT EXISTS idx_metrics_zscore
    ON feature_store.metrics (z_score DESC NULLS LAST)
    WHERE z_score IS NOT NULL;

-- Index for account-level queries
CREATE INDEX IF NOT EXISTS idx_metrics_account
    ON feature_store.metrics (account_id, timestamp DESC)
    WHERE account_id IS NOT NULL;

-- ── Metric Aggregates (pre-computed rollups) ──
CREATE TABLE IF NOT EXISTS feature_store.metric_aggregates (
    id              BIGSERIAL PRIMARY KEY,
    metric_name     TEXT NOT NULL,
    namespace       TEXT NOT NULL DEFAULT 'custom',
    bucket          TIMESTAMPTZ NOT NULL,       -- start of aggregation window
    window_size     INTERVAL NOT NULL DEFAULT '5 minutes',
    count           INTEGER NOT NULL DEFAULT 0,
    min_val         DOUBLE PRECISION,
    max_val         DOUBLE PRECISION,
    avg_val         DOUBLE PRECISION,
    p50_val         DOUBLE PRECISION,
    p95_val         DOUBLE PRECISION,
    p99_val         DOUBLE PRECISION,
    stddev_val      DOUBLE PRECISION,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (metric_name, namespace, bucket, window_size)
);

CREATE INDEX IF NOT EXISTS idx_aggregates_bucket
    ON feature_store.metric_aggregates (bucket DESC);