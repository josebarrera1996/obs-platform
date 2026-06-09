"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { MainLayout } from "@/components/MainLayout";
import { useProductStore } from "@/store/products";
import { useSettingsStore } from "@/store/settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  RefreshCw,
  Server,
  Database,
  Network,
  Globe,
  Zap,
  Container,
  Box,
  MessageSquare,
  Search,
  X,
  Filter,
  Layers,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Plus,
  Check,
  ListPlus,
  Loader2,
  Trash2,
  Cpu,
  Gauge,
  MemoryStick,
  TrendingUp,
  BarChart3,
  Clock,
  Wifi,
  HardDrive,
} from "lucide-react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/Skeleton";

// ── Types ──
interface DiscoveredService {
  id: string;
  name: string;
  type: string;
  namespace: string;
  region: string;
  status: string;
  metrics: { name: string; unit: string }[];
}

interface MetricPoint {
  timestamp: string;
  value: number;
}

interface MetricResult {
  metricName: string;
  stat: string;
  unit: string;
  data: MetricPoint[];
}

interface ServiceStatus {
  id: string;
  name: string;
  namespace: string;
  type: string;
  status: string;
  region: string;
  metricData: MetricResult[];
  cpu: number;
  memory: number;
  latency: number;
  errorRate: number;
}

// ── Constants ──
const SERVICE_ICONS: Record<string, React.ElementType> = {
  EC2: Server,
  RDS: Database,
  Lambda: Zap,
  ECS: Container,
  DynamoDB: Database,
  S3: Globe,
  ElastiCache: Box,
  SQS: MessageSquare,
  SNS: MessageSquare,
};

const CHART_COLORS = ["#6366f1", "#f97316", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4"];

function getHealthColor(status: string): string {
  switch (status) {
    case "healthy": return "text-emerald-500";
    case "degraded": return "text-amber-500";
    case "critical": return "text-red-500";
    default: return "text-muted-foreground";
  }
}

function getHealthBg(status: string): string {
  switch (status) {
    case "healthy": return "bg-emerald-500/10 border-emerald-500/25";
    case "degraded": return "bg-amber-500/10 border-amber-500/25";
    case "critical": return "bg-red-500/10 border-red-500/25";
    default: return "bg-muted/50 border-border";
  }
}

function getServiceIcon(type: string) {
  return SERVICE_ICONS[type] || Server;
}

function formatMetricValue(value: number, unit: string): string {
  if (unit === "Percent" || unit.includes("Percent")) return `${value.toFixed(1)}%`;
  if (unit === "Count" || unit === "Bytes") {
    if (unit === "Bytes") {
      if (value < 1024) return `${value.toFixed(0)} B`;
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
      return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }
    return value.toFixed(0);
  }
  if (unit === "Seconds" || unit === "Milliseconds" || unit === "Microseconds") {
    if (value < 0.001) return `${(value * 1_000_000).toFixed(0)} μs`;
    if (value < 1) return `${(value * 1_000).toFixed(1)} ms`;
    return `${value.toFixed(2)} s`;
  }
  return `${value.toFixed(1)} ${unit}`;
}

function getMetricColor(value: number, metric: string): string {
  if (metric === "errorRate" || metric === "latency") {
    if (value > 5) return "text-red-500";
    if (value > 1) return "text-amber-500";
    return "text-emerald-500";
  }
  if (value > 80) return "text-red-500";
  if (value > 50) return "text-amber-500";
  return "text-emerald-500";
}

function getMetricBg(value: number, metric: string): string {
  if (metric === "errorRate" || metric === "latency") {
    if (value > 5) return "bg-red-500/10";
    if (value > 1) return "bg-amber-500/10";
    return "bg-emerald-500/10";
  }
  if (value > 80) return "bg-red-500/10";
  if (value > 50) return "bg-amber-500/10";
  return "bg-emerald-500/10";
}

const METRIC_CONFIG = [
  {
    key: "cpu" as const,
    label: "Avg CPU",
    icon: Cpu,
    unit: "Percent",
    color: "#6366f1",
    bgColor: "bg-indigo-500/10",
    textColor: "text-indigo-500",
  },
  {
    key: "memory" as const,
    label: "Avg Memory",
    icon: MemoryStick,
    unit: "Percent",
    color: "#10b981",
    bgColor: "bg-emerald-500/10",
    textColor: "text-emerald-500",
  },
  {
    key: "latency" as const,
    label: "Avg Latency",
    icon: Clock,
    unit: "Microseconds",
    color: "#f97316",
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-500",
  },
  {
    key: "errorRate" as const,
    label: "Error Rate",
    icon: TrendingUp,
    unit: "Percent",
    color: "#ef4444",
    bgColor: "bg-red-500/10",
    textColor: "text-red-500",
  },
];

export default function ProductPage() {
  const params = useParams();
  const { getProduct, toggleResource, removeResourceFromProduct } = useProductStore();
  const product = getProduct(params.id as string);
  const { activeCredentialId } = useSettingsStore();

  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState("24h");

  // Resource management dialog
  const [showResourceDialog, setShowResourceDialog] = useState(false);
  const [allServices, setAllServices] = useState<DiscoveredService[]>([]);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceSearch, setResourceSearch] = useState("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("all");

  // Compute derived metrics
  const totalResources = product?.resources.length ?? 0;
  const healthyCount = services.filter((s) => s.status === "healthy").length;
  const degradedCount = services.filter((s) => s.status === "degraded").length;
  const criticalCount = services.filter((s) => s.status === "critical").length;

  const avgCpu = services.length > 0
    ? services.reduce((sum, s) => sum + s.cpu, 0) / services.length
    : 0;
  const avgMemory = services.length > 0
    ? services.reduce((sum, s) => sum + s.memory, 0) / services.length
    : 0;
  const avgLatency = services.length > 0
    ? services.reduce((sum, s) => sum + s.latency, 0) / services.length
    : 0;
  const avgErrorRate = services.length > 0
    ? services.reduce((sum, s) => sum + s.errorRate, 0) / services.length
    : 0;

  // ── Fetch services with real CloudWatch metrics ──
  const fetchServices = useCallback(async () => {
    if (!product || !activeCredentialId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      const serviceIds = product.resources.map((r) => r.serviceId);
      if (serviceIds.length === 0) {
        setServices([]);
        setLoading(false);
        return;
      }

      // Step 1: Fetch service metadata from /api/aws/services
      const res = await fetch(
        `/api/aws/services?credentialId=${activeCredentialId}&ids=${serviceIds.join(",")}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const assignedIds = new Set(product.resources.map((r) => r.serviceId));

      const svcMeta = (data.services || [])
        .filter((s: any) => assignedIds.has(s.id))
        .map((s: any) => ({
          id: s.id,
          name: s.name,
          namespace: s.namespace,
          type: s.type,
          status: s.status,
          region: s.region,
          metrics: s.metrics || [],
        }));

      // Step 2: Fetch actual CloudWatch metrics via POST
      let metricResults: { serviceId: string; metrics: MetricResult[] }[] = [];
      try {
        const metricsRes = await fetch("/api/aws/metrics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            services: svcMeta.map((s: { id: string; namespace: string; type: string; name: string }) => ({
              id: s.id,
              namespace: s.namespace,
              type: s.type,
              name: s.name,
            })),
            timeRange,
            stats: ["Average"],
          }),
        });
        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          metricResults = metricsData.results || [];
        }
      } catch {
        // Metrics fetch is optional — fall back to defaults
      }

      // Step 3: Map everything together with computed metric values
      const svcs: ServiceStatus[] = svcMeta.map((s: any) => {
        const svcMetrics = metricResults.find((m) => m.serviceId === s.id);

        let cpu = 0;
        let memory = 0;
        let latency = 0;
        let errorRate = 0;

        if (svcMetrics?.metrics) {
          svcMetrics.metrics.forEach((m: MetricResult) => {
            const avg = m.data?.length
              ? m.data.reduce((sum, p) => sum + p.value, 0) / m.data.length
              : 0;

            // Map metric names to our indicators based on service type
            if (/cpu/i.test(m.metricName)) cpu = avg;
            else if (/memory|mem/i.test(m.metricName)) memory = avg;
            else if (/latency|duration|responsetime|rt/i.test(m.metricName)) latency = avg;
            else if (/error|throttle/i.test(m.metricName)) errorRate = avg;

            // Type-specific mappings
            if (s.type === "Lambda") {
              if (m.metricName === "Duration") latency = avg;
              if (m.metricName === "Errors") errorRate = avg;
            }
            if (s.type === "ECS") {
              if (m.metricName === "CPUUtilization") cpu = avg;
              if (m.metricName === "MemoryUtilization") memory = avg;
            }
            if (s.type === "RDS" || s.type === "EC2") {
              if (m.metricName === "CPUUtilization") cpu = avg;
              if (m.metricName === "DatabaseConnections") memory = avg / 100; // normalize
            }
            if (s.type === "S3") {
              if (m.metricName === "AllRequests") errorRate = avg > 1000 ? avg / 10000 : 0;
            }
          });
        }

        return {
          id: s.id,
          name: s.name,
          namespace: s.namespace,
          type: s.type,
          status: s.status,
          region: s.region,
          metricData: svcMetrics?.metrics || [],
          cpu,
          memory,
          latency,
          errorRate,
        };
      });

      setServices(svcs);
    } catch (err) {
      console.error("Failed to fetch services:", err);
      setFetchError(err instanceof Error ? err.message : "Failed to load services");
    } finally {
      setLoading(false);
    }
  }, [product, activeCredentialId, timeRange]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // Fetch all resources (for assign dialog)
  const fetchAllResources = useCallback(async () => {
    if (!activeCredentialId) return;
    setResourceLoading(true);
    try {
      const res = await fetch(`/api/aws/services?credentialId=${activeCredentialId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAllServices(data.services || []);
    } catch (err) {
      console.error("Failed to fetch all resources:", err);
    } finally {
      setResourceLoading(false);
    }
  }, [activeCredentialId]);

  useEffect(() => {
    if (showResourceDialog) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchAllResources();
    }
  }, [showResourceDialog, fetchAllResources]);

  const filteredServices = services.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.type.toLowerCase().includes(q) ||
      s.namespace.toLowerCase().includes(q) ||
      s.region.toLowerCase().includes(q)
    );
  });

  // Filter resources for the assign dialog
  const filteredResources = allServices.filter((s) => {
    if (resourceSearch) {
      const q = resourceSearch.toLowerCase();
      if (
        !s.name.toLowerCase().includes(q) &&
        !s.id.toLowerCase().includes(q) &&
        !s.type.toLowerCase().includes(q) &&
        !s.namespace.toLowerCase().includes(q) &&
        !s.region.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    if (resourceTypeFilter !== "all" && s.type !== resourceTypeFilter) {
      return false;
    }
    return true;
  });

  const resourceTypes = ["all", ...new Set(allServices.map((s) => s.type))];

  // Check if a service is assigned to this product
  const isResourceAssigned = (serviceId: string) => {
    return product?.resources.some((r) => r.serviceId === serviceId) ?? false;
  };

  // Handle toggling a resource
  const handleToggleResource = (svc: DiscoveredService) => {
    if (!product) return;
    toggleResource(product.id, {
      serviceId: svc.id,
      serviceName: svc.name,
      namespace: svc.namespace,
      type: svc.type,
      region: svc.region,
    });
  };

  // Handle removing a resource
  const handleRemoveResource = (serviceId: string) => {
    if (!product) return;
    removeResourceFromProduct(product.id, serviceId);
  };

  if (!product) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertTriangle className="h-12 w-12 text-muted-foreground/40" />
          <h2 className="text-xl font-semibold">Product not found</h2>
          <p className="text-sm text-muted-foreground">
            The product you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link href="/products">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Products
            </Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/products">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: product.color }} />
                <h1 className="text-lg font-semibold tracking-tight">{product.name}</h1>
              </div>
              {product.description && (
                <p className="text-xs text-muted-foreground mt-0.5 ml-5">{product.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={(val) => val !== null && (setTimeRange(val), fetchServices())}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last hour</SelectItem>
                <SelectItem value="6h">Last 6 hours</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
              </SelectContent>
            </Select>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={fetchServices} disabled={loading}>
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh metrics</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button variant="default" size="sm" className="h-8 gap-1.5" onClick={() => setShowResourceDialog(true)}>
              <ListPlus className="h-3.5 w-3.5" />
              Manage Resources
            </Button>
          </div>
        </div>
      </div>

      {/* ── Status KPIs ── */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalResources}</p>
              <p className="text-xs text-muted-foreground">Total Resources</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-500">{healthyCount}</p>
              <p className="text-xs text-muted-foreground">Healthy</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <MinusCircle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-500">{degradedCount}</p>
              <p className="text-xs text-muted-foreground">Degraded</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">{criticalCount}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Aggregate Metrics ── */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {METRIC_CONFIG.map((metric) => {
          const Icon = metric.icon;
          let value: number;
          if (metric.key === "cpu") value = avgCpu;
          else if (metric.key === "memory") value = avgMemory;
          else if (metric.key === "latency") value = avgLatency;
          else value = avgErrorRate;

          const colorClass = services.length > 0 ? getMetricColor(value, metric.key) : "text-muted-foreground";
          const bgClass = services.length > 0 ? getMetricBg(value, metric.key) : "bg-muted/30";

          return (
            <Card key={metric.key} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-8 w-8 rounded-lg ${bgClass} flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 ${colorClass}`} />
                  </div>
                  <span className="text-xs text-muted-foreground">{metric.label}</span>
                </div>
                <p className={`text-xl font-bold ${colorClass}`}>
                  {services.length > 0 ? formatMetricValue(value, metric.unit) : "—"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Search Bar ── */}
      {totalResources > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search resources..."
              className="h-9 pl-8 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Badge variant="outline" className="h-9 px-3 text-xs gap-1.5">
            <Filter className="h-3 w-3" />
            {filteredServices.length} of {services.length}
          </Badge>
        </div>
      )}

      {/* ── Loading State ── */}
      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-64 mb-2" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <div className="flex gap-4 mt-3 pt-3 border-t border-border/50">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Error State ── */}
      {fetchError && !loading && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-500">Failed to load metrics</p>
              <p className="text-xs text-red-500/70 mt-0.5">{fetchError}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchServices}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Empty State ── */}
      {!loading && !fetchError && totalResources === 0 && (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
              <Layers className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold">No resources assigned</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Assign AWS resources to this product to see their CloudWatch metrics and health status.
              </p>
            </div>
            <Button variant="default" size="sm" onClick={() => setShowResourceDialog(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Assign Resources
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Resource Cards ── */}
      {!loading && totalResources > 0 && filteredServices.length === 0 && (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Search className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-base font-medium">No resources match your search</p>
            <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
              Clear Search
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && filteredServices.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {filteredServices.map((svc) => {
            const Icon = getServiceIcon(svc.type);
            const sparklineData = svc.metricData
              ?.find((m) => m.data?.length > 0)
              ?.data?.slice(-20) ?? [];
            const hasSparkline = sparklineData.length > 1;

            return (
              <div key={svc.id} className="group relative">
                <Link href={`/service-detail?id=${svc.id}`} className="block">
                  <Card
                    className={`transition-all duration-200 hover:shadow-md hover:border-primary/30 cursor-pointer overflow-hidden ${getHealthBg(svc.status)}`}
                  >
                    <CardContent className="p-0">
                      {/* Top section: icon + info + status */}
                      <div className="p-4 pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={`h-10 w-10 rounded-lg ${getHealthBg(svc.status)} flex items-center justify-center flex-shrink-0`}>
                              <Icon className={`h-5 w-5 ${getHealthColor(svc.status)}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <p className="text-sm font-semibold truncate max-w-[280px]">{svc.name}</p>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" align="start">
                                    <p className="text-xs font-mono">{svc.name}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {svc.type} · {svc.namespace} · {svc.region}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-2 py-0 h-5 ml-2 flex-shrink-0 ${getHealthColor(svc.status)} ${getHealthBg(svc.status)}`}
                          >
                            {svc.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Sparkline chart */}
                      {hasSparkline && (
                        <div className="h-10 mx-4 mb-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={sparklineData}>
                              <defs>
                                <linearGradient id={`sparkGrad-${svc.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.2} />
                                  <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <Area
                                type="monotone"
                                dataKey="value"
                                stroke={CHART_COLORS[0]}
                                strokeWidth={1.5}
                                fill={`url(#sparkGrad-${svc.id})`}
                                dot={false}
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* Metrics row */}
                      <div className="px-4 pb-3 pt-1">
                        <div className="grid grid-cols-4 gap-1">
                          <div className="flex flex-col items-center p-1.5 rounded-md bg-background/50">
                            <Cpu className={`h-3 w-3 ${getMetricColor(svc.cpu, "cpu")} mb-0.5`} />
                            <span className={`text-[11px] font-medium ${getMetricColor(svc.cpu, "cpu")}`}>
                              {formatMetricValue(svc.cpu, "Percent")}
                            </span>
                          </div>
                          <div className="flex flex-col items-center p-1.5 rounded-md bg-background/50">
                            <MemoryStick className={`h-3 w-3 ${getMetricColor(svc.memory, "memory")} mb-0.5`} />
                            <span className={`text-[11px] font-medium ${getMetricColor(svc.memory, "memory")}`}>
                              {formatMetricValue(svc.memory, "Percent")}
                            </span>
                          </div>
                          <div className="flex flex-col items-center p-1.5 rounded-md bg-background/50">
                            <Clock className={`h-3 w-3 ${getMetricColor(svc.latency, "latency")} mb-0.5`} />
                            <span className={`text-[11px] font-medium ${getMetricColor(svc.latency, "latency")}`}>
                              {formatMetricValue(svc.latency, "Microseconds")}
                            </span>
                          </div>
                          <div className="flex flex-col items-center p-1.5 rounded-md bg-background/50">
                            <TrendingUp className={`h-3 w-3 ${getMetricColor(svc.errorRate, "errorRate")} mb-0.5`} />
                            <span className={`text-[11px] font-medium ${getMetricColor(svc.errorRate, "errorRate")}`}>
                              {formatMetricValue(svc.errorRate, "Percent")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                {/* Remove button */}
                <button
                  className="absolute top-2 right-2 h-6 w-6 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 hover:border-red-500/30 z-10"
                  onClick={(e) => {
                    e.preventDefault();
                    handleRemoveResource(svc.id);
                  }}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Resource Management Dialog ── */}
      <Dialog open={showResourceDialog} onOpenChange={setShowResourceDialog}>
        <DialogContent className="w-auto min-w-[600px] max-w-[90vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Resources</DialogTitle>
            <DialogDescription>
              Assign or remove AWS resources for {product.name}
            </DialogDescription>
          </DialogHeader>

          {/* Search + filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search resources by name, type, or region..."
                className="h-9 pl-8 text-sm"
                value={resourceSearch}
                onChange={(e) => setResourceSearch(e.target.value)}
              />
            </div>
            <Select value={resourceTypeFilter} onValueChange={(val) => val !== null && setResourceTypeFilter(val)}>
              <SelectTrigger className="w-28 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {resourceTypes.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {t === "all" ? "All Types" : t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resource list */}
          <div className="flex-1 overflow-y-auto min-h-[300px]">
            {resourceLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {resourceSearch || resourceTypeFilter !== "all"
                    ? "No resources match your filters"
                    : "No AWS resources discovered"}
                </p>
              </div>
            ) : (
              <div className="space-y-1 py-2">
                {filteredResources.map((svc) => {
                  const assigned = isResourceAssigned(svc.id);
                  const Icon = getServiceIcon(svc.type);
                  return (
                    <div
                      key={svc.id}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        assigned
                          ? "bg-primary/5 border border-primary/20"
                          : "hover:bg-muted/50 border border-transparent"
                      }`}
                    >
                      <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <p className="text-sm font-medium truncate">{svc.name}</p>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="start">
                              <p className="text-xs font-mono">{svc.id}</p>
                              <p className="text-xs text-muted-foreground">{svc.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <p className="text-xs text-muted-foreground">
                          {svc.type} · {svc.namespace} · {svc.region}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-2 py-0 h-5 flex-shrink-0"
                      >
                        {svc.type}
                      </Badge>
                      <Button
                        variant={assigned ? "default" : "outline"}
                        size="sm"
                        className="h-8 shrink-0"
                        onClick={() => handleToggleResource(svc)}
                      >
                        {assigned ? (
                          <>
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Assigned
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Assign
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between border-t border-border/50 pt-4">
            <div className="text-xs text-muted-foreground">
              {allServices.length} resources total · {product.resources.length} assigned
            </div>
            <Button variant="outline" onClick={() => setShowResourceDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
