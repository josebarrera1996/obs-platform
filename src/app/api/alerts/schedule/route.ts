// ── Alert Scheduler ──
// Endpoint called by an external cron trigger (e.g. cron-job.org, AWS EventBridge, systemd timer).
// Evaluates all enabled alert rules against current AWS metrics.
//
// Trigger every 5 minutes:
//   curl -X POST http://localhost:3000/api/alerts/schedule?credentialId=<id>

import { NextRequest, NextResponse } from "next/server";
import { getCredentialById } from "@/lib/storage";
import { getRules, evaluateAll } from "@/lib/alerts/engine";
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  type Dimension,
} from "@aws-sdk/client-cloudwatch";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Up to 60s for cron jobs

/**
 * POST /api/alerts/schedule?credentialId=xxx
 *
 * Fetches current metrics for all enabled rules and evaluates them.
 * Returns evaluation results (which rules fired, which stayed silent).
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const credentialId = searchParams.get("credentialId");

    if (!credentialId) {
      return NextResponse.json(
        { error: "Missing credentialId" },
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

    const rules = getRules().filter((r) => r.enabled);
    if (rules.length === 0) {
      return NextResponse.json({ evaluated: 0, results: [] });
    }

    const cloudWatchClient = new CloudWatchClient({
      region: cred.region,
      credentials: {
        accessKeyId: cred.accessKeyId,
        secretAccessKey: cred.secretAccessKey,
      },
    });

    // Fetch current metrics for all enabled rules
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const metricsResults = await Promise.allSettled(
      rules.map(async (rule) => {
        const dimensions: Dimension[] = [];

        // Parse namespace for service/resource dimensions
        if (rule.namespace === "AWS/ECS") {
          const parts = rule.metric.split(":");
          if (parts.length === 2) {
            dimensions.push(
              { Name: "ClusterName", Value: parts[0] },
              { Name: "ServiceName", Value: parts[1] }
            );
          }
        } else if (rule.namespace === "AWS/EC2") {
          dimensions.push({ Name: "InstanceId", Value: rule.metric });
        }

        const cmd = new GetMetricStatisticsCommand({
          Namespace: rule.namespace,
          MetricName: rule.metric.includes(":") ? "CPUUtilization" : rule.metric,
          Dimensions: dimensions.length > 0 ? dimensions : undefined,
          StartTime: fiveMinAgo,
          EndTime: now,
          Period: 300,
          Statistics: [rule.stat as "Average" | "Maximum" | "Minimum" | "SampleCount" | "Sum"],
        });

        const response = await cloudWatchClient.send(cmd);
        const datapoints = response.Datapoints || [];
        const latestValue =
          datapoints.length > 0
            ? datapoints.sort(
                (a, b) =>
                  (b.Timestamp?.getTime() || 0) - (a.Timestamp?.getTime() || 0)
              )[0][rule.stat as keyof typeof datapoints[0]]
            : undefined;

        return {
          ruleId: rule.id,
          metricName: rule.metric,
          value: typeof latestValue === "number" ? latestValue : 0,
          unit: datapoints[0]?.Unit || "Percent",
          timestamp: datapoints[0]?.Timestamp?.toISOString() || new Date().toISOString(),
        };
      })
    );

    // Collect successful metric readings
    const metrics: {
      ruleId: string;
      metricName: string;
      value: number;
      unit: string;
      timestamp: string;
    }[] = [];
    for (const result of metricsResults) {
      if (result.status === "fulfilled" && result.value) {
        metrics.push(result.value);
      }
    }

    // Evaluate rules against current metrics
    // Map collected metrics to the format evaluateAll expects (namespace + metricName)
    const results = evaluateAll(
      metrics.map((m) => {
        const rule = rules.find((r) => r.id === m.ruleId);
        return {
          namespace: rule?.namespace || "AWS/CloudWatch",
          metricName: m.metricName,
          value: m.value,
          unit: m.unit,
        };
      })
    );

    return NextResponse.json({
      evaluated: rules.length,
      metricsCollected: metrics.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("POST /api/alerts/schedule error:", error);
    return NextResponse.json(
      { error: "Scheduler evaluation failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/alerts/schedule — simple health check for the scheduler.
 */
export async function GET() {
  const rules = getRules();
  return NextResponse.json({
    status: "ok",
    enabledRules: rules.filter((r) => r.enabled).length,
    totalRules: rules.length,
    timestamp: new Date().toISOString(),
  });
}