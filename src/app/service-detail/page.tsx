"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MainLayout } from "@/components/MainLayout";
import { useSettingsStore } from "@/store/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/Skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  Server,
  Database,
  Network,
  Globe,
  Zap,
  Container,
  Box,
  MessageSquare,
  RefreshCw,
  Loader2,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Check,
  ChevronDown,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
} from "recharts";

// ── Types ──
interface DiscoveredService {
  id: string;
  name: string;
  namespace: string;
  type: string;
  status: string;
  region: string;
  metrics: { name: string; unit: string }[];
  dimensions?: Record<string, string>;
}

interface MetricPoint {
  timestamp: string;
  value: number;
}

interface MetricStats {
  average: MetricPoint[];
  minimum: MetricPoint[];
  maximum: MetricPoint[];
}

interface MetricResult {
  serviceId: string;
  serviceName: string;
  metricName: string;
  unit: string;
  namespace: string;
  type: string;
  stats: Record<string, MetricPoint[]>;
  datapoints: MetricPoint[];
  count: number;
  error?: string;
}

interface ServiceMetricGroup {
  serviceId: string;
  metrics: MetricResult[];
}

const SERVICE_ICONS: Record<string, typeof Server> = {
  EC2: Server,
  RDS: Database,
  ALB: Network,
  NLB: Network,
  Lambda: Zap,
  ECS: Container,
  DynamoDB: Database,
  S3: Globe,
  ElastiCache: Box,
  SQS: MessageSquare,
  SNS: MessageSquare,
};

const CHART_COLORS = ["#6366f1", "#f97316", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#f59e0b"];

const METRIC_COLORS: Record<string, string> = {
  CPUUtilization: "#6366f1",
  MemoryUtilization: "#f97316",
  RunningTaskCount: "#10b981",
  PendingTaskCount: "#ef4444",
  Invocations: "#8b5cf6",
  Errors: "#ef4444",
  Duration: "#06b6d4",
  Throttles: "#f59e0b",
  NetworkIn: "#6366f1",
  NetworkOut: "#f97316",
  StatusCheckFailed: "#ef4444",
  DatabaseConnections: "#10b981",
  FreeableMemory: "#8b5cf6",
  ReadLatency: "#06b6d4",
  ActiveConnectionCount: "#6366f1",
  RequestCount: "#f97316",
  TargetResponseTime: "#10b981",
  ConsumedReadCapacityUnits: "#6366f1",
  ConsumedWriteCapacityUnits: "#f97316",
};

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(3);
  return n.toFixed(4);
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

// ── Enhanced MetricChart with min/max/avg ──
function EnhancedMetricChart({
  data,
  stats,
  title,
  unit,
  color,
  loading,
  visible,
  onToggle,
}: {
  data: MetricPoint[];
  stats?: { average: MetricPoint[]; minimum: MetricPoint[]; maximum: MetricPoint[] };
  title: string;
  unit?: string;
  color?: string;
  loading?: boolean;
  visible?: boolean;
  onToggle?: () => void;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-4 w-32 mb-3" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartColor = color || CHART_COLORS[0];
  const avgData = stats?.average || data;
  const minData = stats?.minimum || [];
  const maxData = stats?.maximum || [];
  const hasData = avgData.length > 0;

  // Compute summary stats from the raw datapoints
  const allValues = avgData.map((p) => p.value).filter((v) => v > 0);
  const avgLatest = allValues.length > 0 ? allValues[allValues.length - 1] : 0;
  const avgAvg = allValues.length > 0 ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0;

  const minValues = minData.map((p) => p.value).filter((v) => v > 0);
  const maxValues = maxData.map((p) => p.value).filter((v) => v > 0);
  const avgMin = minValues.length > 0 ? Math.min(...minValues) : 0;
  const avgMax = maxValues.length > 0 ? Math.max(...maxValues) : 0;

  return (
    <Card className={visible === false ? "opacity-50" : ""}>
      <CardContent className="p-4">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">{title}</h3>
            {unit && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {unit}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Summary stats */}
            {hasData && (
              <div className="flex items-center gap-2 mr-2 text-[10px] text-muted-foreground">
                <span className="text-blue-500">
                  Avg: <strong>{formatNumber(avgAvg)}</strong>
                </span>
                <span className="text-green-500">
                  Min: <strong>{formatNumber(avgMin)}</strong>
                </span>
                <span className="text-red-500">
                  Max: <strong>{formatNumber(avgMax)}</strong>
                </span>
              </div>
            )}
            {onToggle && (
              <button
                onClick={onToggle}
                className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted transition-colors"
                title={visible === false ? "Show metric" : "Hide metric"}
              >
                {visible === false ? (
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* ── Chart ── */}
        {!hasData ? (
          <div className="h-40 flex items-center justify-center text-sm text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
            <div className="text-center">
              <Activity className="h-6 w-6 mx-auto mb-1 text-muted-foreground/40" />
              <p>No data available for this time range</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                The metric may not be emitted or the service may be idle
              </p>
            </div>
          </div>
        ) : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={avgData}>
                <defs>
                  <linearGradient id={`grad-${title.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTimestamp}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                  tickFormatter={(v) => formatNumber(v)}
                />
                <RechartTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const ts = label;
                    const avgVal = payload.find((p) => p.dataKey === "average")?.value as number;
                    const minVal = payload.find((p) => p.dataKey === "minimum")?.value as number;
                    const maxVal = payload.find((p) => p.dataKey === "maximum")?.value as number;
                    return (
                      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-xs space-y-1.5">
                        {ts !== undefined && (
                          <p className="text-muted-foreground">{formatTimestamp(String(ts))}</p>
                        )}
                        <div className="space-y-0.5">
                          {avgVal !== undefined && (
                            <p className="text-blue-500">
                              Avg: <strong>{formatNumber(avgVal)}</strong>
                            </p>
                          )}
                          {minVal !== undefined && minVal > 0 && (
                            <p className="text-green-500">
                              Min: <strong>{formatNumber(minVal)}</strong>
                            </p>
                          )}
                          {maxVal !== undefined && maxVal > 0 && (
                            <p className="text-red-500">
                              Max: <strong>{formatNumber(maxVal)}</strong>
                            </p>
                          )}
                        </div>
                        <p className="text-muted-foreground/60 text-[10px]">{unit}</p>
                      </div>
                    );
                  }}
                />
                {/* Area fill for average */}
                <Area
                  type="monotone"
                  dataKey="value"
                  name="average"
                  stroke={chartColor}
                  fill={`url(#grad-${title.replace(/\s+/g, "-")})`}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: chartColor }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Footer ── */}
        {hasData && (
          <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
            <span>
              Latest: <strong>{formatNumber(avgLatest)}</strong> {unit?.toLowerCase()}
            </span>
            <span>{avgData.length} datapoints</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Metric Visibility Toggle ──
function MetricVisibilityBar({
  metrics,
  visible,
  onToggle,
}: {
  metrics: { name: string; unit: string; hasData: boolean }[];
  visible: Record<string, boolean>;
  onToggle: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const visibleCount = Object.values(visible).filter(Boolean).length;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1.5"
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Metrics ({visibleCount}/{metrics.length})
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>

      {open && (
        <Card className="absolute top-full left-0 mt-1 z-50 w-64 shadow-lg border">
          <CardContent className="p-2 space-y-0.5">
            {metrics.map((m) => (
              <button
                key={m.name}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                  visible[m.name] !== false
                    ? "bg-primary/5 text-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => onToggle(m.name)}
              >
                <div
                  className={`h-3.5 w-3.5 rounded border flex items-center justify-center transition-colors ${
                    visible[m.name] !== false
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/30"
                  }`}
                >
                  {visible[m.name] !== false && <Check className="h-2.5 w-2.5" />}
                </div>
                <span className="flex-1 text-left">{m.name}</span>
                <Badge
                  variant="secondary"
                  className={`text-[9px] px-1 py-0 h-3.5 ${
                    m.hasData ? "" : "opacity-50"
                  }`}
                >
                  {m.unit}
                </Badge>
                {!m.hasData && (
                  <span className="text-[9px] text-muted-foreground/50">no data</span>
                )}
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Main Content ──
function ServiceDetailContent() {
  const searchParams = useSearchParams();
  const serviceId = searchParams.get("id") || "";
  const activeCredentialId = useSettingsStore((s) => s.activeCredentialId);

  const [service, setService] = useState<DiscoveredService | null>(null);
  const [metrics, setMetrics] = useState<MetricResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("24h");
  const [visibleMetrics, setVisibleMetrics] = useState<Record<string, boolean>>({});

  // Fetch the service from AWS
  const fetchService = useCallback(async () => {
    if (!serviceId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/aws/services?id=${encodeURIComponent(serviceId)}&credentialId=${activeCredentialId || ""}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();

      // Filter to the specific service
      const allServices: DiscoveredService[] = data.services || [];
      const found = allServices.find((s) => s.id === serviceId);
      if (found) {
        setService(found);
        // Init visibility: all visible by default
        const vis: Record<string, boolean> = {};
        found.metrics.forEach((m) => {
          vis[m.name] = true;
        });
        setVisibleMetrics(vis);
      } else {
        // If not found in list, try constructing from the data
        if (allServices.length > 0) {
          // Try to match by name or partial ID
          const partial = allServices.find(
            (s) => serviceId.includes(s.id) || s.id.includes(serviceId) || s.name.includes(serviceId)
          );
          if (partial) {
            setService(partial);
            const vis: Record<string, boolean> = {};
            partial.metrics.forEach((m) => {
              vis[m.name] = true;
            });
            setVisibleMetrics(vis);
          } else {
            setService(null);
          }
        } else {
          setService(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch service");
    } finally {
      setLoading(false);
    }
  }, [serviceId, activeCredentialId]);

  // Fetch metrics for the service
  const fetchMetrics = useCallback(async () => {
    if (!service) return;
    setMetricsLoading(true);

    try {
      const res = await fetch("/api/aws/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          services: [
            {
              id: service.id,
              namespace: service.namespace,
              type: service.type,
              name: service.name,
              dimensions: service.dimensions || {},
            },
          ],
          timeRange,
          stats: ["Average", "Minimum", "Maximum"],
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const groups: ServiceMetricGroup[] = data.results || [];
      const group = groups.find((g) => g.serviceId === service.id);
      setMetrics(group?.metrics || []);
    } catch (err) {
      console.error("Failed to fetch metrics:", err);
      setMetrics([]);
    } finally {
      setMetricsLoading(false);
    }
  }, [service, timeRange]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchService();
  }, [fetchService]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (service) fetchMetrics();
  }, [fetchMetrics]);

  const toggleMetric = (name: string) => {
    setVisibleMetrics((prev) => ({
      ...prev,
      [name]: prev[name] === false ? true : false,
    }));
  };

  // If no serviceId, show error
  if (!serviceId) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-lg font-medium">No service selected</p>
            <p className="text-sm text-muted-foreground mt-1">
              Use the search or click on a resource to view its details
            </p>
            <Link href="/" className="text-sm text-primary hover:underline mt-3 inline-block">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Derived data
  const Icon = service ? SERVICE_ICONS[service.type] || Server : Server;

  // Build metric data for EnhancedMetricChart
  const metricCards = metrics.map((m) => {
    const avgData = m.stats?.["Average"] || m.datapoints || [];
    const minData = m.stats?.["Minimum"] || [];
    const maxData = m.stats?.["Maximum"] || [];

    return {
      name: m.metricName,
      unit: m.unit,
      data: avgData,
      stats: {
        average: avgData,
        minimum: minData,
        maximum: maxData,
      } as MetricStats,
      color: METRIC_COLORS[m.metricName] || CHART_COLORS[metrics.indexOf(m) % CHART_COLORS.length],
      hasData: avgData.length > 0,
    };
  });

  const visibleMetricsList = metricCards.filter(
    (m) => visibleMetrics[m.name] !== false
  );
  const hiddenMetricsList = metricCards.filter(
    (m) => visibleMetrics[m.name] === false
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4 inline mr-1" />
              Back to Dashboard
            </Link>

            {/* Service Title */}
            {loading ? (
              <div className="space-y-2 mt-2">
                <Skeleton className="h-7 w-72" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : service ? (
              <>
                <div className="flex items-center gap-3 mt-1">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold">
                      {service.type}: {service.name}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {service.namespace} • {service.region} • {service.type}
                    </p>
                  </div>
                  <Badge
                    className={`capitalize ${
                      service.status === "healthy"
                        ? "bg-green-500/10 text-green-500 border-green-500/30"
                        : service.status === "degraded"
                        ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                        : "bg-red-500/10 text-red-500 border-red-500/30"
                    }`}
                    variant="outline"
                  >
                    {service.status}
                  </Badge>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 mt-2">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                <p className="text-lg font-medium">Service not found</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={(val) => val !== null && setTimeRange(val)}>
              <SelectTrigger className="w-20 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">1h</SelectItem>
                <SelectItem value="6h">6h</SelectItem>
                <SelectItem value="24h">24h</SelectItem>
                <SelectItem value="7d">7d</SelectItem>
                <SelectItem value="30d">30d</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={fetchMetrics}
              disabled={metricsLoading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${metricsLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* ── Error State ── */}
        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Failed to load service</p>
                <p className="text-xs text-destructive/80 mt-0.5">{error}</p>
              </div>
              <Button variant="outline" size="sm" className="ml-auto" onClick={fetchService}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Metrics Section ── */}
        {service && (
          <>
            {/* Metric Controls Bar */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {metricCards.filter((m) => visibleMetrics[m.name] !== false).length} of {metricCards.length} metrics visible
              </h2>
              <div className="flex items-center gap-2">
                <MetricVisibilityBar
                  metrics={metricCards.map((m) => ({
                    name: m.name,
                    unit: m.unit,
                    hasData: m.hasData,
                  }))}
                  visible={visibleMetrics}
                  onToggle={toggleMetric}
                />
              </div>
            </div>

            {/* Loading State */}
            {metricsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-4 w-32 mb-3" />
                      <Skeleton className="h-32 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : metricCards.length === 0 ? (
              /* Empty state */
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
                  <Activity className="h-12 w-12 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No metrics available for this service</p>
                  <p className="text-xs text-muted-foreground/60">
                    Metrics may take a few minutes to appear after the service starts emitting data
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Visible Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleMetricsList.map((m) => (
                    <EnhancedMetricChart
                      key={m.name}
                      title={m.name}
                      unit={m.unit}
                      data={m.data}
                      stats={m.stats}
                      color={m.color}
                      loading={false}
                      visible={true}
                      onToggle={() => toggleMetric(m.name)}
                    />
                  ))}
                </div>

                {/* Hidden Metrics (collapsed) */}
                {hiddenMetricsList.length > 0 && (
                  <Card className="border-dashed">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground mb-2">
                        Hidden metrics ({hiddenMetricsList.length}):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {hiddenMetricsList.map((m) => (
                          <Badge
                            key={m.name}
                            variant="outline"
                            className="cursor-pointer hover:bg-muted transition-colors text-xs"
                            onClick={() => toggleMetric(m.name)}
                          >
                            <EyeOff className="h-3 w-3 mr-1" />
                            {m.name}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* ── Service Info Card ── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Service Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Resource ID</p>
                    <p className="text-sm font-mono mt-0.5 truncate" title={service.id}>
                      {service.id}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="text-sm mt-0.5">{service.type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Namespace</p>
                    <p className="text-sm mt-0.5">{service.namespace}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Region</p>
                    <p className="text-sm mt-0.5">{service.region}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="text-sm mt-0.5 capitalize">{service.status}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Available Metrics</p>
                    <p className="text-sm mt-0.5">{service.metrics.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Metrics with Data</p>
                    <p className="text-sm mt-0.5">
                      {metricCards.filter((m) => m.hasData).length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Time Range</p>
                    <p className="text-sm mt-0.5 capitalize">{timeRange}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}

export default function ServiceDetailPage() {
  return (
    <Suspense
      fallback={
        <MainLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </MainLayout>
      }
    >
      <ServiceDetailContent />
    </Suspense>
  );
}