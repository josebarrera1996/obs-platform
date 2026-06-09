import { NextResponse } from "next/server";
import { queryMetrics, getPipelineStats } from "@/lib/pipeline/ingester";

export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline/query
 * Query ingested pipeline metrics.
 *
 * Query params:
 *   namespace?: string  — filter by AWS namespace (e.g. "AWS/ECS")
 *   metricName?: string — filter by metric name
 *   startDate?: string  — YYYY-MM-DD
 *   endDate?: string    — YYYY-MM-DD
 *   limit?: number      — max results (default 1000)
 *   format?: "json" | "csv" — response format (default "json")
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";

    // If no filters, return stats
    if (!searchParams.has("namespace") && !searchParams.has("metricName")) {
      const stats = await getPipelineStats();
      return NextResponse.json({
        type: "stats",
        ...stats,
        storageSizeMB: (stats.storageSizeBytes / (1024 * 1024)).toFixed(2),
        timestamp: new Date().toISOString(),
      });
    }

    const metrics = await queryMetrics({
      namespace: searchParams.get("namespace") || undefined,
      metricName: searchParams.get("metricName") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      serviceId: searchParams.get("serviceId") || undefined,
      limit: parseInt(searchParams.get("limit") || "1000"),
    });

    if (format === "csv") {
      // Return CSV format
      const headers = "timestamp,metricName,namespace,value,unit,region";
      const rows = metrics.map((m) =>
        `${m.timestamp},${m.metricName},${m.namespace},${m.value},${m.unit},${m.region}`
      );
      return new NextResponse([headers, ...rows].join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=metrics.csv",
        },
      });
    }

    return NextResponse.json({
      type: "data",
      count: metrics.length,
      metrics,
      query: {
        namespace: searchParams.get("namespace") || "all",
        limit: parseInt(searchParams.get("limit") || "1000"),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Pipeline Query] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}