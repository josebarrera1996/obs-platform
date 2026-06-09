import { NextResponse } from "next/server";
import { healthCheck, runMigrations } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline/db
 * Check PostgreSQL connection and migration status
 */
export async function GET() {
  try {
    const health = await healthCheck();
    return NextResponse.json({
      success: health.connected,
      ...health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[DB Health] Error:", error);
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: error instanceof Error ? error.message : "Internal server error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pipeline/db
 * Run pending migrations
 *
 * Body:
 *   action: "migrate" — run pending migrations
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action } = body;

    if (action === "migrate") {
      const result = await runMigrations();
      return NextResponse.json({
        success: result.errors.length === 0,
        migrationsApplied: result.applied,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      });
    }

    // Default: return health
    const health = await healthCheck();
    return NextResponse.json({
      success: health.connected,
      ...health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal error",
      },
      { status: 500 }
    );
  }
}