"use client";

import { useMemo } from "react";
import { MetricPanel } from "@/types/products";
import { MetricSeriesResult, mergeSeriesForChart } from "@/lib/cloudwatch-query";
import { transformMetricSeries } from "@/lib/transforms";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Loader2, PenLine, Trash2, Activity } from "lucide-react";

const SERIES_COLORS = ["#6366f1", "#f97316", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4"];

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(3);
  return n.toFixed(4);
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

function computeSummary(series: MetricSeriesResult[]) {
  const primary = series[0];
  if (!primary) return null;

  const avgData = primary.statsMap?.Average ?? primary.datapoints;
  const minData = primary.statsMap?.Minimum ?? [];
  const maxData = primary.statsMap?.Maximum ?? [];

  const avgValues = avgData.map((p) => p.value).filter((v) => !Number.isNaN(v));
  const avgAvg = avgValues.length ? avgValues.reduce((a, b) => a + b, 0) / avgValues.length : 0;
  const latest = avgValues.length ? avgValues[avgValues.length - 1] : 0;

  const minValues = minData.map((p) => p.value).filter((v) => v > 0);
  const maxValues = maxData.map((p) => p.value).filter((v) => v > 0);

  return {
    avg: avgAvg,
    min: minValues.length ? Math.min(...minValues) : 0,
    max: maxValues.length ? Math.max(...maxValues) : 0,
    latest,
    datapoints: avgData.length,
  };
}

interface DetailPanelChartProps {
  panel: MetricPanel;
  series: MetricSeriesResult[];
  loading?: boolean;
  error?: string;
  onEdit?: () => void;
  onRemove?: () => void;
}

export function DetailPanelChart({
  panel,
  series,
  loading,
  error,
  onEdit,
  onRemove,
}: DetailPanelChartProps) {
  const transformed = useMemo(() => {
    if (!panel.transforms?.length) {
      return {
        chartData: mergeSeriesForChart(series),
        displaySeries: series,
        viewMode: "timeseries" as const,
        columns: [] as string[],
        transformError: null as string | null,
      };
    }
    try {
      const result = transformMetricSeries(series, panel.transforms);
      return {
        chartData: result.chartData,
        displaySeries: result.series,
        viewMode: result.viewMode,
        columns: result.frame.columns,
        transformError: null as string | null,
      };
    } catch (err) {
      return {
        chartData: mergeSeriesForChart(series),
        displaySeries: series,
        viewMode: "timeseries" as const,
        columns: [] as string[],
        transformError: (err as Error).message,
      };
    }
  }, [series, panel.transforms]);

  const { chartData, displaySeries, viewMode, columns, transformError } = transformed;
  const hasData = chartData.length > 0 && displaySeries.some((s) => s.datapoints.length > 0);
  const summary = viewMode === "timeseries" ? computeSummary(displaySeries) : null;

  const dimLabel = Object.entries(panel.dimensions)
    .filter(([k, v]) => k && v)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  const tableColumns =
    columns.length > 0 ? columns : chartData.length > 0 ? Object.keys(chartData[0]) : [];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold">
                {panel.title || panel.metricName}
              </h3>
              <Badge variant="secondary" className="text-[10px] h-5">
                {panel.stat}
              </Badge>
              {!panel.matchExact && (
                <Badge variant="outline" className="text-[10px] h-5 text-amber-500 border-amber-500/30">
                  match exact off
                </Badge>
              )}
              {panel.transforms && panel.transforms.length > 0 && (
                <Badge variant="outline" className="text-[10px] h-5 text-violet-500 border-violet-500/30">
                  {panel.transforms.length} transform{panel.transforms.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[11px] font-mono text-muted-foreground">{panel.namespace}</span>
              <span className="text-[11px] text-muted-foreground">·</span>
              <span className="text-[11px] text-muted-foreground">{panel.metricName}</span>
              {dimLabel && (
                <>
                  <span className="text-[11px] text-muted-foreground">·</span>
                  <span className="text-[11px] text-muted-foreground truncate max-w-md" title={dimLabel}>
                    {dimLabel}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {summary && hasData && (
              <div className="hidden sm:flex items-center gap-3 mr-2 text-[11px] text-muted-foreground">
                <span className="text-blue-500">
                  Avg: <strong>{formatNumber(summary.avg)}</strong>
                </span>
                <span className="text-green-500">
                  Min: <strong>{formatNumber(summary.min)}</strong>
                </span>
                <span className="text-red-500">
                  Max: <strong>{formatNumber(summary.max)}</strong>
                </span>
              </div>
            )}
            {displaySeries.length > 1 && viewMode === "timeseries" && (
              <Badge variant="outline" className="text-[10px]">
                {displaySeries.length} series
              </Badge>
            )}
            {onEdit && (
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={onEdit}>
                <PenLine className="h-3.5 w-3.5" />
              </Button>
            )}
            {onRemove && (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30"
                onClick={onRemove}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {transformError && (
          <div className="mb-3 text-xs text-red-500 bg-red-500/5 border border-red-500/20 rounded-md px-3 py-2">
            Transform error: {transformError}
          </div>
        )}

        {loading ? (
          <div className="h-56 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
          </div>
        ) : error ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
            {error}
          </div>
        ) : !hasData && viewMode === "timeseries" ? (
          <div className="h-56 flex flex-col items-center justify-center text-sm text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
            <Activity className="h-8 w-8 mb-2 opacity-30" />
            <p>No data available for this time range</p>
          </div>
        ) : viewMode === "stat" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 py-4">
            {Object.entries(chartData[0] ?? {}).map(([key, val]) => (
              <div
                key={key}
                className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-center"
              >
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">
                  {key}
                </p>
                <p className="text-xl font-semibold mt-1">
                  {typeof val === "number" ? formatNumber(val) : String(val)}
                </p>
              </div>
            ))}
          </div>
        ) : viewMode === "table" ? (
          <div className="max-h-56 overflow-auto rounded-lg border border-border/50">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b border-border/50">
                  {tableColumns.map((col) => (
                    <th
                      key={col}
                      className="text-left font-medium text-muted-foreground px-3 py-2 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartData.map((row, i) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-muted/30">
                    {tableColumns.map((col) => (
                      <td key={col} className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">
                        {typeof row[col] === "number"
                          ? formatNumber(row[col] as number)
                          : String(row[col] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTimestamp}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tickFormatter={formatNumber}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    padding: "8px 12px",
                  }}
                  labelFormatter={(v) => new Date(v).toLocaleString()}
                  formatter={(v) => [typeof v === "number" ? formatNumber(v) : v]}
                />
                {displaySeries.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                {displaySeries.map((s, idx) => (
                  <Area
                    key={s.label}
                    type="monotone"
                    dataKey={s.label}
                    stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                    fill={SERIES_COLORS[idx % SERIES_COLORS.length]}
                    fillOpacity={0.12}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {summary && hasData && viewMode === "timeseries" && (
          <div className="flex items-center justify-between mt-3 text-[11px] text-muted-foreground">
            <span>
              Latest: <strong>{formatNumber(summary.latest)}</strong>
              {panel.unit ? ` ${panel.unit.toLowerCase()}` : ""}
            </span>
            <span>{summary.datapoints} datapoints</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
