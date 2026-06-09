"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useSettingsStore } from "@/store/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/Skeleton";
import Link from "next/link";
import {
  Cloud,
  Server,
  AlertTriangle,
  Activity,
  ArrowUpRight,
  Container,
  Clock,
  BarChart3,
  RefreshCw,
  Database,
  Network,
  Globe,
  Zap,
  MessageSquare,
  Box,
  Search,
  X,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
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
}

interface ServicesResponse {
  services: DiscoveredService[];
  totalCount: number;
  byNamespace: Record<string, number>;
  region: string;
  lastUpdated: string;
}

interface MetricPoint {
  timestamp: string;
  value: number;
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

const NAMESPACE_ICONS: Record<string, typeof Server> = {
  "AWS/EC2": Server,
  "AWS/RDS": Database,
  "AWS/ApplicationELB": Network,
  "AWS/NetworkELB": Network,
  "AWS/Lambda": Zap,
  "AWS/ECS": Container,
  "AWS/DynamoDB": Database,
  "AWS/S3": Globe,
  "AWS/ElastiCache": Box,
  "AWS/SQS": MessageSquare,
  "AWS/SNS": MessageSquare,
};

const NAMESPACE_COLORS: Record<string, string> = {
  "AWS/EC2": "#f97316",
  "AWS/RDS": "#3b82f6",
  "AWS/ApplicationELB": "#8b5cf6",
  "AWS/NetworkELB": "#a855f7",
  "AWS/Lambda": "#fbbf24",
  "AWS/ECS": "#06b6d4",
  "AWS/DynamoDB": "#10b981",
  "AWS/S3": "#ef4444",
  "AWS/ElastiCache": "#ec4899",
  "AWS/SQS": "#6b7280",
  "AWS/SNS": "#84cc16",
};

const CHART_COLORS = ["#6366f1", "#f97316", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

function ServiceIcon({ type }: { type: string }) {
  const Icon = SERVICE_ICONS[type] || Server;
  const color = NAMESPACE_COLORS[`AWS/${type}`] || "#6366f1";
  return <Icon className="h-5 w-5" style={{ color }} />;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toFixed(1);
}

function MetricsChart({ 
  data, 
  title, 
  unit,
  color 
}: { 
  data: MetricPoint[]; 
  title: string; 
  unit?: string;
  color?: string;
}) {
  if (!data || data.length === 0) return null;
  const chartColor = color || CHART_COLORS[0];

  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`grad-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="timestamp" 
            tick={false}
            axisLine={false}
          />
          <YAxis 
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v: number) => formatNumber(v)}
          />
          <RechartTooltip
            contentStyle={{ 
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
labelFormatter={(label: any) => typeof label === 'string' ? new Date(label).toLocaleString() : label}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => {
              const num = typeof value === 'number' ? value : parseFloat(String(value ?? 0));
              return [`${isNaN(num) ? 'N/A' : num.toFixed(2)}${unit ? ` ${unit}` : ""}`, title] as unknown as [string, string];
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={chartColor}
            fill={`url(#grad-${title.replace(/\s+/g, '-')})`}
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    healthy: "bg-emerald-500",
    degraded: "bg-amber-500",
    critical: "bg-red-500",
    running: "bg-emerald-500",
    stopped: "bg-amber-500",
    unknown: "bg-gray-400",
  };
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${colors[status] || "bg-gray-400"}`} />
  );
}

// ── Service Card ──
function ServiceCard({ service }: { service: DiscoveredService }) {
  
  const detailUrl = `/service-detail?ns=${encodeURIComponent(service.namespace)}&id=${encodeURIComponent(service.id)}`;
  return (
    <Link href={detailUrl}>
      <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-sidebar-accent/50 h-full">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <ServiceIcon type={service.type} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{service.name}</p>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0`}>
                  {service.type}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{service.region}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <StatusDot status={service.status} />
                <span className="text-xs text-muted-foreground capitalize">{service.status}</span>
                <span className="text-xs text-muted-foreground">{service.metrics.length} metrics</span>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Namespace breakdown pie chart ──
function NamespacePie({ byNamespace }: { byNamespace: Record<string, number> }) {
  const data = Object.entries(byNamespace)
    .filter(([, count]) => count > 0)
    .map(([ns, count]) => ({
      name: ns.replace("AWS/", ""),
      value: count,
      color: NAMESPACE_COLORS[ns] || "#6366f1",
    }));

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Services by Type</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.color} />
                ))}
              </Pie>
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value: string) => <span className="text-xs">{value}</span>}
              />
              <RechartTooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Services by Status Bar Chart ──
function StatusBarChart({ services }: { services: DiscoveredService[] }) {
  const statusCounts = services.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const data = Object.entries(statusCounts).map(([status, count]) => ({
    status: status.charAt(0).toUpperCase() + status.slice(1),
    count,
    fill: status === "healthy" ? "#10b981" : status === "degraded" ? "#f59e0b" : "#ef4444",
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Resource Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="status" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <RechartTooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Dashboard Page ──
export default function HomePage() {
  const { activeCredentialId, fetchAwsAccounts } = useSettingsStore();
  const [services, setServices] = useState<DiscoveredService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [metricsData, setMetricsData] = useState<Record<string, MetricPoint[]>>({});
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [namespaceFilter, setNamespaceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch all discovered services
  const fetchServices = useCallback(async () => {
    if (!activeCredentialId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/aws/services?credentialId=${activeCredentialId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ServicesResponse = await res.json();
      setServices(data.services || []);
      setLastUpdated(data.lastUpdated);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch services:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch services");
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [activeCredentialId]);

  // Fetch aggregate metrics (CPU-like) for the top services
  const fetchAggregateMetrics = useCallback(async () => {
    if (!activeCredentialId || services.length === 0) return;
    setMetricsLoading(true);

    // Pick top services by type to fetch metrics for
    const servicesByType = new Map<string, DiscoveredService[]>();
    services.forEach((s) => {
      const existing = servicesByType.get(s.namespace) || [];
      existing.push(s);
      servicesByType.set(s.namespace, existing);
    });

    const metrics: Record<string, MetricPoint[]> = {};
    const queries: { namespace: string; metricName: string; dimensionName: string; dimensionValue: string; stat: string; timeRange: string }[] = [];

    // For each namespace, pick a representative metric
    for (const [ns, svcs] of servicesByType.entries()) {
      const sample = svcs[0];
      if (!sample.metrics.length) continue;
      // Pick CPU or first important metric
      const cpuMetric = sample.metrics.find((m) => m.name === "CPUUtilization" || m.name === "Invocations" || m.name === "RequestCount" || m.name === "Duration");
      const metric = cpuMetric || sample.metrics[0];

      // Get dimension info based on namespace
      const dimMap: Record<string, string> = {
        "AWS/EC2": "InstanceId",
        "AWS/RDS": "DBInstanceIdentifier",
        "AWS/ApplicationELB": "LoadBalancer",
        "AWS/Lambda": "FunctionName",
        "AWS/ECS": "ServiceName",
        "AWS/DynamoDB": "TableName",
        "AWS/ElastiCache": "CacheClusterId",
        "AWS/SQS": "QueueName",
        "AWS/SNS": "TopicName",
      };
      const dimName = dimMap[ns] || "InstanceId";
      
      queries.push({
        namespace: ns,
        metricName: metric.name,
        dimensionName: dimName,
        dimensionValue: "",
        stat: "Average",
        timeRange: "1h",
      });
    }

    if (queries.length === 0) {
      setMetricsLoading(false);
      return;
    }

    try {
      // Fetch each namespace metric
      const results = await Promise.allSettled(
        queries.map((q) =>
          fetch(
            `/api/aws/metrics?credentialId=${activeCredentialId}&namespace=${encodeURIComponent(q.namespace)}&metricName=${q.metricName}&dimensionName=${q.dimensionName}&timeRange=${q.timeRange}&stat=${q.stat}`
          ).then((r) => r.json())
        )
      );

      results.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          const data = result.value;
          const ns = queries[idx].namespace;
          if (data.datapoints && Array.isArray(data.datapoints)) {
            metrics[ns] = data.datapoints;
          } else if (data.datapoints && typeof data.datapoints === "object") {
            // Multi-dimension results - aggregate by averaging all
            const allPoints = Object.values(data.datapoints) as MetricPoint[][];
            if (allPoints.length > 0) {
              // Pick first available
              metrics[ns] = allPoints[0];
            }
          }
        }
      });
    } catch (err) {
      console.error("Failed to fetch metrics:", err);
    }

    setMetricsData(metrics);
    setMetricsLoading(false);
  }, [activeCredentialId, services]);

  // Initial fetch
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchServices();
    if (activeCredentialId) {
      fetchAwsAccounts(activeCredentialId);
    }
  }, [activeCredentialId, fetchServices, fetchAwsAccounts]);

  // Fetch metrics after services load
  useEffect(() => {
    if (services.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchAggregateMetrics();
    }
  }, [services.length, fetchAggregateMetrics]);

  // Polling: refresh every 30 seconds
  useEffect(() => {
    if (!activeCredentialId) return;
    intervalRef.current = setInterval(() => {
      fetchServices();
    }, 30000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activeCredentialId, fetchServices]);

  const handleRefresh = () => {
    fetchServices();
    if (services.length > 0) {
      fetchAggregateMetrics();
    }
  };

  // Compute aggregate stats
  const totalResources = services.length;
  const healthyCount = services.filter((s) => s.status === "healthy" || s.status === "running").length;
  const degradedCount = services.filter((s) => s.status === "degraded" || s.status === "stopped").length;
  const criticalCount = services.filter((s) => s.status === "critical").length;
  const namespaceCount = Object.keys(
    services.reduce((acc, s) => {
      acc[s.namespace] = true;
      return acc;
    }, {} as Record<string, boolean>)
  ).length;

  const byNamespace = services.reduce((acc, s) => {
    acc[s.namespace] = (acc[s.namespace] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (!activeCredentialId) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <Cloud className="h-16 w-16 text-muted-foreground/40" />
          <h2 className="text-xl font-semibold text-muted-foreground">No AWS Credentials Configured</h2>
          <p className="text-sm text-muted-foreground max-w-md text-center">
            Configure your AWS credentials in Settings to start monitoring your infrastructure in real-time.
          </p>
          <Link href="/settings">
            <Badge variant="outline" className="cursor-pointer px-4 py-2 text-sm hover:bg-accent transition-colors">
              Go to Settings
            </Badge>
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {loading
                ? "Discovering AWS resources..."
                : `${totalResources} resources across ${namespaceCount} service types`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-600">Discovery Error</p>
                <p className="text-xs text-red-500/80 mt-0.5">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Stat Cards ── */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Server className="h-4 w-4" />
                  <span className="text-xs font-medium">Total Resources</span>
                </div>
                <p className="text-2xl font-bold">{totalResources}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{namespaceCount} service types</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-emerald-600 mb-1">
                  <Activity className="h-4 w-4" />
                  <span className="text-xs font-medium">Healthy</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{healthyCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {totalResources > 0 ? ((healthyCount / totalResources) * 100).toFixed(1) : 0}% of total
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-amber-600 mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs font-medium">Degraded</span>
                </div>
                <p className="text-2xl font-bold text-amber-600">{degradedCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-red-600 mb-1">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-xs font-medium">Critical</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Charts Row ── */}
        {!loading && services.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <StatusBarChart services={services} />
            <NamespacePie byNamespace={byNamespace} />
          </div>
        )}

        {/* ── Per-Namespace Metrics ── */}
        {!loading && Object.keys(metricsData).length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Service Metrics (Last Hour)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Object.entries(metricsData)
                .filter(([, points]) => points.length > 0)
                .slice(0, 6)
                .map(([ns, points]) => {
                  const nsLabel = ns.replace("AWS/", "");
                  const color = NAMESPACE_COLORS[ns] || CHART_COLORS[0];
                  const Icon = NAMESPACE_ICONS[ns] || Activity;
                  const count = byNamespace[ns] || 0;
                  return (
                    <Card key={ns}>
                      <CardHeader className="pb-2 pt-4 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" style={{ color }} />
                            <CardTitle className="text-sm font-medium">{nsLabel}</CardTitle>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{count} resources</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-3 px-4">
                        {metricsLoading ? (
                          <Skeleton className="h-32 w-full" />
                        ) : (
                          <MetricsChart data={points} title={nsLabel} color={color} />
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>
        )}

        {/* ── All Discovered Services ── */}
        {!loading && services.length > 0 && (
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold">All Discovered Resources</h2>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by name, type, namespace..."
                    className="h-9 w-full sm:w-64 rounded-lg border border-input bg-background pl-9 pr-8 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Type Filter */}
                <select
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">All Types</option>
                  {[...new Set(services.map((s) => s.type))].sort().map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                {/* Namespace Filter */}
                <select
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={namespaceFilter}
                  onChange={(e) => setNamespaceFilter(e.target.value)}
                >
                  <option value="all">All Namespaces</option>
                  {[...new Set(services.map((s) => s.namespace))].sort().map((ns) => (
                    <option key={ns} value={ns}>{ns}</option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="healthy">Healthy</option>
                  <option value="degraded">Degraded</option>
                  <option value="critical">Critical</option>
                </select>

                {/* Count */}
                <Badge variant="outline" className="h-9 px-3 gap-1.5 text-xs">
                  <Filter className="h-3.5 w-3.5" />
                  {(() => {
                    const filtered = services.filter((svc) => {
                      if (searchQuery) {
                        const q = searchQuery.toLowerCase();
                        if (!svc.name.toLowerCase().includes(q) &&
                            !svc.type.toLowerCase().includes(q) &&
                            !svc.namespace.toLowerCase().includes(q)) return false;
                      }
                      if (typeFilter !== "all" && svc.type !== typeFilter) return false;
                      if (namespaceFilter !== "all" && svc.namespace !== namespaceFilter) return false;
                      if (statusFilter !== "all" && svc.status !== statusFilter) return false;
                      return true;
                    });
                    return `${filtered.length} of ${services.length}`;
                  })()}
                </Badge>
              </div>
            </div>

            {(() => {
              const filtered = services.filter((svc) => {
                if (searchQuery) {
                  const q = searchQuery.toLowerCase();
                  if (!svc.name.toLowerCase().includes(q) &&
                      !svc.type.toLowerCase().includes(q) &&
                      !svc.namespace.toLowerCase().includes(q)) return false;
                }
                if (typeFilter !== "all" && svc.type !== typeFilter) return false;
                if (namespaceFilter !== "all" && svc.namespace !== namespaceFilter) return false;
                if (statusFilter !== "all" && svc.status !== statusFilter) return false;
                return true;
              });

              if (filtered.length === 0) {
                return (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-8 gap-2">
                      <Search className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No resources match your filters</p>
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          setSearchQuery("");
                          setTypeFilter("all");
                          setNamespaceFilter("all");
                          setStatusFilter("all");
                        }}
                      >
                        Clear all filters
                      </button>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filtered.map((service) => (
                    <ServiceCard key={service.id} service={service} />
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Loading State ── */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-24 mb-3" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Empty State ── */}
        {!loading && services.length === 0 && !error && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
              <Cloud className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No AWS resources were discovered. Make sure your credentials have the right permissions.
              </p>
              <Badge variant="outline" className="cursor-pointer px-4 py-2 text-sm">
                <Link href="/settings">Check Credentials</Link>
              </Badge>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}