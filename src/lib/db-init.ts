// ── Database Initialization ──
// Runs at app startup to ensure PostgreSQL schema is ready.
// Safe to call multiple times — tracks applied migrations.

import { query, healthCheck, runMigrations } from "@/lib/db";

let initialized = false;

/**
 * Initialize the database connection and run pending migrations.
 * Called once at app startup. Safe to call multiple times (idempotent).
 */
export async function initDatabase(): Promise<{
  connected: boolean;
  migrationsApplied: number;
  errors: string[];
}> {
  if (initialized) {
    return { connected: true, migrationsApplied: 0, errors: [] };
  }

  const result = {
    connected: false,
    migrationsApplied: 0,
    errors: [] as string[],
  };

  try {
    const health = await healthCheck();
    result.connected = health.connected;

    if (health.connected) {
      // Run pending migrations
      const migrationResult = await runMigrations();
      result.migrationsApplied = migrationResult.applied;
      result.errors = migrationResult.errors;

      if (migrationResult.errors.length === 0) {
        initialized = true;
        console.log(
          `[DB] Initialized ✓ (${migrationResult.applied} migrations applied, ${health.migrationsApplied} tables)`
        );
      }
    } else {
      console.log("[DB] PostgreSQL not available — feature store disabled");
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(msg);
    console.warn(`[DB] Init failed: ${msg}`);
  }

  return result;
}

/**
 * Check if the database is initialized and connected
 */
export function isDatabaseInitialized(): boolean {
  return initialized;
}