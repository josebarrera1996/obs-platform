import { NextRequest, NextResponse } from "next/server";
import { getCredentialById } from "@/lib/storage";
import {
  CloudWatchClient,
  DescribeAlarmsCommand,
  type StateValue,
} from "@aws-sdk/client-cloudwatch";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const credentialId = searchParams.get("credentialId");
    const stateValue = searchParams.get("stateValue") || "ALARM"; // ALARM, OK, INSUFFICIENT_DATA
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

    const cwClient = new CloudWatchClient({
      region: cred.region,
      credentials: {
        accessKeyId: cred.accessKeyId,
        secretAccessKey: cred.secretAccessKey,
      },
    });

    const command = new DescribeAlarmsCommand({
      StateValue: stateValue as StateValue,
      MaxRecords: maxResults,
    });

    const response = await cwClient.send(command);
    const alarms = (response.MetricAlarms || []).map((alarm) => ({
      name: alarm.AlarmName,
      arn: alarm.AlarmArn,
      description: alarm.AlarmDescription,
      stateValue: alarm.StateValue,
      stateReason: alarm.StateReason,
      stateUpdatedTimestamp: alarm.StateUpdatedTimestamp?.toISOString(),
      metricName: alarm.MetricName,
      namespace: alarm.Namespace,
      severity: alarm.StateValue === "ALARM" ? "critical" as const : "warning" as const,
      threshold: alarm.Threshold,
      evaluationPeriods: alarm.EvaluationPeriods,
    }));

    return NextResponse.json({
      alarms,
      totalCount: alarms.length,
      region: cred.region,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/aws/alarms error:", error);
    return NextResponse.json(
      { error: "Failed to fetch CloudWatch alarms" },
      { status: 500 }
    );
  }
}