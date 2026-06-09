// ── Quickwit Client ──
// Real HTTP client for Quickwit search/index API.
// Falls back gracefully when Quickwit is not running.

const QUICKWIT_URL = process.env.QUICKWIT_URL || "http://localhost:7280";
const INDEX_NAME = "obs-platform-logs";
const REQUEST_TIMEOUT = 5000; // 5s

export interface QuickwitLog {
  timestamp: string;
  message: string;
  serviceId?: string;
  namespace?: string;
  level?: string;
  [key: string]: unknown;
}

export interface QuickwitSearchResult {
  numHits: number;
  hits: QuickwitLog[];
  elapsedMicros: number;
}

/**
 * Check if Quickwit is reachable
 */
export async function quickwitHealthCheck(): Promise<{
  reachable: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const res = await fetch(`${QUICKWIT_URL}/api/v1/version`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { reachable: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    return { reachable: true, version: data?.version || "unknown" };
  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Index a batch of logs into Quickwit
 */
export async function indexLogs(
  logs: QuickwitLog[]
): Promise<{ indexed: number; errors: string[] }> {
  if (logs.length === 0) return { indexed: 0, errors: [] };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    // Quickwit bulk ingest endpoint (JSON newline-delimited)
    const body = logs.map((log) => JSON.stringify(log)).join("\n");

    const res = await fetch(
      `${QUICKWIT_URL}/api/v1/${INDEX_NAME}/ingest`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      return { indexed: 0, errors: [`HTTP ${res.status}: ${text}`] };
    }

    return { indexed: logs.length, errors: [] };
  } catch (error) {
    return {
      indexed: 0,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

/**
 * Search logs in Quickwit with a query string
 */
export async function searchLogs(
  queryStr: string,
  options: {
    maxHits?: number;
    startTimestamp?: string;
    endTimestamp?: string;
    serviceId?: string;
  } = {}
): Promise<QuickwitSearchResult> {
  const maxHits = options.maxHits || 100;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    // Build Quickwit search query
    const searchBody: Record<string, unknown> = {
      query: queryStr,
      max_hits: maxHits,
    };

    // Add time range filter if specified
    if (options.startTimestamp || options.endTimestamp) {
      const start = options.startTimestamp || "1970-01-01T00:00:00Z";
      const end = options.endTimestamp || new Date().toISOString();
      searchBody.search_after = [start];
      searchBody.search_before = [end];
    }

    // Add service filter
    if (options.serviceId) {
      searchBody.query = `${queryStr} serviceId:${options.serviceId}`;
    }

    const res = await fetch(
      `${QUICKWIT_URL}/api/v1/${INDEX_NAME}/search`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searchBody),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[Quickwit] Search error: HTTP ${res.status}`);
      return { numHits: 0, hits: [], elapsedMicros: 0 };
    }

    const data = await res.json();
    return {
      numHits: data.numHits || 0,
      hits: (data.hits || []).map((h: Record<string, unknown>) => ({
        timestamp: String(h.timestamp || ""),
        message: String(h.message || ""),
        serviceId: String(h.serviceId || ""),
        namespace: String(h.namespace || ""),
        level: String(h.level || "info"),
        ...h,
      })),
      elapsedMicros: data.elapsedMicros || 0,
    };
  } catch (error) {
    console.warn(
      `[Quickwit] Search error: ${
        error instanceof Error ? error.message : "Unknown"
      }`
    );
    return { numHits: 0, hits: [], elapsedMicros: 0 };
  }
}

/**
 * Create the logs index in Quickwit if it doesn't exist
 */
export async function ensureIndex(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    // Check if index exists
    const checkRes = await fetch(
      `${QUICKWIT_URL}/api/v1/indexes/${INDEX_NAME}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (checkRes.ok) return true; // Already exists

    // Create index
    const createController = new AbortController();
    const createTimeout = setTimeout(
      () => createController.abort(),
      REQUEST_TIMEOUT
    );

    const createRes = await fetch(
      `${QUICKWIT_URL}/api/v1/indexes`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "0.8",
          index_id: INDEX_NAME,
          doc_mapping: {
            field_mappings: [
              { name: "timestamp", type: "datetime", input_formats: ["rfc3339"] },
              { name: "message", type: "text", tokenizer: "default" },
              { name: "serviceId", type: "text" },
              { name: "namespace", type: "text" },
              { name: "level", type: "text" },
              { name: "metricName", type: "text" },
              { name: "value", type: "f64" },
              { name: "unit", type: "text" },
              { name: "region", type: "text" },
            ],
          },
          indexing_settings: {
            commit_timeout_secs: 10,
          },
          search_settings: {
            default_search_fields: ["message", "serviceId", "namespace"],
          },
          retention: {
            period: "90 days",
          },
        }),
        signal: createController.signal,
      }
    );
    clearTimeout(createTimeout);

    return createRes.ok;
  } catch (error) {
    console.warn(
      `[Quickwit] Failed to ensure index: ${
        error instanceof Error ? error.message : "Unknown"
      }`
    );
    return false;
  }
}