"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { MetricPanel } from "@/types/products";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Loader2, Plus, X, RefreshCw, BarChart3, AlertCircle } from "lucide-react";
import {
  buildMetricsQueryParams,
  mergeSeriesForChart,
  type MetricSeriesResult,
} from "@/lib/cloudwatch-query";
import { TransformPipelineEditor } from "@/components/TransformPipelineEditor";
import { transformMetricSeries } from "@/lib/transforms";
import { CHART_AXIS_TICK, CHART_THEME } from "@/lib/display-utils";
import type { PanelTransform } from "@/types/transforms";

const PREVIEW_COLORS = ["#6366f1", "#f97316", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4"];

const AWS_NAMESPACES = [
  "AWS/EC2",
  "AWS/ECS",
  "AWS/RDS",
  "AWS/Lambda",
  "AWS/ApplicationELB",
  "AWS/NetworkELB",
  "AWS/DynamoDB",
  "AWS/S3",
  "AWS/ElastiCache",
  "AWS/SQS",
  "AWS/SNS",
  "AWS/CloudFront",
  "AWS/ApiGateway",
  "AWS/Kinesis",
  "AWS/Firehose",
  "AWS/EKS",
];

const STATISTICS = [
  { value: "Average", label: "Average" },
  { value: "Sum", label: "Sum" },
  { value: "Minimum", label: "Minimum" },
  { value: "Maximum", label: "Maximum" },
  { value: "SampleCount", label: "Sample Count" },
];

const PERIODS = [
  { value: 60, label: "1 minute" },
  { value: 300, label: "5 minutes" },
  { value: 900, label: "15 minutes" },
  { value: 1800, label: "30 minutes" },
  { value: 3600, label: "1 hour" },
  { value: 86400, label: "1 day" },
];

// ── Types ───────────────────────────────────────────────────────────────────

interface DimensionOption {
  name: string;
  values: string[];
}

interface AvailableMetric {
  metricName: string;
  namespace: string;
  dimensionSets: { Name: string; Value: string }[][];
}

interface DataPoint {
  timestamp: string;
  value: number;
}

// ── Props ───────────────────────────────────────────────────────────────────

interface MetricQueryBuilderProps {
  open: boolean;
  onClose: () => void;
  onSave: (panel: MetricPanel) => void;
  initialPanel?: MetricPanel;
  credentialId: string;
  defaultNamespace?: string;
  defaultDimensions?: Record<string, string>;
}

// ── Component ───────────────────────────────────────────────────────────────

export function MetricQueryBuilder({
  open,
  onClose,
  onSave,
  initialPanel,
  credentialId,
  defaultNamespace,
  defaultDimensions,
}: MetricQueryBuilderProps) {
  const namespaceLocked = !!defaultNamespace;
  const [title, setTitle] = useState(initialPanel?.title ?? "");
  const [namespace, setNamespace] = useState(
    initialPanel?.namespace ?? defaultNamespace ?? "AWS/ECS"
  );
  const [metricName, setMetricName] = useState(initialPanel?.metricName ?? "");
  const [stat, setStat] = useState(initialPanel?.stat ?? "Average");
  const [period, setPeriod] = useState(initialPanel?.period ?? 300);
  const [matchExact, setMatchExact] = useState(initialPanel?.matchExact ?? false);
  const [dimensions, setDimensions] = useState<Record<string, string>>(
    initialPanel?.dimensions ?? defaultDimensions ?? {}
  );

  // Remote data
  const [availableMetrics, setAvailableMetrics] = useState<AvailableMetric[]>([]);
  const [dimensionOptions, setDimensionOptions] = useState<DimensionOption[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricSearch, setMetricSearch] = useState("");

  // Preview data (supports multiple series like Grafana)
  const [previewSeries, setPreviewSeries] = useState<MetricSeriesResult[]>([]);
  const [previewChartData, setPreviewChartData] = useState<Record<string, string | number>[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [hasPreview, setHasPreview] = useState(false);
  const [transforms, setTransforms] = useState<PanelTransform[]>(
    initialPanel?.transforms ?? []
  );

  // Reset form when dialog opens
  useEffect(() => {
    if (!open) return;
    setTitle(initialPanel?.title ?? "");
    setNamespace(initialPanel?.namespace ?? defaultNamespace ?? "AWS/ECS");
    setMetricName(initialPanel?.metricName ?? "");
    setStat(initialPanel?.stat ?? "Average");
    setPeriod(initialPanel?.period ?? 300);
    setMatchExact(initialPanel?.matchExact ?? false);

    if (initialPanel?.dimensions) {
      setDimensions(initialPanel.dimensions);
    } else {
      setDimensions({});
    }

    setPreviewSeries([]);
    setPreviewChartData([]);
    setHasPreview(false);
    setPreviewError(null);
    setMetricSearch("");
    setTransforms(initialPanel?.transforms ?? []);
  }, [open, initialPanel, defaultNamespace, defaultDimensions]);

  // ── Fetch available metrics when namespace changes ──
  const loadMetrics = useCallback(async (ns: string) => {
    if (!credentialId || !ns) return;
    setMetricsLoading(true);
    setMetricsError(null);
    setAvailableMetrics([]);
    setDimensionOptions([]);
    try {
      const res = await fetch(
        `/api/aws/metrics/list?credentialId=${credentialId}&namespace=${encodeURIComponent(ns)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAvailableMetrics(data.metrics ?? []);
      setDimensionOptions(data.dimensions ?? []);
    } catch (err) {
      setMetricsError((err as Error).message);
    } finally {
      setMetricsLoading(false);
    }
  }, [credentialId]);

  useEffect(() => {
    if (open && namespace) loadMetrics(namespace);
  }, [open, namespace, loadMetrics]);

  // When metric changes, suggest dimensions from metric + resource context
  useEffect(() => {
    if (!metricName || initialPanel) return;
    if (Object.keys(dimensions).some((k) => k && dimensions[k])) return;

    const metric = availableMetrics.find((m) => m.metricName === metricName);
    if (!metric || metric.dimensionSets.length === 0) {
      if (defaultDimensions && Object.keys(defaultDimensions).length > 0) {
        if (matchExact) {
          setDimensions({ ...defaultDimensions });
        } else {
          const cluster = defaultDimensions.ClusterName;
          setDimensions(cluster ? { ClusterName: cluster } : { ...defaultDimensions });
        }
      }
      return;
    }

    const firstSet = metric.dimensionSets[0];
    if (matchExact) {
      const auto: Record<string, string> = {};
      for (const { Name, Value } of firstSet) auto[Name] = Value;
      setDimensions(auto);
    } else {
      const cluster =
        firstSet.find((d) => d.Name === "ClusterName") ??
        (defaultDimensions?.ClusterName
          ? { Name: "ClusterName", Value: defaultDimensions.ClusterName }
          : null);
      if (cluster) {
        setDimensions({ ClusterName: cluster.Value });
      } else if (firstSet[0]) {
        setDimensions({ [firstSet[0].Name]: firstSet[0].Value });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricName, availableMetrics, matchExact, defaultDimensions]);

  // ── Preview ──
  const runPreview = useCallback(async () => {
    if (!credentialId || !namespace || !metricName) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const dimEntries = Object.entries(dimensions).filter(([k, v]) => k && v);
      if (dimEntries.length === 0) {
        setPreviewError("Add at least one dimension to preview.");
        setPreviewLoading(false);
        return;
      }

      const params = buildMetricsQueryParams({
        credentialId,
        namespace,
        metricName,
        stat,
        dimensions,
        matchExact,
        timeRange: "7d",
        period,
      });

      const res = await fetch(`/api/aws/metrics?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const series: MetricSeriesResult[] = data.series ?? [];
      setPreviewSeries(series);
      setPreviewChartData(mergeSeriesForChart(series));
      setHasPreview(true);

      if (series.length === 0 || series.every((s) => s.datapoints.length === 0)) {
        setPreviewError(null);
      }
    } catch (err) {
      setPreviewError((err as Error).message);
    } finally {
      setPreviewLoading(false);
    }
  }, [credentialId, namespace, metricName, stat, dimensions, matchExact, period]);

  // ── Dimension helpers ──
  const dimensionKeys = Object.keys(dimensions);

  const setDimensionKey = (oldKey: string, newKey: string) => {
    const entries = Object.entries(dimensions);
    const updated: Record<string, string> = {};
    for (const [k, v] of entries) {
      updated[k === oldKey ? newKey : k] = v;
    }
    setDimensions(updated);
  };

  const setDimensionValue = (key: string, value: string) => {
    setDimensions((prev) => ({ ...prev, [key]: value }));
  };

  const addDimension = () => {
    setDimensions((prev) => ({ ...prev, "": "" }));
  };

  const removeDimension = (key: string) => {
    const copy = { ...dimensions };
    delete copy[key];
    setDimensions(copy);
  };

  // ── Save ──
  const handleSave = () => {
    const panel: MetricPanel = {
      id: initialPanel?.id ?? `panel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim() || `${metricName} (${stat})`,
      namespace,
      metricName,
      stat,
      period,
      dimensions,
      matchExact,
      transforms: transforms.length > 0 ? transforms : undefined,
      unit: availableMetrics.find((m) => m.metricName === metricName) ? undefined : undefined,
    };
    onSave(panel);
  };

  const canSave = !!namespace && !!metricName && !!stat;

  const selectedMetric = availableMetrics.find((m) => m.metricName === metricName);

  const mergedDimensionOptions = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const d of dimensionOptions) {
      if (!map.has(d.name)) map.set(d.name, new Set());
      for (const v of d.values) map.get(d.name)!.add(v);
    }
    if (selectedMetric) {
      for (const dimSet of selectedMetric.dimensionSets) {
        for (const { Name, Value } of dimSet) {
          if (!map.has(Name)) map.set(Name, new Set());
          map.get(Name)!.add(Value);
        }
      }
    }
    if (defaultDimensions) {
      for (const [k, v] of Object.entries(defaultDimensions)) {
        if (!k) continue;
        if (!map.has(k)) map.set(k, new Set());
        if (v) map.get(k)!.add(v);
      }
    }
    return Array.from(map.entries())
      .map(([name, values]) => ({ name, values: Array.from(values).sort() }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dimensionOptions, selectedMetric, defaultDimensions]);

  const metricDimNames = selectedMetric
    ? [...new Set(selectedMetric.dimensionSets.flat().map((d) => d.Name))]
    : mergedDimensionOptions.map((d) => d.name);

  const allMetricDimNames = useMemo(() => {
    const names = new Set<string>(metricDimNames);
    for (const d of mergedDimensionOptions) names.add(d.name);
    return Array.from(names).sort();
  }, [metricDimNames, mergedDimensionOptions]);

  const filteredMetrics = availableMetrics.filter((m) => {
    if (!metricSearch.trim()) return true;
    return m.metricName.toLowerCase().includes(metricSearch.trim().toLowerCase());
  });

  const previewFields = useMemo(() => {
    if (previewChartData.length === 0) return ["timestamp"];
    return Object.keys(previewChartData[0]);
  }, [previewChartData]);

  const transformedPreview = useMemo(() => {
    if (!hasPreview || previewSeries.length === 0) {
      return {
        chartData: previewChartData,
        series: previewSeries,
        viewMode: "timeseries" as const,
        error: null as string | null,
      };
    }
    try {
      const result = transformMetricSeries(previewSeries, transforms);
      return { ...result, error: null as string | null };
    } catch (err) {
      return {
        chartData: previewChartData,
        series: previewSeries,
        viewMode: "timeseries" as const,
        error: (err as Error).message,
      };
    }
  }, [hasPreview, previewSeries, previewChartData, transforms]);

  // ── Render ──
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="min-w-[680px] max-w-[92vw] max-h-[92vh] overflow-y-auto flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {initialPanel ? "Edit Panel" : "Add Panel"}
          </DialogTitle>
          <DialogDescription>
            Configure a CloudWatch metric query to display in your dashboard
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-6 flex-1">
          {/* ── Panel title ── */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Panel Title <span className="normal-case font-normal">(optional)</span>
            </label>
            <Input
              placeholder="e.g. CPU Utilization – prod-cluster"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* ── Query row: Namespace + Metric + Stat ── */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Metric Query
            </label>
            <div className="grid grid-cols-3 gap-2">
              {/* Namespace */}
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">Namespace</span>
                {namespaceLocked ? (
                  <Input
                    value={namespace}
                    readOnly
                    disabled
                    className="h-9 text-sm font-mono bg-muted/40"
                  />
                ) : (
                  <Select
                    value={namespace}
                    onValueChange={(v: string | null) => {
                      if (!v) return;
                      setNamespace(v);
                      setMetricName("");
                      setMetricSearch("");
                      setDimensions({});
                      setPreviewSeries([]);
                      setPreviewChartData([]);
                      setHasPreview(false);
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select namespace" />
                    </SelectTrigger>
                    <SelectContent>
                      {AWS_NAMESPACES.map((ns) => (
                        <SelectItem key={ns} value={ns} className="text-sm font-mono">
                          {ns}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Metric name */}
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  Metric Name
                  {metricsLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  {!metricsLoading && availableMetrics.length > 0 && (
                    <span className="text-muted-foreground/60">({availableMetrics.length})</span>
                  )}
                </span>
                {availableMetrics.length > 6 && (
                  <Input
                    placeholder="Filter metrics…"
                    value={metricSearch}
                    onChange={(e) => setMetricSearch(e.target.value)}
                    className="h-8 text-xs mb-1"
                  />
                )}
                <Select
                  value={metricName || undefined}
                  onValueChange={(v: string | null) => {
                    if (!v) return;
                    setMetricName(v);
                    setDimensions({});
                    setPreviewSeries([]);
                    setPreviewChartData([]);
                    setHasPreview(false);
                  }}
                  disabled={metricsLoading || availableMetrics.length === 0}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue
                      placeholder={
                        metricsLoading
                          ? "Loading…"
                          : metricsError
                          ? "Error loading"
                          : availableMetrics.length === 0
                          ? "No metrics found"
                          : "Choose an option"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {filteredMetrics.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                        No metrics match &quot;{metricSearch}&quot;
                      </div>
                    ) : (
                      filteredMetrics.map((m) => (
                        <SelectItem
                          key={m.metricName}
                          value={m.metricName}
                          className="text-sm font-mono"
                          title={m.metricName}
                        >
                          <span className="block truncate max-w-[420px]">{m.metricName}</span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Statistic */}
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">Statistic</span>
                <Select value={stat} onValueChange={(v: string | null) => v && setStat(v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATISTICS.map((s) => (
                      <SelectItem key={s.value} value={s.value} className="text-sm">
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ── Dimensions ── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Dimensions
              </label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={addDimension}
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>

            {dimensionKeys.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No dimensions configured. Click Add or select a metric to auto-populate.
              </p>
            ) : (
              <div className="space-y-2">
                {dimensionKeys.map((key) => {
                  const dimOpt = mergedDimensionOptions.find((d) => d.name === key);
                  return (
                    <div key={key} className="flex items-center gap-2">
                      {allMetricDimNames.length > 0 ? (
                        <Select
                          value={key}
                          onValueChange={(v: string | null) => v && setDimensionKey(key, v)}
                        >
                          <SelectTrigger className="h-8 text-sm flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-56">
                            {allMetricDimNames.map((dn) => (
                              <SelectItem key={dn} value={dn} className="text-sm font-mono">
                                {dn}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={key}
                          onChange={(e) => setDimensionKey(key, e.target.value)}
                          placeholder="Dimension name"
                          className="h-8 text-sm flex-1 font-mono"
                        />
                      )}

                      <span className="text-muted-foreground text-sm">=</span>

                      {/* Dimension value */}
                      {dimOpt && dimOpt.values.length > 0 ? (
                        <Select
                          value={dimensions[key] ?? ""}
                          onValueChange={(v: string | null) => v && setDimensionValue(key, v)}
                        >
                          <SelectTrigger className="h-8 text-sm flex-1">
                            <SelectValue placeholder="Select value" />
                          </SelectTrigger>
                          <SelectContent>
                            {dimOpt.values.map((v) => (
                              <SelectItem key={v} value={v} className="text-sm font-mono">
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={dimensions[key] ?? ""}
                          onChange={(e) => setDimensionValue(key, e.target.value)}
                          placeholder="Value"
                          className="h-8 text-sm flex-1 font-mono"
                        />
                      )}

                      <button
                        className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                        onClick={() => removeDimension(key)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Match exact (Grafana-style) ── */}
          <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5 bg-muted/20">
            <div>
              <p className="text-xs font-medium">Match exact</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Off = all series matching partial dimensions (like Grafana)
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={matchExact}
              onClick={() => setMatchExact((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                matchExact ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  matchExact ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* ── Query options (Grafana-style) ── */}
          <div className="space-y-3 rounded-lg border border-border/50 p-3 bg-muted/10">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Query Options
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">
                  Min interval (seconds)
                </label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={period}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (!Number.isNaN(n) && n > 0) setPeriod(n);
                  }}
                  className="h-9 text-sm font-mono"
                  placeholder="e.g. 300"
                />
                <p className="text-[10px] text-muted-foreground">
                  Minimum time between datapoints. CloudWatch may increase this for long ranges.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Quick presets</label>
                <div className="flex flex-wrap gap-1.5">
                  {PERIODS.map((p) => (
                    <Button
                      key={p.value}
                      type="button"
                      variant={period === p.value ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[10px] px-2"
                      onClick={() => setPeriod(p.value)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Preview ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Preview (last 7 days)
              </label>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={runPreview}
                disabled={!canSave || previewLoading}
              >
                {previewLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Run Query
              </Button>
            </div>

            {previewError && (
              <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/5 border border-red-500/20 rounded-md px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {previewError}
              </div>
            )}

            {metricsError && !previewError && (
              <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/5 border border-amber-500/20 rounded-md px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                Could not load metrics from CloudWatch: {metricsError}
              </div>
            )}

            {transformedPreview.error && (
              <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/5 border border-red-500/20 rounded-md px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                Transform error: {transformedPreview.error}
              </div>
            )}

            <div className="h-44 rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
              {!hasPreview ? (
                <div className="flex flex-col items-center justify-center h-full gap-1.5 text-muted-foreground">
                  <BarChart3 className="h-6 w-6 opacity-30" />
                  <p className="text-xs">Click &quot;Run Query&quot; to preview</p>
                </div>
              ) : previewSeries.length === 0 || previewChartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-1.5 text-muted-foreground">
                  <AlertCircle className="h-5 w-5 opacity-40" />
                  <p className="text-xs">No data returned for this query</p>
                </div>
              ) : transformedPreview.viewMode === "stat" ? (
                <div className="flex flex-wrap gap-3 items-center justify-center h-full p-4">
                  {Object.entries(transformedPreview.chartData[0] ?? {}).map(([key, val]) => (
                    <div key={key} className="text-center px-4">
                      <p className="text-[10px] text-muted-foreground uppercase">{key}</p>
                      <p className="text-lg font-semibold text-foreground tabular-nums">
                        {typeof val === "number" ? val.toFixed(2) : String(val)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : transformedPreview.viewMode === "table" ? (
                <div className="h-full overflow-auto">
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-0 bg-muted/80">
                      <tr>
                        {Object.keys(transformedPreview.chartData[0] ?? {}).map((col) => (
                          <th key={col} className="text-left px-2 py-1 font-medium text-muted-foreground">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transformedPreview.chartData.slice(0, 20).map((row, i) => (
                        <tr key={i} className="border-t border-border/30">
                          {Object.keys(transformedPreview.chartData[0] ?? {}).map((col) => (
                            <td key={col} className="px-2 py-1 font-mono truncate max-w-[120px] text-foreground">
                              {String(row[col] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={transformedPreview.chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.border} opacity={0.4} />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(v) => {
                        const d = new Date(v);
                        return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`;
                      }}
                      tick={{ ...CHART_AXIS_TICK, fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ ...CHART_AXIS_TICK, fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 11,
                        background: CHART_THEME.card,
                        border: `1px solid ${CHART_THEME.border}`,
                        borderRadius: 6,
                        padding: "4px 8px",
                        color: CHART_THEME.foreground,
                      }}
                      labelFormatter={(v) => new Date(v).toLocaleString()}
                      formatter={(v) => [typeof v === "number" ? v.toFixed(2) : v]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {transformedPreview.series.map((s, idx) => (
                      <Area
                        key={s.label}
                        type="monotone"
                        dataKey={s.label}
                        stroke={PREVIEW_COLORS[idx % PREVIEW_COLORS.length]}
                        strokeWidth={1.5}
                        fill={PREVIEW_COLORS[idx % PREVIEW_COLORS.length]}
                        fillOpacity={0.1}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <TransformPipelineEditor
            transforms={transforms}
            onChange={setTransforms}
            availableFields={previewFields}
          />
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {namespace && (
              <Badge variant="outline" className="text-[10px] font-mono">{namespace}</Badge>
            )}
            {metricName && (
              <Badge variant="outline" className="text-[10px]">{metricName}</Badge>
            )}
            {stat && (
              <Badge variant="secondary" className="text-[10px]">{stat}</Badge>
            )}
            {!matchExact && (
              <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                match exact off
              </Badge>
            )}
            {transforms.length > 0 && (
              <Badge variant="outline" className="text-[10px] text-violet-500 border-violet-500/30">
                {transforms.length} transform{transforms.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              {initialPanel ? "Update Panel" : "Add Panel"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
