import { NextRequest, NextResponse } from "next/server";
import { getCredentialById } from "@/lib/storage";
import {
  parseDimensionsFromQuery,
  queryCloudWatchMetric,
  type CloudWatchStat,
} from "@/lib/cloudwatch-query";
import { CloudWatchClient, GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";

export const dynamic = "force-dynamic";

const TIME_RANGES: Record<string, number> = {
  "1h": 3600,
  "6h": 21600,
  "24h": 86400,
  "7d": 604800,
  "30d": 2592000,
};

const DEFAULT_PERIODS: Record<string, number> = {
  "1h": 300,    // 5 min
  "6h": 1800,   // 30 min
  "24h": 3600,  // 1 hour
  "7d": 86400,  // 1 day
  "30d": 86400, // 1 day
};

const DIMENSION_MAP: Record<string, string> = {
  "AWS/EC2": "InstanceId",
  "AWS/RDS": "DBInstanceIdentifier",
  "AWS/ApplicationELB": "LoadBalancer",
  "AWS/NetworkELB": "LoadBalancer",
  "AWS/Lambda": "FunctionName",
  "AWS/ECS": "ServiceName",
  "AWS/DynamoDB": "TableName",
  "AWS/S3": "BucketName",
  "AWS/ElastiCache": "CacheClusterId",
  "AWS/SQS": "QueueName",
  "AWS/SNS": "TopicName",
};

const SERVICE_METRICS: Record<string, { name: string; unit: string; namespace: string }[]> = {
  EC2: [
    { name: "CPUUtilization", unit: "Percent", namespace: "AWS/EC2" },
    { name: "NetworkIn", unit: "Bytes", namespace: "AWS/EC2" },
    { name: "NetworkOut", unit: "Bytes", namespace: "AWS/EC2" },
    { name: "StatusCheckFailed", unit: "Count", namespace: "AWS/EC2" },
  ],
  ECS: [
    { name: "CPUUtilization", unit: "Percent", namespace: "AWS/ECS" },
    { name: "MemoryUtilization", unit: "Percent", namespace: "AWS/ECS" },
    { name: "RunningTaskCount", unit: "Count", namespace: "AWS/ECS" },
    { name: "PendingTaskCount", unit: "Count", namespace: "AWS/ECS" },
  ],
  Lambda: [
    { name: "Invocations", unit: "Count", namespace: "AWS/Lambda" },
    { name: "Errors", unit: "Count", namespace: "AWS/Lambda" },
    { name: "Duration", unit: "Milliseconds", namespace: "AWS/Lambda" },
    { name: "Throttles", unit: "Count", namespace: "AWS/Lambda" },
  ],
  RDS: [
    { name: "CPUUtilization", unit: "Percent", namespace: "AWS/RDS" },
    { name: "DatabaseConnections", unit: "Count", namespace: "AWS/RDS" },
    { name: "FreeableMemory", unit: "Bytes", namespace: "AWS/RDS" },
    { name: "ReadLatency", unit: "Milliseconds", namespace: "AWS/RDS" },
  ],
  ALB: [
    { name: "ActiveConnectionCount", unit: "Count", namespace: "AWS/ApplicationELB" },
    { name: "RequestCount", unit: "Count", namespace: "AWS/ApplicationELB" },
    { name: "TargetResponseTime", unit: "Milliseconds", namespace: "AWS/ApplicationELB" },
    { name: "HTTPCode_ELB_5XX_Count", unit: "Count", namespace: "AWS/ApplicationELB" },
  ],
  S3: [
    { name: "BucketSizeBytes", unit: "Bytes", namespace: "AWS/S3" },
    { name: "NumberOfObjects", unit: "Count", namespace: "AWS/S3" },
    { name: "AllRequests", unit: "Count", namespace: "AWS/S3" },
    { name: "GetRequests", unit: "Count", namespace: "AWS/S3" },
  ],
  DynamoDB: [
    { name: "ConsumedReadCapacityUnits", unit: "Count", namespace: "AWS/DynamoDB" },
    { name: "ConsumedWriteCapacityUnits", unit: "Count", namespace: "AWS/DynamoDB" },
    { name: "ReadThrottleEvents", unit: "Count", namespace: "AWS/DynamoDB" },
    { name: "WriteThrottleEvents", unit: "Count", namespace: "AWS/DynamoDB" },
  ],
};

interface MetricQuery {
  serviceId: string;
  serviceName?: string;
  namespace: string;
  type: string;
  metricName: string;
  unit: string;
  dimensions: { Name: string; Value: string }[];
}

interface BatchServiceQuery {
  id: string;
  namespace: string;
  type: string;
  name?: string;
  dimensions?: Record<string, string>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      services,
      timeRange = "24h",
      stats: requestedStats,
    }: {
      services: BatchServiceQuery[];
      timeRange?: string;
      stats?: string[];
    } = body;

    if (!services || !Array.isArray(services) || services.length === 0) {
      return NextResponse.json({ error: "services array is required" }, { status: 400 });
    }

    // Pick default stats: Average, Minimum, Maximum for richer display
    const stats = requestedStats || ["Average", "Minimum", "Maximum"];
    const validStats = stats.filter((s) =>
      ["Average", "Sum", "Maximum", "Minimum", "SampleCount"].includes(s)
    ) as ("Average" | "Sum" | "Maximum" | "Minimum" | "SampleCount")[];

    if (validStats.length === 0) {
      return NextResponse.json({ error: "No valid stats provided" }, { status: 400 });
    }

    // Resolve credential from body or first available
    const { credentialId } = body as { credentialId?: string; services: BatchServiceQuery[]; timeRange?: string; stats?: string[] };
    let cred;
    if (credentialId) {
      cred = await getCredentialById(credentialId);
    }
    // Fallback: read first credential from file
    if (!cred) {
      const { promises: fs } = await import("fs");
      const path = await import("path");
      const dataDir = process.env.OBS_DATA_DIR || path.join(process.cwd(), ".data");
      const credsPath = path.join(dataDir, "credentials.json");
      try {
        const raw = await fs.readFile(credsPath, "utf-8");
        const allCreds = JSON.parse(raw);
        // The actual credentials are encrypted - use getCredentialById for each
        // For now, just try first credential by its ID
        const parsed = JSON.parse(raw);
        const firstId = parsed?.[0]?.id || parsed?.[0]?.Id;
        if (firstId) {
          cred = await getCredentialById(firstId);
        } else {
          // Try parsing as array
          const arr = Array.isArray(parsed) ? parsed : [];
          if (arr.length > 0 && arr[0].id) {
            cred = await getCredentialById(arr[0].id);
          }
        }
      } catch {
        // ignore
      }
    }
    if (!cred) {
      return NextResponse.json({ error: "No AWS credentials configured" }, { status: 400 });
    }

    const client = new CloudWatchClient({
      region: cred.region,
      credentials: {
        accessKeyId: cred.accessKeyId,
        secretAccessKey: cred.secretAccessKey,
      },
    });

    // Build queries from each service + its known metrics
    const queries: MetricQuery[] = [];
    for (const svc of services) {
      // Build dimensions array: use stored dimensions (e.g. ECS ClusterName+ServiceName)
      // or fallback to the generic DIMENSION_MAP
      let dims: { Name: string; Value: string }[];
      if (svc.dimensions && Object.keys(svc.dimensions).length > 0) {
        dims = Object.entries(svc.dimensions).map(([Name, Value]) => ({ Name, Value }));
      } else {
        const dimName = DIMENSION_MAP[svc.namespace] || "ResourceId";
        dims = [{ Name: dimName, Value: svc.id }];
      }

      const metrics = SERVICE_METRICS[svc.type] || SERVICE_METRICS.ECS;
      for (const m of metrics) {
        queries.push({
          serviceId: svc.id,
          serviceName: svc.name || svc.id,
          namespace: m.namespace,
          type: svc.type,
          metricName: m.name,
          unit: m.unit,
          dimensions: dims,
        });
      }
    }

    if (queries.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const period = DEFAULT_PERIODS[timeRange] || 3600;
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (TIME_RANGES[timeRange] || 86400) * 1000);

    // Group queries by (namespace, metricName) to batch
    const grouped = new Map<string, MetricQuery[]>();
    for (const q of queries) {
      const key = `${q.serviceId}::${q.namespace}::${q.metricName}::${JSON.stringify(q.dimensions)}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(q);
    }

    const results = await Promise.all(
      Array.from(grouped.entries()).map(async ([key, qs]) => {
        const q = qs[0];
        try {
          const cmd = new GetMetricStatisticsCommand({
            Namespace: q.namespace,
            MetricName: q.metricName,
            Dimensions: q.dimensions,
            StartTime: startTime,
            EndTime: endTime,
            Period: period,
            Statistics: validStats,
          });

          const resp = await client.send(cmd);
          const rawDatapoints = (resp.Datapoints || []).sort(
            (a, b) => (a.Timestamp?.getTime() || 0) - (b.Timestamp?.getTime() || 0)
          );

          // Build per-stat datapoints from the same CloudWatch response
          const statsMap: Record<string, { timestamp: string; value: number }[]> = {};
          for (const stat of validStats) {
            statsMap[stat] = rawDatapoints.map((dp) => ({
              timestamp: dp.Timestamp?.toISOString() || "",
              value: (dp[stat as keyof typeof dp] as number) || 0,
            }));
          }

          return {
            serviceId: q.serviceId,
            serviceName: q.serviceName || q.serviceId,
            metricName: q.metricName,
            unit: q.unit,
            namespace: q.namespace,
            type: q.type,
            stats: statsMap,
            datapoints: statsMap["Average"] || statsMap[validStats[0]] || [],
            count: rawDatapoints.length,
          };
        } catch (err) {
          return {
            serviceId: q.serviceId,
            serviceName: q.serviceName || q.serviceId,
            metricName: q.metricName,
            unit: q.unit,
            namespace: q.namespace,
            type: q.type,
            stats: {},
            datapoints: [],
            error: (err as Error).message,
            count: 0,
          };
        }
      })
    );

    // Group results by serviceId
    const byService = new Map<string, typeof results>();
    for (const r of results) {
      if (!byService.has(r.serviceId)) byService.set(r.serviceId, []);
      byService.get(r.serviceId)!.push(r);
    }

    const groupedResults = Array.from(byService.entries()).map(([serviceId, metrics]) => ({
      serviceId,
      metrics,
    }));

    return NextResponse.json({ results: groupedResults });
  } catch (error) {
    console.error("POST /api/aws/metrics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch batch metrics" },
      { status: 500 }
    );
  }
}

async function resolveCredential(credentialId: string | null) {
  if (credentialId) {
    const cred = await getCredentialById(credentialId);
    if (cred) return cred;
  }
  const { promises: fs } = await import("fs");
  const pathMod = await import("path");
  const dataDir = process.env.OBS_DATA_DIR || pathMod.join(process.cwd(), ".data");
  const metaPath = pathMod.join(dataDir, "credentials.json");
  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    const parsed = JSON.parse(raw);
    const firstId = Array.isArray(parsed) ? parsed[0]?.id : null;
    if (firstId) return getCredentialById(firstId);
  } catch {
    /* ignore */
  }
  return null;
}

// GET — single or multi-series metric query (Grafana-compatible matchExact)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const namespace = searchParams.get("namespace");
    const metricName = searchParams.get("metricName");
    const timeRange = searchParams.get("timeRange") || "24h";
    const stat = (searchParams.get("stat") || "Average") as CloudWatchStat;
    const matchExact = searchParams.get("matchExact") === "true";
    const periodParam = searchParams.get("period");
    const period = periodParam ? parseInt(periodParam, 10) : undefined;

    const dimensions = parseDimensionsFromQuery(
      searchParams.get("dimensions"),
      searchParams.get("dimensionName"),
      searchParams.get("dimensionValue")
    );

    if (!namespace || !metricName) {
      return NextResponse.json(
        { error: "Missing required params: namespace, metricName" },
        { status: 400 }
      );
    }

    if (Object.keys(dimensions).length === 0) {
      return NextResponse.json(
        { error: "Missing dimensions (use dimensions JSON or dimensionName/dimensionValue)" },
        { status: 400 }
      );
    }

    const cred = await resolveCredential(searchParams.get("credentialId"));
    if (!cred) {
      return NextResponse.json({ error: "No AWS credentials" }, { status: 400 });
    }

    const client = new CloudWatchClient({
      region: cred.region,
      credentials: {
        accessKeyId: cred.accessKeyId,
        secretAccessKey: cred.secretAccessKey,
      },
    });

    const result = await queryCloudWatchMetric({
      client,
      namespace,
      metricName,
      dimensions,
      stat,
      timeRange,
      period,
      matchExact,
    });

    // Backward-compat statsMap for first series
    const statsMap: Record<string, { timestamp: string; value: number }[]> = {
      [stat]: result.datapoints,
    };

    return NextResponse.json({
      datapoints: result.datapoints,
      series: result.series,
      statsMap,
      label: result.label,
      period: result.period,
      unit: searchParams.get("unit") || "Percent",
      matchExact,
    });
  } catch (error) {
    console.error("GET /api/aws/metrics error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// ── diagnostics endpoint for Frontend ──
// (previously had getActiveCredentialId — now handled via request body)
