import { NextRequest, NextResponse } from "next/server";
import { getCredentialById } from "@/lib/storage";
import {
  CloudTrailClient,
  LookupEventsCommand,
} from "@aws-sdk/client-cloudtrail";

const TIME_RANGES: Record<string, number> = {
  "1h": 3600,
  "6h": 21600,
  "24h": 86400,
  "7d": 604800,
  "30d": 2592000,
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const credentialId = searchParams.get("credentialId");
    const timeRange = searchParams.get("timeRange") || "24h";
    const maxResults = parseInt(searchParams.get("maxResults") || "50", 10);

    if (!credentialId) {
      return NextResponse.json(
        { error: "Missing required param: credentialId" },
        { status: 400 }
      );
    }

    const cred = await getCredentialById(credentialId);
    if (!cred) {
      return NextResponse.json(
        { error: "Credential not found" },
        { status: 404 }
      );
    }

    const ctClient = new CloudTrailClient({
      region: cred.region,
      credentials: {
        accessKeyId: cred.accessKeyId,
        secretAccessKey: cred.secretAccessKey,
      },
    });

    const seconds = TIME_RANGES[timeRange] || 86400;
    const endTime = new Date();
    const startTime = new Date(Date.now() - seconds * 1000);

    const response = await ctClient.send(
      new LookupEventsCommand({
        StartTime: startTime,
        EndTime: endTime,
        MaxResults: maxResults,
      })
    );

    const events = (response.Events || []).map((event) => {
      // Parse CloudTrailEvent JSON to extract error codes if present
      let errorCode: string | undefined;
      let errorMessage: string | undefined;
      try {
        if (event.CloudTrailEvent) {
          const parsed = JSON.parse(event.CloudTrailEvent);
          errorCode = parsed?.errorCode || parsed?.error_code;
          errorMessage = parsed?.errorMessage || parsed?.error_message;
        }
      } catch {
        // CloudTrailEvent is not always valid JSON
      }

      return {
        id: event.EventId || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        eventName: event.EventName || "Unknown",
        eventSource: event.EventSource || "Unknown",
        eventTime: event.EventTime?.toISOString() || new Date().toISOString(),
        username: event.Username || "N/A",
        resources: (event.Resources || []).map((r) => ({
          type: r.ResourceType || "Unknown",
          name: r.ResourceName || "N/A",
        })),
        readOnly: event.ReadOnly,
        errorCode,
        errorMessage,
      };
    });

    // Build a summary of event categories
    const eventSummary = {
      total: events.length,
      errors: events.filter((e) => e.errorCode).length,
      byType: events.reduce(
        (acc: Record<string, number>, e) => {
          const category = e.eventName.split(" ")[0] || "Other";
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    };

    return NextResponse.json({ events, summary: eventSummary });
  } catch (error) {
    console.error("GET /api/aws/events error:", error);
    // CloudTrail might not be enabled, return empty gracefully
    return NextResponse.json({
      events: [],
      summary: { total: 0, errors: 0, byType: {} },
      error: error instanceof Error ? error.message : "CloudTrail may not be enabled",
    });
  }
}
