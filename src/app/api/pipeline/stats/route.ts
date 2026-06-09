import { NextResponse } from "next/server";
import { cleanupOldData, getPipelineStats } from "@/lib/pipeline/ingester";

export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline/stats
 * Get pipeline storage statistics
 */
export async function GET() {
  try {
    const stats = await getPipelineStats();
    return NextResponse.json({
      ...stats,
      storageSizeMB: (stats.storageSizeBytes / (1024 * 1024)).toFixed(2),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Pipeline Stats] Error:", error);
    return NextResponse.json(
      { error: "Failed to get pipeline stats" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pipeline/stats
 * Trigger cleanup of old data
 *
 * Body:
 *   action: "cleanup"
 *   retentionDays?: number (default: 90)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, retentionDays } = body;

    if (action === "cleanup") {
      const deleted = await cleanupOldData(retentionDays || 90);
      return NextResponse.json({
        success: true,
        deletedFiles: deleted,
        message: `Cleaned up ${deleted} old data files`,
        timestamp: new Date().toISOString(),
      });
    }

    // Default: return stats
    const stats = await getPipelineStats();
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}