import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  ListMetricsCommand,
} from "@aws-sdk/client-cloudwatch";

export interface MetricDataPoint {
  timestamp: string;
  value: number;
}

export interface MetricSeriesResult {
  label: string;
  dimensions: Record<string, string>;
  datapoints: MetricDataPoint[];
  statsMap?: Record<string, MetricDataPoint[]>;
}

export type CloudWatchStat = "Average" | "Sum" | "Maximum" | "Minimum" | "SampleCount";

const TIME_RANGES: Record<string, number> = {
  "1h": 3600,
  "6h": 21600,
  "24h": 86400,
  "7d": 604800,
  "30d": 2592000,
};

const DEFAULT_PERIODS: Record<string, number> = {
  "1h": 300,
  "6h": 1800,
  "24h": 3600,
  "7d": 86400,
  "30d": 86400,
};

/** Parse dimensions from JSON query param or legacy single pair */
export function parseDimensionsFromQuery(
  dimensionsJson: string | null,
  dimensionName: string | null,
  dimensionValue: string | null
): Record<string, string> {
  if (dimensionsJson) {
    try {
      const parsed = JSON.parse(dimensionsJson) as Record<string, string>;
      return Object.fromEntries(
        Object.entries(parsed).filter(([k, v]) => k && v)
      );
    } catch {
      return {};
    }
  }
  if (dimensionName && dimensionValue) {
    return { [dimensionName]: dimensionValue };
  }
  return {};
}

/** Build a human-readable label for a metric series (Grafana-style legend) */
export function buildSeriesLabel(
  dimensions: Record<string, string>,
  metricName: string
): string {
  // Prefer ServiceName, then InstanceId, then last dimension value
  const priority = ["ServiceName", "InstanceId", "FunctionName", "DBInstanceIdentifier", "TableName"];
  for (const key of priority) {
    if (dimensions[key]) return dimensions[key];
  }
  const values = Object.values(dimensions);
  if (values.length === 1) return values[0];
  if (values.length > 1) return values.join(" / ");
  return metricName;
}

function dimensionSetKey(dims: { Name: string; Value: string }[]): string {
  return dims
    .map((d) => `${d.Name}=${d.Value}`)
    .sort()
    .join("|");
}

function dimsMatchPartial(
  full: { Name: string; Value: string }[],
  partial: Record<string, string>
): boolean {
  for (const [name, value] of Object.entries(partial)) {
    const found = full.find((d) => d.Name === name && d.Value === value);
    if (!found) return false;
  }
  return true;
}

async function fetchOneSeries(
  client: CloudWatchClient,
  namespace: string,
  metricName: string,
  dimensions: { Name: string; Value: string }[],
  stat: CloudWatchStat,
  startTime: Date,
  endTime: Date,
  period: number
): Promise<{ datapoints: MetricDataPoint[]; statsMap: Record<string, MetricDataPoint[]> }> {
  const stats: CloudWatchStat[] =
    stat === "Average" || stat === "Minimum" || stat === "Maximum"
      ? ["Average", "Minimum", "Maximum"]
      : [stat];

  const resp = await client.send(
    new GetMetricStatisticsCommand({
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: dimensions,
      StartTime: startTime,
      EndTime: endTime,
      Period: period,
      Statistics: stats,
    })
  );

  const raw = (resp.Datapoints || []).sort(
    (a, b) => (a.Timestamp?.getTime() || 0) - (b.Timestamp?.getTime() || 0)
  );

  const statsMap: Record<string, MetricDataPoint[]> = {};
  for (const s of stats) {
    statsMap[s] = raw.map((dp) => ({
      timestamp: dp.Timestamp?.toISOString() || "",
      value: (dp[s as keyof typeof dp] as number) ?? 0,
    }));
  }

  return {
    datapoints: statsMap[stat] ?? [],
    statsMap,
  };
}

/**
 * Discover all dimension sets for a metric matching partial filters (matchExact: false).
 * Mirrors Grafana CloudWatch datasource behavior.
 */
async function discoverDimensionSets(
  client: CloudWatchClient,
  namespace: string,
  metricName: string,
  partialDimensions: Record<string, string>
): Promise<{ Name: string; Value: string }[][]> {
  const filterDims = Object.entries(partialDimensions).map(([Name, Value]) => ({
    Name,
    Value,
  }));

  const seen = new Set<string>();
  const results: { Name: string; Value: string }[][] = [];
  let nextToken: string | undefined;

  do {
    const resp = await client.send(
      new ListMetricsCommand({
        Namespace: namespace,
        MetricName: metricName,
        ...(filterDims.length > 0 ? { Dimensions: filterDims } : {}),
        NextToken: nextToken,
      })
    );

    for (const m of resp.Metrics || []) {
      const dims = (m.Dimensions || []).filter(
        (d): d is { Name: string; Value: string } => !!(d.Name && d.Value)
      );
      if (dims.length === 0) continue;
      if (!dimsMatchPartial(dims, partialDimensions)) continue;

      const key = dimensionSetKey(dims);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(dims);
    }

    nextToken = resp.NextToken;
  } while (nextToken && results.length < 50);

  return results;
}

export interface QueryMetricOptions {
  client: CloudWatchClient;
  namespace: string;
  metricName: string;
  dimensions: Record<string, string>;
  stat?: CloudWatchStat;
  timeRange?: string;
  period?: number;
  matchExact?: boolean;
}

export interface QueryMetricResult {
  series: MetricSeriesResult[];
  datapoints: MetricDataPoint[];
  period: number;
  label: string;
}

/**
 * Query CloudWatch metrics — single series (matchExact) or multiple (Grafana-style).
 */
function resolvePeriod(timeRange: string, requestedPeriod?: number): number {
  const rangeSeconds = TIME_RANGES[timeRange] || 86400;
  let period = requestedPeriod ?? DEFAULT_PERIODS[timeRange] ?? 3600;
  // CloudWatch GetMetricStatistics allows max ~1440 datapoints
  while (rangeSeconds / period > 1440) {
    period *= 2;
  }
  return period;
}

export async function queryCloudWatchMetric(
  opts: QueryMetricOptions
): Promise<QueryMetricResult> {
  const {
    client,
    namespace,
    metricName,
    dimensions,
    stat = "Average",
    timeRange = "24h",
    matchExact = false,
  } = opts;

  const period = resolvePeriod(timeRange, opts.period);
  const endTime = new Date();
  const startTime = new Date(
    endTime.getTime() - (TIME_RANGES[timeRange] || 86400) * 1000
  );

  const dimEntries = Object.entries(dimensions).filter(([k, v]) => k && v);

  let dimensionSets: { Name: string; Value: string }[][];

  if (matchExact) {
    if (dimEntries.length === 0) {
      return { series: [], datapoints: [], period, label: `${namespace} ${metricName}` };
    }
    dimensionSets = [
      dimEntries.map(([Name, Value]) => ({ Name, Value })),
    ];
  } else {
    dimensionSets = await discoverDimensionSets(
      client,
      namespace,
      metricName,
      Object.fromEntries(dimEntries)
    );
  }

  if (dimensionSets.length === 0) {
    return { series: [], datapoints: [], period, label: `${namespace} ${metricName}` };
  }

  const series: MetricSeriesResult[] = await Promise.all(
    dimensionSets.map(async (dims) => {
      const dimRecord = Object.fromEntries(dims.map((d) => [d.Name, d.Value]));
      const { datapoints, statsMap } = await fetchOneSeries(
        client,
        namespace,
        metricName,
        dims,
        stat,
        startTime,
        endTime,
        period
      );
      return {
        label: buildSeriesLabel(dimRecord, metricName),
        dimensions: dimRecord,
        datapoints,
        statsMap,
      };
    })
  );

  // Sort series by label for stable legend order
  series.sort((a, b) => a.label.localeCompare(b.label));

  return {
    series,
    datapoints: series[0]?.datapoints ?? [],
    period,
    label: series.length === 1 ? series[0].label : `${namespace} ${metricName}`,
  };
}

/** Merge multiple series into chart-friendly rows keyed by series label */
export function mergeSeriesForChart(
  series: MetricSeriesResult[]
): Record<string, string | number>[] {
  const byTs = new Map<string, Record<string, string | number>>();

  for (const s of series) {
    for (const dp of s.datapoints) {
      if (!byTs.has(dp.timestamp)) {
        byTs.set(dp.timestamp, { timestamp: dp.timestamp });
      }
      byTs.get(dp.timestamp)![s.label] = dp.value;
    }
  }

  return Array.from(byTs.values()).sort((a, b) =>
    String(a.timestamp).localeCompare(String(b.timestamp))
  );
}

/** Build URLSearchParams for GET /api/aws/metrics */
export function buildMetricsQueryParams(opts: {
  credentialId: string;
  namespace: string;
  metricName: string;
  stat: string;
  dimensions: Record<string, string>;
  matchExact?: boolean;
  timeRange?: string;
  period?: number;
}): URLSearchParams {
  const filtered = Object.fromEntries(
    Object.entries(opts.dimensions).filter(([k, v]) => k && v)
  );
  const params = new URLSearchParams({
    credentialId: opts.credentialId,
    namespace: opts.namespace,
    metricName: opts.metricName,
    stat: opts.stat,
    timeRange: opts.timeRange ?? "24h",
    dimensions: JSON.stringify(filtered),
    matchExact: String(opts.matchExact ?? false),
  });
  if (opts.period) params.set("period", String(opts.period));
  return params;
}
