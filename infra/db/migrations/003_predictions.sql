-- ── Prediction / Forecast Registry ──
-- Stores forecast results from the Prophet-like predictor for
-- accuracy tracking and ensemble model training.

CREATE TABLE IF NOT EXISTS feature_store.predictions (
    id              BIGSERIAL PRIMARY KEY,
    service_id      TEXT NOT NULL,
    metric_name     TEXT NOT NULL,
    namespace       TEXT NOT NULL DEFAULT 'custom',
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    horizon         INTEGER NOT NULL,       -- number of forecast points
    interval_minutes INTEGER NOT NULL DEFAULT 5,  -- spacing between points
    -- The forecast series (stored as JSON array for simplicity)
    forecast_values JSONB NOT NULL,
    upper_bound     JSONB,
    lower_bound     JSONB,
    -- Metadata
    confidence      DOUBLE PRECISION,       -- 0-1
    seasonality_detected INTEGER,          -- detected period
    trend_strength  DOUBLE PRECISION,
    seasonal_strength DOUBLE PRECISION,
    noise_level     DOUBLE PRECISION,
    points_used     INTEGER,
    model_version   TEXT DEFAULT 'prophet-v1',
    actual_outcome  JSONB,                  -- actual values when available (for accuracy tracking)
    prediction_error DOUBLE PRECISION,      -- MAPE when actual_outcome is set
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_service
    ON feature_store.predictions (service_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_metric
    ON feature_store.predictions (metric_name, namespace);
CREATE INDEX IF NOT EXISTS idx_predictions_error
    ON feature_store.predictions (prediction_error) WHERE prediction_error IS NOT NULL;

-- Prediction accuracy tracking
CREATE TABLE IF NOT EXISTS feature_store.prediction_accuracy (
    id              BIGSERIAL PRIMARY KEY,
    prediction_id   BIGINT REFERENCES feature_store.predictions(id) ON DELETE CASCADE,
    service_id      TEXT NOT NULL,
    metric_name     TEXT NOT NULL,
    evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    mape            DOUBLE PRECISION,       -- Mean Absolute Percentage Error
    rmse            DOUBLE PRECISION,       -- Root Mean Square Error
    mae             DOUBLE PRECISION,       -- Mean Absolute Error
    bias            DOUBLE PRECISION,       -- avg over/under prediction
    sample_size     INTEGER NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pred_accuracy_service
    ON feature_store.prediction_accuracy (service_id, evaluated_at DESC);