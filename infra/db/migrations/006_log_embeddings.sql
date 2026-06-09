-- ── Migration 006: Log Embeddings (pgvector) ──
-- Stores TF-IDF vector embeddings of log messages for semantic clustering.
-- Requires pgvector extension.

-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA feature_store;

-- Schema already exists from 001, but ensure it
CREATE SCHEMA IF NOT EXISTS feature_store;

-- Log embeddings table
-- Each log message gets a vector embedding for similarity search
CREATE TABLE IF NOT EXISTS feature_store.log_embeddings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    message         TEXT NOT NULL,
    service_id      TEXT,
    level           TEXT DEFAULT 'info',
    namespace       TEXT,
    embedding       vector(1024),       -- TF-IDF vector (max vocab size)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cosine similarity search
CREATE INDEX IF NOT EXISTS idx_log_embeddings_vector
    ON feature_store.log_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200);

-- Index for filtering by service
CREATE INDEX IF NOT EXISTS idx_log_embeddings_service
    ON feature_store.log_embeddings (service_id);

-- Index for filtering by level
CREATE INDEX IF NOT EXISTS idx_log_embeddings_level
    ON feature_store.log_embeddings (level);

-- Index for time-range queries
CREATE INDEX IF NOT EXISTS idx_log_embeddings_timestamp
    ON feature_store.log_embeddings (timestamp DESC);

-- ── Log Clusters Table ──
-- Stores the results of log clustering analysis
CREATE TABLE IF NOT EXISTS feature_store.log_clusters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label           TEXT NOT NULL,
    cluster_size    INTEGER NOT NULL,
    service_ids     TEXT[] DEFAULT '{}',
    severity        TEXT DEFAULT 'info',
    sample_messages TEXT[] DEFAULT '{}',
    avg_timestamp   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_clusters_severity
    ON feature_store.log_clusters (severity);

CREATE INDEX IF NOT EXISTS idx_log_clusters_size
    ON feature_store.log_clusters (cluster_size DESC);

-- ── Helper: Find similar logs by cosine distance ──
-- Usage: SELECT * FROM feature_store.find_similar_logs('error connecting to database', 0.7);
CREATE OR REPLACE FUNCTION feature_store.find_similar_logs(
    search_text TEXT,
    min_similarity FLOAT DEFAULT 0.5,
    max_results INT DEFAULT 20
) RETURNS TABLE(
    id UUID,
    message TEXT,
    service_id TEXT,
    level TEXT,
    timestamp TIMESTAMPTZ,
    similarity FLOAT
) LANGUAGE plpgsql AS $$
DECLARE
    search_vector vector(1024);
    search_terms TEXT[];
    term_vectors RECORD;
BEGIN
    -- Build a simple embedding from search text using word frequency
    -- This is a simplified approach; production would use a proper embedding model
    search_terms := regexp_split_to_array(lower(search_text), E'\\W+');

    RETURN QUERY
    SELECT
        le.id,
        le.message,
        le.service_id,
        le.level,
        le.timestamp,
        1 - (le.embedding <=> feature_store.text_to_vector(search_text, 1024)) AS similarity
    FROM feature_store.log_embeddings le
    WHERE le.embedding IS NOT NULL
      AND 1 - (le.embedding <=> feature_store.text_to_vector(search_text, 1024)) >= min_similarity
    ORDER BY le.embedding <=> feature_store.text_to_vector(search_text, 1024)
    LIMIT max_results;
END;
$$;

-- Helper function: convert text to a simple frequency vector
CREATE OR REPLACE FUNCTION feature_store.text_to_vector(
    input_text TEXT,
    dimensions INT DEFAULT 1024
) RETURNS vector
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    words TEXT[];
    vec DOUBLE PRECISION[] := array_fill(0::DOUBLE PRECISION, ARRAY[dimensions]);
    word TEXT;
    hash_val INT;
BEGIN
    words := regexp_split_to_array(lower(input_text), E'\\W+');

    FOREACH word IN ARRAY words
    LOOP
        IF length(word) > 2 THEN
            -- Hash the word to a position in the vector
            hash_val := abs(hashtext(word)) % dimensions;
            vec[hash_val + 1] := vec[hash_val + 1] + 1.0;
        END IF;
    END LOOP;

    -- Normalize
    RETURN vec::vector;
END;
$$;