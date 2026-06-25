import { NextRequest, NextResponse } from "next/server";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import { getCredentialById } from "@/lib/storage";
import { runLogsInsightsQuery } from "@/lib/cloudwatch-logs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/aws/logs/query
 * Body: { credentialId, logGroupNames, query, timeRange?, region? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      credentialId,
      logGroupNames,
      query,
      timeRange = "24h",
      region: regionOverride,
    } = body as {
      credentialId?: string;
      logGroupNames?: string[];
      query?: string;
      timeRange?: string;
      region?: string;
    };

    if (!credentialId || !logGroupNames?.length || !query) {
      return NextResponse.json(
        { error: "Missing required fields: credentialId, logGroupNames, query" },
        { status: 400 }
      );
    }

    const cred = await getCredentialById(credentialId);
    if (!cred) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    const client = new CloudWatchLogsClient({
      region: regionOverride || cred.region,
      credentials: {
        accessKeyId: cred.accessKeyId,
        secretAccessKey: cred.secretAccessKey,
      },
    });

    const { records, statistics } = await runLogsInsightsQuery({
      client,
      logGroupNames,
      query,
      timeRange,
    });

    return NextResponse.json({
      records,
      statistics,
      count: records.length,
      timeRange,
    });
  } catch (error) {
    console.error("POST /api/aws/logs/query error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
