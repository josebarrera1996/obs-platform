import type { MetricSeriesResult } from "@/lib/cloudwatch-query";
import type { LogRecord } from "@/lib/cloudwatch-logs";
import type { DataFrame } from "@/types/transforms";

export function inferColumns(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) seen.add(key);
  }
  return Array.from(seen);
}

export function normalizeFrame(frame: DataFrame): DataFrame {
  const columns =
    frame.columns.length > 0 ? frame.columns : inferColumns(frame.rows);
  return { columns, rows: frame.rows.map((r) => ({ ...r })) };
}

/** Wide-format time series from CloudWatch metric series */
export function seriesToDataFrame(series: MetricSeriesResult[]): DataFrame {
  const byTs = new Map<string, Record<string, unknown>>();

  for (const s of series) {
    for (const dp of s.datapoints) {
      if (!byTs.has(dp.timestamp)) {
        byTs.set(dp.timestamp, { timestamp: dp.timestamp });
      }
      byTs.get(dp.timestamp)![s.label] = dp.value;
    }
  }

  const rows = Array.from(byTs.values()).sort((a, b) =>
    String(a.timestamp).localeCompare(String(b.timestamp))
  );
  const columns = inferColumns(rows);
  return { columns, rows };
}

/** Log query results → DataFrame */
export function logsToDataFrame(records: LogRecord[]): DataFrame {
  const rows = records.map((r) => ({ ...r })) as Record<string, unknown>[];
  return { columns: inferColumns(rows), rows };
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

export function getNumericColumns(frame: DataFrame): string[] {
  return frame.columns.filter((col) => {
    if (col === "timestamp" || col === "@timestamp") return false;
    return frame.rows.some((r) => toNumber(r[col]) !== null);
  });
}

export function detectViewMode(frame: DataFrame): "timeseries" | "table" | "stat" {
  if (frame.rows.length <= 1) return "stat";
  const hasTime = frame.columns.some(
    (c) => c === "timestamp" || c === "@timestamp"
  );
  if (hasTime && getNumericColumns(frame).length > 0) return "timeseries";
  return "table";
}

/** Convert wide DataFrame back to chart-friendly rows + series labels */
export function dataFrameToChart(frame: DataFrame): {
  chartData: Record<string, string | number>[];
  seriesLabels: string[];
} {
  const timeCol =
    frame.columns.find((c) => c === "timestamp" || c === "@timestamp") ??
    "timestamp";
  const valueCols = frame.columns.filter(
    (c) => c !== timeCol && c !== "@message" && c !== "message"
  );

  const chartData: Record<string, string | number>[] = frame.rows.map((row) => {
    const point: Record<string, string | number> = {};
    if (row[timeCol] !== undefined) {
      point.timestamp = String(row[timeCol]);
    }
    for (const col of valueCols) {
      const n = toNumber(row[col]);
      if (n !== null) point[col] = n;
      else if (row[col] !== undefined) point[col] = String(row[col]);
    }
    return point;
  });

  const seriesLabels = valueCols.filter((col) =>
    chartData.some((row) => typeof row[col] === "number")
  );

  return { chartData, seriesLabels };
}

export function dataFrameToSeries(frame: DataFrame): MetricSeriesResult[] {
  const { chartData, seriesLabels } = dataFrameToChart(frame);
  return seriesLabels.map((label) => ({
    label,
    dimensions: {},
    datapoints: chartData
      .filter((row) => typeof row[label] === "number")
      .map((row) => ({
        timestamp: String(row.timestamp ?? ""),
        value: row[label] as number,
      })),
  }));
}
