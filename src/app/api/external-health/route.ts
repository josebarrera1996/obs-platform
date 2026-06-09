import { NextResponse } from "next/server";
import { runHealthCheck, formatHealthReport } from "@/lib/external-health";

export const dynamic = "force-dynamic";

/**
 * GET /api/external-health
 * Run external health checks on the platform itself.
 * Returns JSON or plain text report.
 *
 * Query params:
 *   format?: "json" | "text" (default: "json")
 *   baseUrl?: string — override base URL for checks
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";
    const baseUrl = searchParams.get("baseUrl") || undefined;

    const result = await runHealthCheck(
      baseUrl ? { baseUrl } : undefined
    );

    if (format === "text") {
      return new NextResponse(formatHealthReport(result), {
        headers: {
          "Content-Type": "text/plain",
          "X-Health-Status": result.overall,
        },
      });
    }

    const statusCode = result.overall === "healthy" ? 200 : result.overall === "degraded" ? 200 : 503;

    return NextResponse.json(
      {
        ...result,
        uptime: process.uptime(),
        version: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
      },
      {
        status: statusCode,
        headers: {
          "X-Health-Status": result.overall,
          "X-Health-Checks": String(result.summary.total),
          "X-Health-Healthy": String(result.summary.healthy),
        },
      }
    );
  } catch (error) {
    console.error("[External Health] Error:", error);
    return NextResponse.json(
      {
        overall: "down",
        error: error instanceof Error ? error.message : "Internal error",
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
        headers: { "X-Health-Status": "down" },
      }
    );
  }
}

/**
 * POST /api/external-health
 * Trigger health check with custom configuration
 *
 * Body:
 *   baseUrl?: string
 *   endpoints?: { path: string; name: string; critical: boolean }[]
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await runHealthCheck(body);

    return NextResponse.json(result, {
      status: result.overall === "healthy" ? 200 : 200, // always 200 for POST
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}