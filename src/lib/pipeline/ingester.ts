// ── Pipeline Ingester ──
// Handles ingestion of metric/log data into Quickwit-compatible storage.
// Tries Quickwit HTTP API first, falls back to local JSONL files.
// Optionally persists to PostgreSQL (ML feature store) when available.

import { promises as fs } from "fs";
import path from "path";
import type { PipelineMetric } from "./collector";
import { healthCheck, insertMetricsBatch } from "@/lib/db";
import { quickwitHealthCheck, indexLogs, ensureIndex } from "./quickwit";

const DATA_DIR = path.join(process.cwd(), ".data", "pipeline");
const BATCH_SIZE = 100;

export interface IngestResult {
  ingested: number;
  failed: number;
  storageType: "json" | "nats" | "quickwit" | "postgresql";
  dbMetrics?: number; // metrics persisted to PostgreSQL
}

/**
 * Ensure data directory exists
 */
async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // ignore if exists
  }
}

/**
 * Ingest metrics — tries Quickwit first, falls back to JSONL files.
 * Also persists to PostgreSQL (ML feature store) when available.
 */
export async function ingestMetrics(
  metrics: PipelineMetric[]
): Promise<IngestResult> {
  if (metrics.length === 0) {
    return { ingested: 0, failed: 0, storageType: "json" };
  }

  // Try Quickwit first
  const qwHealth = await quickwitHealthCheck();
  if (qwHealth.reachable) {
    await ensureIndex();

    const logs = metrics.map((m) => ({
      timestamp: m.timestamp,
      message: JSON.stringify(m),
      serviceId: m.serviceId || "unknown",
      namespace: m.namespace,
      level: "info",
      metricName: m.metricName,
      value: m.value,
      unit: m.unit,
      region: m.region,
    }));

    const result = await indexLogs(logs);
    if (result.indexed > 0) {
      // Also persist to PostgreSQL
      let dbMetrics = 0;
      try {
        const dbHealth = await healthCheck();
        if (dbHealth.connected) {
          dbMetrics = await insertMetricsBatch(
            metrics.map((m) => ({
              timestamp: m.timestamp,
              metricName: m.metricName,
              namespace: m.namespace,
              serviceId: m.serviceId,
              accountId: m.accountId,
              region: m.region,
              value: m.value,
              unit: m.unit,
              dimensions: m.dimensions,
            }))
          );
        }
      } catch {
        // PG not available, skip
      }

      return {
        ingested: result.indexed,
        failed: result.errors.length,
        storageType: "quickwit",
        dbMetrics,
      };
    }
  }

  // Fallback: write to JSONL files
  await ensureDir();

  // Group by namespace and date
  const groups = new Map<string, PipelineMetric[]>();

  for (const metric of metrics) {
    const date = metric.timestamp.substring(0, 10); // YYYY-MM-DD
    const key = `${metric.namespace}/${date}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(metric);
  }

  let ingested = 0;
  let failed = 0;

  for (const [key, batch] of groups) {
    const filePath = path.join(DATA_DIR, `${key}.jsonl`);

    try {
      const lines = batch.map((m) => JSON.stringify(m)).join("\n");
      await fs.appendFile(filePath, lines + "\n", "utf-8");
      ingested += batch.length;
    } catch (error) {
      console.error(`[Pipeline] Failed to write ${filePath}:`, error);
      failed += batch.length;
    }
  }

  // Also persist to PostgreSQL (ML feature store) if available
  let dbMetrics = 0;
  try {
    const dbHealth = await healthCheck();
    if (dbHealth.connected) {
      const pgMetrics = metrics.map((m) => ({
        timestamp: m.timestamp,
        metricName: m.metricName,
        namespace: m.namespace,
        serviceId: m.serviceId,
        accountId: m.accountId,
        region: m.region,
        value: m.value,
        unit: m.unit,
        dimensions: m.dimensions,
      }));
      dbMetrics = await insertMetricsBatch(pgMetrics);
    }
  } catch (error) {
    console.debug("[Pipeline] PostgreSQL not available, skipping feature store:", error instanceof Error ? error.message : error);
  }

  const storageType = dbMetrics > 0 ? "postgresql" : "json";

  return {
    ingested,
    failed,
    storageType,
    dbMetrics,
  };
}

/**
 * Query ingested metrics from local storage
 */
export async function queryMetrics(
  filters: {
    namespace?: string;
    metricName?: string;
    startDate?: string;
    endDate?: string;
    serviceId?: string;
    limit?: number;
  }
): Promise<PipelineMetric[]> {
  await ensureDir();

  const results: PipelineMetric[] = [];
  const limit = filters.limit || 1000;

  try {
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile() && e.name.endsWith(".jsonl"));

    for (const file of files) {
      if (results.length >= limit) break;

      // Filter by namespace in filename
      if (filters.namespace && !file.name.startsWith(filters.namespace)) continue;

      // Filter by date range in filename
      const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const fileDate = dateMatch[1];
        if (filters.startDate && fileDate < filters.startDate) continue;
        if (filters.endDate && fileDate > filters.endDate) continue;
      }

      const content = await fs.readFile(path.join(DATA_DIR, file.name), "utf-8");
      const lines = content.trim().split("\n");

      for (const line of lines) {
        if (results.length >= limit) break;
        if (!line.trim()) continue;

        try {
          const metric = JSON.parse(line) as PipelineMetric;

          if (filters.metricName && metric.metricName !== filters.metricName) continue;
          if (filters.serviceId && metric.serviceId !== filters.serviceId) continue;

          results.push(metric);
        } catch {
          // skip malformed lines
        }
      }
    }
  } catch (error) {
    console.error("[Pipeline] Error querying metrics:", error);
  }

  return results;
}

/**
 * Get storage statistics
 */
export async function getPipelineStats(): Promise<{
  totalMetrics: number;
  namespaces: string[];
  dateRange: { earliest: string; latest: string };
  storageSizeBytes: number;
}> {
  await ensureDir();

  let totalMetrics = 0;
  const namespaces = new Set<string>();
  let earliest = "";
  let latest = "";
  let totalSize = 0;

  try {
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile() && e.name.endsWith(".jsonl"));

    for (const file of files) {
      const ns = file.name.split("/")[0];
      namespaces.add(ns);

      const stat = await fs.stat(path.join(DATA_DIR, file.name));
      totalSize += stat.size;

      const content = await fs.readFile(path.join(DATA_DIR, file.name), "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      totalMetrics += lines.length;

      // Extract date from filename
      const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const d = dateMatch[1];
        if (!earliest || d < earliest) earliest = d;
        if (!latest || d > latest) latest = d;
      }
    }
  } catch {
    // ignore
  }

  return {
    totalMetrics,
    namespaces: Array.from(namespaces),
    dateRange: { earliest, latest },
    storageSizeBytes: totalSize,
  };
}

/**
 * Clean up old data (older than retentionDays)
 */
export async function cleanupOldData(retentionDays: number = 90): Promise<number> {
  await ensureDir();
  let deleted = 0;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  try {
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile() && e.name.endsWith(".jsonl"));

    for (const file of files) {
      const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const fileDate = new Date(dateMatch[1]);
        if (fileDate < cutoff) {
          await fs.unlink(path.join(DATA_DIR, file.name));
          deleted++;
        }
      }
    }
  } catch {
    // ignore
  }

  return deleted;
}