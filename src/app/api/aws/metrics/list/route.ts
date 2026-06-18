import { NextRequest, NextResponse } from "next/server";
import { getCredentialById } from "@/lib/storage";
import {
  CloudWatchClient,
  ListMetricsCommand,
  type Metric,
} from "@aws-sdk/client-cloudwatch";

export const dynamic = "force-dynamic";

export interface AvailableMetric {
  metricName: string;
  namespace: string;
  dimensionSets: { Name: string; Value: string }[][];
}

export interface DimensionOption {
  name: string;
  values: string[];
}

async function listAllMetricsForNamespace(
  client: CloudWatchClient,
  namespace: string,
  metricName?: string | null
): Promise<Metric[]> {
  const rawMetrics: Metric[] = [];
  let nextToken: string | undefined;

  do {
    const response = await client.send(
      new ListMetricsCommand({
        Namespace: namespace,
        ...(metricName ? { MetricName: metricName } : {}),
        NextToken: nextToken,
      })
    );
    rawMetrics.push(...(response.Metrics || []));
    nextToken = response.NextToken;
  } while (nextToken);

  return rawMetrics;
}

function dedupeDimensionSets(
  sets: { Name: string; Value: string }[][]
): { Name: string; Value: string }[][] {
  const seen = new Set<string>();
  const unique: { Name: string; Value: string }[][] = [];
  for (const dims of sets) {
    const key = dims
      .map((d) => `${d.Name}=${d.Value}`)
      .sort()
      .join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(dims);
  }
  return unique;
}

/**
 * GET /api/aws/metrics/list
 * Lists all CloudWatch metrics for a namespace (paginated via ListMetrics).
 * Unlike a RecentlyActive filter, this matches Grafana-style full metric catalogs.
 *
 * Query params:
 *   credentialId  (required)
 *   namespace     (required)  e.g. AWS/ECS
 *   metricName    (optional)  filter to a single metric name
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const credentialId = searchParams.get("credentialId");
    const namespace = searchParams.get("namespace");
    const metricName = searchParams.get("metricName");

    if (!credentialId || !namespace) {
      return NextResponse.json(
        { error: "Missing required params: credentialId, namespace" },
        { status: 400 }
      );
    }

    const cred = await getCredentialById(credentialId);
    if (!cred) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    const client = new CloudWatchClient({
      region: cred.region,
      credentials: {
        accessKeyId: cred.accessKeyId,
        secretAccessKey: cred.secretAccessKey,
      },
    });

    const rawMetrics = await listAllMetricsForNamespace(client, namespace, metricName);

    // Group by metricName, collecting all unique dimension value sets
    const byMetric = new Map<
      string,
      { dimensionSets: { Name: string; Value: string }[][] }
    >();

    for (const m of rawMetrics) {
      if (!m.MetricName) continue;
      const dims = (m.Dimensions || [])
        .filter((d) => d.Name && d.Value)
        .map((d) => ({ Name: d.Name!, Value: d.Value! }));

      if (!byMetric.has(m.MetricName)) {
        byMetric.set(m.MetricName, { dimensionSets: [] });
      }
      byMetric.get(m.MetricName)!.dimensionSets.push(dims);
    }

    // Build list sorted alphabetically
    const metrics: AvailableMetric[] = Array.from(byMetric.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, { dimensionSets }]) => ({
        metricName: name,
        namespace,
        dimensionSets: dedupeDimensionSets(dimensionSets),
      }));

    // Also extract per-dimension-name distinct values (useful for dropdowns)
    const dimensionOptions = new Map<string, Set<string>>();
    for (const m of metrics) {
      for (const dimSet of m.dimensionSets) {
        for (const { Name, Value } of dimSet) {
          if (!dimensionOptions.has(Name)) dimensionOptions.set(Name, new Set());
          dimensionOptions.get(Name)!.add(Value);
        }
      }
    }

    const dimensions: DimensionOption[] = Array.from(dimensionOptions.entries()).map(
      ([name, values]) => ({ name, values: Array.from(values).sort() })
    );

    return NextResponse.json({
      namespace,
      metrics,
      dimensions,
      total: metrics.length,
    });
  } catch (error) {
    console.error("GET /api/aws/metrics/list error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
