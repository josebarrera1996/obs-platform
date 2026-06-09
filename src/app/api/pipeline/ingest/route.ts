import { NextResponse } from "next/server";
import { collectAllMetrics, formatForPipeline, type PipelineConfig } from "@/lib/pipeline/collector";
import { ingestMetrics } from "@/lib/pipeline/ingester";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds for data collection

/**
 * POST /api/pipeline/ingest
 * Collect metrics from CloudWatch and ingest into pipeline storage.
 *
 * Body:
 *   credentialId: string (required)
 *   region?: string (default: from env)
 *   namespaces?: string[] (default: all AWS namespaces)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { credentialId, region, namespaces } = body;

    if (!credentialId) {
      return NextResponse.json(
        { error: "credentialId is required" },
        { status: 400 }
      );
    }

    const config: PipelineConfig = {
      credentialId,
      region: region || process.env.AWS_REGION || "us-east-1",
      interval: 300,
      namespaces: namespaces || [],
    };

    // Collect metrics from CloudWatch
    const metrics = await collectAllMetrics(config);

    // Ingest to pipeline storage
    const ingestResult = await ingestMetrics(metrics);

    return NextResponse.json({
      success: true,
      collected: metrics.length,
      ingested: ingestResult.ingested,
      storageType: ingestResult.storageType,
      timestamp: new Date().toISOString(),
      // Include sample for verification
      sample: metrics.slice(0, 3),
    });
  } catch (error) {
    console.error("[Pipeline Ingest] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pipeline/ingest?credentialId=xxx
 * Quick collect without body (for cron/curl usage)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const credentialId = searchParams.get("credentialId");

  if (!credentialId) {
    return NextResponse.json(
      { error: "credentialId query parameter is required" },
      { status: 400 }
    );
  }

  // Same as POST but with URL params
  return POST(new Request(request.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credentialId }),
  }));
}