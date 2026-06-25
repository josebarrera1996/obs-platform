import { NextRequest, NextResponse } from "next/server";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import { getCredentialById } from "@/lib/storage";
import { listLogGroups } from "@/lib/cloudwatch-logs";

export const dynamic = "force-dynamic";

/**
 * GET /api/aws/logs/groups
 * Query params: credentialId (required), prefix?, limit?
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const credentialId = searchParams.get("credentialId");
    const prefix = searchParams.get("prefix") || undefined;
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : 100;

    if (!credentialId) {
      return NextResponse.json(
        { error: "Missing required param: credentialId" },
        { status: 400 }
      );
    }

    const cred = await getCredentialById(credentialId);
    if (!cred) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    const client = new CloudWatchLogsClient({
      region: cred.region,
      credentials: {
        accessKeyId: cred.accessKeyId,
        secretAccessKey: cred.secretAccessKey,
      },
    });

    const logGroups = await listLogGroups(client, { prefix, limit });

    return NextResponse.json({
      logGroups,
      region: cred.region,
      total: logGroups.length,
    });
  } catch (error) {
    console.error("GET /api/aws/logs/groups error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
