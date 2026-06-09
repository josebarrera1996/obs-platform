// ── Data Pipeline Collector ──
// Collects metrics from AWS CloudWatch and forwards them to NATS / Quickwit.
// This is the bridge between AWS observability and our pipeline.

import {
  CloudWatchClient,
  GetMetricDataCommand,
  type MetricDataQuery,
} from "@aws-sdk/client-cloudwatch";
import { getCredentialById } from "@/lib/storage";

export interface PipelineMetric {
  timestamp: string;
  metricName: string;
  namespace: string;
  serviceId?: string;
  accountId?: string;
  region: string;
  value: number;
  unit: string;
  dimensions?: Record<string, string>;
}

export interface PipelineConfig {
  credentialId: string;
  region: string;
  interval: number; // seconds between collections
  namespaces: string[]; // e.g. ["AWS/ECS", "AWS/EC2", "AWS/Lambda"]
}

const DEFAULT_NAMESPACES = [
  "AWS/ECS",
  "AWS/EC2",
  "AWS/Lambda",
  "AWS/RDS",
  "AWS/ElastiCache",
  "AWS/ApplicationELB",
  "AWS/S3",
];

/**
 * Create a CloudWatch client from a stored credential
 */
async function getCloudWatchClient(credentialId: string, region: string) {
  const cred = await getCredentialById(credentialId);
  if (!cred) throw new Error(`Credential not found: ${credentialId}`);

  return new CloudWatchClient({
    region: region || cred.region || "us-east-1",
    credentials: {
      accessKeyId: cred.accessKeyId,
      secretAccessKey: cred.secretAccessKey,
    },
  });
}

/**
 * Collect metrics from CloudWatch for a given namespace
 */
export async function collectNamespaceMetrics(
  credentialId: string,
  region: string,
  namespace: string
): Promise<PipelineMetric[]> {
  const client = await getCloudWatchClient(credentialId, region);
  const now = new Date();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

  // Common metric names per namespace
  const metricsByNamespace: Record<string, string[]> = {
    "AWS/ECS": ["CPUUtilization", "MemoryUtilization"],
    "AWS/EC2": ["CPUUtilization", "NetworkIn", "NetworkOut", "DiskReadOps", "DiskWriteOps"],
    "AWS/Lambda": ["Invocations", "Errors", "Duration", "Throttles"],
    "AWS/RDS": ["CPUUtilization", "DatabaseConnections", "FreeStorageSpace", "ReadLatency"],
    "AWS/ElastiCache": ["CPUUtilization", "CurrConnections", "FreeableMemory"],
    "AWS/ApplicationELB": ["RequestCount", "TargetResponseTime", "HTTPCode_Target_5XX_Count"],
    "AWS/S3": ["BucketSizeBytes", "NumberOfObjects", "AllRequests"],
  };

  const metricNames = metricsByNamespace[namespace] || [];
  if (metricNames.length === 0) return [];

  const queries: MetricDataQuery[] = metricNames.map((name, idx) => ({
    Id: `m${idx}`,
    MetricStat: {
      Metric: {
        Namespace: namespace,
        MetricName: name,
      },
      Period: 300,
      Stat: "Average",
    },
    ReturnData: true,
  }));

  try {
    const command = new GetMetricDataCommand({
      MetricDataQueries: queries,
      StartTime: fiveMinAgo,
      EndTime: now,
    });

    const response = await client.send(command);
    const metrics: PipelineMetric[] = [];

    for (const result of response.MetricDataResults || []) {
      const metricName = metricNames[parseInt(result.Id?.replace("m", "") || "0")] || result.Label || "unknown";
      const values = result.Values || [];
      const timestamps = result.Timestamps || [];

      for (let i = 0; i < values.length; i++) {
        metrics.push({
          timestamp: (timestamps[i] || now).toISOString(),
          metricName,
          namespace,
          region,
          value: values[i],
          unit: result.Label || "Count",
          dimensions: {
            collectedBy: "obs-platform-pipeline",
          },
        });
      }
    }

    return metrics;
  } catch (error) {
    console.error(`[Pipeline] Error collecting metrics for ${namespace}:`, error);
    return [];
  }
}

/**
 * Collect metrics across all configured namespaces
 */
export async function collectAllMetrics(
  config: PipelineConfig
): Promise<PipelineMetric[]> {
  const namespaces = config.namespaces.length > 0 ? config.namespaces : DEFAULT_NAMESPACES;

  const results = await Promise.allSettled(
    namespaces.map((ns) =>
      collectNamespaceMetrics(config.credentialId, config.region, ns)
    )
  );

  const metrics: PipelineMetric[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      metrics.push(...result.value);
    }
  }

  return metrics;
}

/**
 * Format metrics for NATS/Quickwit ingestion
 */
export function formatForPipeline(metrics: PipelineMetric[]): string {
  return JSON.stringify({
    source: "obs-platform-pipeline",
    timestamp: new Date().toISOString(),
    metrics: metrics.map((m) => ({
      ...m,
      // Ensure all required fields
      serviceId: m.serviceId || "unknown",
      accountId: m.accountId || "unknown",
    })),
    metadata: {
      version: "1.0",
      count: metrics.length,
    },
  });
}