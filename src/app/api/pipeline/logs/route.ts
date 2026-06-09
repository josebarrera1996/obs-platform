// ── API: Pipeline Logs (Quickwit) ──
// Search logs indexed in Quickwit. Falls back gracefully.

import { NextRequest, NextResponse } from "next/server";
import { searchLogs, quickwitHealthCheck } from "@/lib/pipeline/quickwit";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get("query") || "*";
  const serviceId = searchParams.get("serviceId") || undefined;
  const startTimestamp = searchParams.get("start") || undefined;
  const endTimestamp = searchParams.get("end") || undefined;
  const maxHits = Math.min(Number(searchParams.get("maxHits")) || 100, 500);

  try {
    const health = await quickwitHealthCheck();
    if (!health.reachable) {
      return NextResponse.json({
        status: "degraded",
        message: "Quickwit not reachable — logs are stored as JSONL files locally",
        health,
        logs: [],
        numHits: 0,
      });
    }

    const result = await searchLogs(query, {
      maxHits,
      startTimestamp,
      endTimestamp,
      serviceId,
    });

    return NextResponse.json({
      status: "ok",
      health,
      ...result,
    });
  } catch (error) {
    console.error("[API] Quickwit logs error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
        logs: [],
        numHits: 0,
      },
      { status: 500 }
    );
  }
}