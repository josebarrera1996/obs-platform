// ── API: Log Clustering ──
// Clusters log messages by semantic similarity using TF-IDF + cosine distance.
// Returns groups of similar logs for anomaly investigation.

import { NextRequest, NextResponse } from "next/server";
import { clusterLogs } from "@/lib/ml/log-clustering";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const threshold = Math.min(
    Math.max(Number(searchParams.get("threshold")) || 0.4, 0),
    1
  );
  const sampleSize = Math.min(Number(searchParams.get("sampleSize")) || 500, 2000);
  const serviceFilter = searchParams.get("serviceId") || null;
  const levelFilter = searchParams.get("level") || null;

  try {
    // Try to fetch logs from Quickwit first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let logs: any[] = [];
    let source = "none";

    const qwRes = await fetch(
      `${request.nextUrl.origin}/api/pipeline/logs?query=*&maxHits=${sampleSize}`
    );

    if (qwRes.ok) {
      const qwData = await qwRes.json();
      if (qwData.logs && qwData.logs.length > 0) {
        logs = qwData.logs;
        source = "quickwit";
      }
    }

    // Fallback: generate synthetic log samples for demo
    if (logs.length === 0) {
      logs = generateSampleLogs(sampleSize);
      source = "synthetic (no Quickwit connected)";
    }

    // Apply filters
    if (serviceFilter) {
      logs = logs.filter((l) => l.serviceId === serviceFilter);
    }
    if (levelFilter) {
      logs = logs.filter((l) => l.level === levelFilter);
    }

    if (logs.length === 0) {
      return NextResponse.json({
        source,
        totalLogs: 0,
        clusters: [],
        threshold,
        message: "No logs to cluster",
      });
    }

    // Run clustering
    const clusters = clusterLogs(logs, threshold);

    return NextResponse.json({
      source,
      totalLogs: logs.length,
      clusters,
      clusterCount: clusters.length,
      threshold,
      stats: {
        largestCluster: clusters[0]?.size || 0,
        smallestCluster: clusters[clusters.length - 1]?.size || 0,
        avgClusterSize:
          clusters.length > 0
            ? Math.round(
                clusters.reduce((s, c) => s + c.size, 0) / clusters.length
              )
            : 0,
        servicesInvolved: [
          ...new Set(clusters.flatMap((c) => c.serviceIds)),
        ].length,
      },
    });
  } catch (error) {
    console.error("[API] Log clustering error:", error);
    return NextResponse.json(
      {
        source: "error",
        totalLogs: 0,
        clusters: [],
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Generate sample log messages for demo/testing purposes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateSampleLogs(count: number): any[] {
  const services = [
    "api-gateway",
    "auth-service",
    "user-service",
    "payment-service",
    "notification-service",
    "cache-cluster",
  ];
  const levels = ["info", "info", "info", "warn", "error", "critical"];
  const messageTemplates = [
    "Request processed successfully in {0}ms",
    "Connection pool exhausted for {0}, retrying after {1}ms",
    "Failed to authenticate user {0}: invalid token",
    "Payment processing timeout for order {0}",
    "Cache miss for key {0}, fetching from origin",
    "Database query took {0}ms (threshold: 100ms)",
    "Error connecting to upstream service {0}: connection refused",
    "Rate limit exceeded for API key {0}",
    "Health check passed for service {0}",
    "Deploying new version {0} to {1}",
    "Memory usage at {0}% for service {1}",
    "SSL certificate expiring in {0} days for domain {1}",
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs: any[] = [];
  const now = Date.now();

  // Generate clustered patterns intentionally
  const patterns = [
    // Cluster 1: auth failures (lots of them)
    ...Array(30).fill(null).map((_, i) => ({
      timestamp: new Date(now - i * 1000 * 60).toISOString(),
      message: `Failed to authenticate user user_${Math.floor(i / 3)}: invalid token`,
      serviceId: "auth-service",
      level: "error",
      namespace: "AWS/ECS",
    })),
    // Cluster 2: connection timeouts
    ...Array(20).fill(null).map((_, i) => ({
      timestamp: new Date(now - i * 2000 * 60).toISOString(),
      message: `Connection pool exhausted for auth-service, retrying after ${i * 10}ms`,
      serviceId: "api-gateway",
      level: "warn",
      namespace: "AWS/ECS",
    })),
    // Cluster 3: cache misses
    ...Array(15).fill(null).map((_, i) => ({
      timestamp: new Date(now - i * 3000 * 60).toISOString(),
      message: `Cache miss for key session_${Math.floor(i / 2)}, fetching from origin`,
      serviceId: "cache-cluster",
      level: "info",
      namespace: "AWS/ElastiCache",
    })),
    // Random logs
    ...Array(count - 65).fill(null).map((_, i) => {
      const svc = services[Math.floor(Math.random() * services.length)];
      const tmpl = messageTemplates[Math.floor(Math.random() * messageTemplates.length)];
      const msg = tmpl
        .replace("{0}", String(Math.floor(Math.random() * 9999)))
        .replace("{1}", svc);
      return {
        timestamp: new Date(now - i * 5000 * 60).toISOString(),
        message: msg,
        serviceId: svc,
        level: levels[Math.floor(Math.random() * levels.length)],
        namespace: "AWS/ECS",
      };
    }),
  ];

  return logs;
}