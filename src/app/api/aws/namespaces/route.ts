import { NextRequest, NextResponse } from "next/server";
import { getCredentialById } from "@/lib/storage";
import { CloudWatchClient, ListMetricsCommand } from "@aws-sdk/client-cloudwatch";

export const dynamic = "force-dynamic";

// All AWS namespaces we monitor
const AWS_NAMESPACES = [
  "AWS/EC2",
  "AWS/RDS",
  "AWS/ApplicationELB",
  "AWS/NetworkELB",
  "AWS/Lambda",
  "AWS/ECS",
  "AWS/DynamoDB",
  "AWS/S3",
  "AWS/ElastiCache",
  "AWS/SQS",
  "AWS/SNS",
];

// Per-namespace dimension hints so the frontend knows what to query
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _NAMESPACE_DIMENSIONS: Record<string, string[]> = {
  "AWS/EC2": ["InstanceId"],
  "AWS/RDS": ["DBInstanceIdentifier"],
  "AWS/ApplicationELB": ["LoadBalancer", "TargetGroup"],
  "AWS/NetworkELB": ["LoadBalancer", "TargetGroup"],
  "AWS/Lambda": ["FunctionName"],
  "AWS/ECS": ["ClusterName", "ServiceName"],
  "AWS/DynamoDB": ["TableName"],
  "AWS/S3": ["BucketName", "StorageType"],
  "AWS/ElastiCache": ["CacheClusterId"],
  "AWS/SQS": ["QueueName"],
  "AWS/SNS": ["TopicName"],
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const credentialId = searchParams.get("credentialId");
    const namespace = searchParams.get("namespace");

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

    const client = new CloudWatchClient({
      region: cred.region,
      credentials: {
        accessKeyId: cred.accessKeyId,
        secretAccessKey: cred.secretAccessKey,
      },
    });

    // If a specific namespace is requested, just query that one
    const namespacesToQuery = namespace ? [namespace] : AWS_NAMESPACES;

    const results: Record<string, {
      metrics: { name: string; dimensions: string[]; unit: string }[];
      resourceCount: number;
    }> = {};

    for (const ns of namespacesToQuery) {
      try {
        const response = await client.send(new ListMetricsCommand({
          Namespace: ns,
          RecentlyActive: "PT3H", // Only metrics with activity in last 3 hours
        }));

        // Group by metric name and collect unique dimensions
        const metricMap = new Map<string, { name: string; dimensions: Set<string>; unit: string }>();
        
        for (const metric of response.Metrics || []) {
          if (!metric.MetricName) continue;
          const existing = metricMap.get(metric.MetricName);
          const dimNames = (metric.Dimensions || []).map((d) => d.Name || "").filter(Boolean);
          
          if (existing) {
            dimNames.forEach((d) => existing.dimensions.add(d));
          } else {
            metricMap.set(metric.MetricName, {
              name: metric.MetricName,
              dimensions: new Set(dimNames),
              unit: (metric as { Unit?: string }).Unit || "Count",
            });
          }
        }

        results[ns] = {
          metrics: Array.from(metricMap.values()).map((m) => ({
            name: m.name,
            dimensions: Array.from(m.dimensions),
            unit: m.unit,
          })),
          resourceCount: response.Metrics?.length || 0,
        };
      } catch (err) {
        console.warn(`[AWS] Could not query namespace ${ns}:`, (err as Error).message);
        results[ns] = { metrics: [], resourceCount: 0 };
      }
    }

    return NextResponse.json({
      namespaces: results,
      totalNamespaces: Object.keys(results).length,
      region: cred.region,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/aws/namespaces error:", error);
    return NextResponse.json(
      { error: "Failed to fetch AWS namespaces" },
      { status: 500 }
    );
  }
}