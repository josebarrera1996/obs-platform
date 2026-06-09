// ── Database Client ──
// PostgreSQL connection with pgvector for ML feature store.
// Gracefully falls back when DB is unavailable (local dev without docker).

/* eslint-disable @typescript-eslint/no-explicit-any */
import { promises as fs } from "fs";
import path from "path";

// ---- Types ----

export interface DBConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
}

export interface HealthCheckResult {
  connected: boolean;
  pgvectorAvailable: boolean;
  migrationsApplied: number;
  migrationErrors: string[];
  latencyMs: number;
}

// ---- Default config from env ----

function getConfig(): DBConfig {
  return {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432"),
    database: process.env.POSTGRES_DB || "obs_platform",
    user: process.env.POSTGRES_USER || "obs_user",
    password: process.env.POSTGRES_PASSWORD || "obs_password",
    ssl: process.env.POSTGRES_SSL === "true",
    maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || "10"),
  };
}

// ---- Connection helpers ----

let pgModule: any = null;

/**
 * Lazily load the pg module (only when needed, avoids breaking tests)
 */
async function getPg(): Promise<any> {
  if (!pgModule) {
    try {
      pgModule = await import("pg");
    } catch {
      return null;
    }
  }
  return pgModule;
}

let pool: any = null;

/**
 * Get or create a connection pool
 */
export async function getPool(): Promise<any> {
  if (pool) return pool;

  const pg = await getPg();
  if (!pg) return null;

  const config = getConfig();
  const { Pool } = pg;

  pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: config.maxConnections,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Handle pool errors gracefully
  pool.on("error", (err: Error) => {
    console.error("[DB] Unexpected pool error:", err.message);
  });

  return pool;
}

/**
 * Execute a single query
 */
export async function query(text: string, params?: any[]): Promise<any[]> {
  const p = await getPool();
  if (!p) {
    // DB not available — return empty results gracefully
    console.debug("[DB] PostgreSQL not available, skipping query");
    return [];
  }

  try {
    const result = await p.query(text, params);
    return result.rows || [];
  } catch (error) {
    console.error("[DB] Query error:", error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Execute a single-row query (returns first row or null)
 */
export async function queryOne(text: string, params?: any[]): Promise<any | null> {
  const rows = await query(text, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Check if PostgreSQL is available
 */
export async function healthCheck(): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    const result = await queryOne("SELECT 1 as ok");
    const connected = result?.ok === 1;

    // Check pgvector
    let pgvectorAvailable = false;
    try {
      const vecResult = await queryOne("SELECT extname FROM pg_extension WHERE extname = 'vector'");
      pgvectorAvailable = !!vecResult;
    } catch {
      // extension not installed
    }

    // Check migrations applied
    let migrationsApplied = 0;
    const migrationErrors: string[] = [];
    try {
      const tables = await query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'feature_store'
      `);
      migrationsApplied = tables.length;
    } catch {
      migrationErrors.push("feature_store schema not found");
    }

    return {
      connected,
      pgvectorAvailable,
      migrationsApplied,
      migrationErrors,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      connected: false,
      pgvectorAvailable: false,
      migrationsApplied: 0,
      migrationErrors: [error instanceof Error ? error.message : "Connection failed"],
      latencyMs: Date.now() - start,
    };
  }
}

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<{ applied: number; errors: string[] }> {
  const migrationsDir = path.join(process.cwd(), "infra", "db", "migrations");
  const applied: number[] = [];
  const errors: string[] = [];

  try {
    // Create schema if not exists
    await query("CREATE SCHEMA IF NOT EXISTS feature_store");

    // Create migrations tracking table
    await query(`
      CREATE TABLE IF NOT EXISTS feature_store._migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        checksum TEXT
      )
    `);

    // Get already applied migrations
    const appliedRows = await query("SELECT filename FROM feature_store._migrations ORDER BY id");
    const appliedSet = new Set(appliedRows.map((r: any) => r.filename));

    // Get migration files sorted
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of sqlFiles) {
      if (appliedSet.has(file)) continue;

      try {
        const content = await fs.readFile(path.join(migrationsDir, file), "utf-8");
        // Split by semicolons and execute each statement
        const statements = content
          .split(";")
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith("--"));

        for (const statement of statements) {
          await query(statement);
        }

        // Record migration
        await query(
          "INSERT INTO feature_store._migrations (filename) VALUES ($1)",
          [file]
        );

        applied.push(sqlFiles.indexOf(file) + 1);
        console.log(`[DB] Migration applied: ${file}`);
      } catch (err) {
        const msg = `Migration ${file} failed: ${err instanceof Error ? err.message : "Unknown error"}`;
        errors.push(msg);
        console.error(`[DB] ${msg}`);
      }
    }
  } catch (err) {
    errors.push(`Migration runner error: ${err instanceof Error ? err.message : "Unknown"}`);
  }

  return { applied: applied.length, errors };
}

/**
 * Close the connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
      pool = null;
    } catch {
      // ignore
    }
  }
}

/**
 * Insert a metric into the feature store
 */
export async function insertMetric(params: {
  timestamp: string;
  metricName: string;
  namespace: string;
  serviceId?: string;
  accountId?: string;
  region: string;
  value: number;
  unit: string;
  dimensions?: Record<string, string>;
}): Promise<boolean> {
  try {
    await query(
      `INSERT INTO feature_store.metrics
       (timestamp, metric_name, namespace, service_id, account_id, region, value, unit, dimensions,
        hour_of_day, day_of_week)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
        EXTRACT(HOUR FROM $1::timestamp), EXTRACT(DOW FROM $1::timestamp))`,
      [
        params.timestamp,
        params.metricName,
        params.namespace,
        params.serviceId || null,
        params.accountId || null,
        params.region,
        params.value,
        params.unit,
        params.dimensions ? JSON.stringify(params.dimensions) : "{}",
      ]
    );
    return true;
  } catch (error) {
    console.error(`[DB] insertMetric error: ${error instanceof Error ? error.message : "Unknown"}`);
    return false;
  }
}

/**
 * Bulk insert metrics (batch)
 */
export async function insertMetricsBatch(
  metrics: Array<{
    timestamp: string;
    metricName: string;
    namespace: string;
    serviceId?: string;
    accountId?: string;
    region: string;
    value: number;
    unit: string;
    dimensions?: Record<string, string>;
  }>
): Promise<number> {
  let inserted = 0;
  for (const m of metrics) {
    const ok = await insertMetric(m);
    if (ok) inserted++;
  }
  return inserted;
}

/**
 * Insert an anomaly result
 */
export async function insertAnomaly(params: {
  serviceId: string;
  metricName: string;
  namespace: string;
  severity: string;
  zScore: number;
  currentValue: number;
  baselineMean: number;
  baselineStd: number;
  description?: string;
}): Promise<boolean> {
  try {
    await query(
      `INSERT INTO feature_store.anomaly_results
       (service_id, metric_name, namespace, severity, z_score, current_value, baseline_mean, baseline_std, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        params.serviceId,
        params.metricName,
        params.namespace,
        params.severity,
        params.zScore,
        params.currentValue,
        params.baselineMean,
        params.baselineStd,
        params.description || null,
      ]
    );
    return true;
  } catch (error) {
    console.error(`[DB] insertAnomaly error: ${error instanceof Error ? error.message : "Unknown"}`);
    return false;
  }
}

/**
 * Get recent anomalies for a service
 */
export async function getRecentAnomalies(
  serviceId: string,
  limit: number = 20
): Promise<any[]> {
  return query(
    `SELECT * FROM feature_store.anomaly_results
     WHERE service_id = $1
     ORDER BY detected_at DESC
     LIMIT $2`,
    [serviceId, limit]
  );
}