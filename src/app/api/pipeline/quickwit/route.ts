// ── API: Quickwit Health Check ──
// Reports Quickwit availability and version.

import { NextResponse } from "next/server";
import { quickwitHealthCheck } from "@/lib/pipeline/quickwit";

export async function GET() {
  const health = await quickwitHealthCheck();

  return NextResponse.json({
    status: health.reachable ? "ok" : "degraded",
    service: "quickwit",
    ...health,
    endpoint: process.env.QUICKWIT_URL || "http://localhost:7280",
  });
}