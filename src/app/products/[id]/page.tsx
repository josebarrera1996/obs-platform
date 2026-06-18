"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { MainLayout } from "@/components/MainLayout";
import { useProductStore } from "@/store/products";
import { useSettingsStore } from "@/store/settings";
import { Card, CardContent } from "@/components/ui/card";
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
  AlertTriangle,
  RefreshCw,
  Server,
  Database,
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
  ChevronRight,
  LayoutDashboard,
  Cpu,
  HardDrive,
  Activity,
  Network,
  Clock,
  Hash,
  ArrowDownToLine,
  ArrowUpFromLine,
  Gauge,
  Boxes,
  FolderTree,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/Skeleton";
import { MetricPanel, PRODUCT_COLORS } from "@/types/products";
import type { Product, ResourceGroup } from "@/types/products";

// ── Types ──────────────────────────────────────────────────────────────────
interface DiscoveredService {
  id: string;
  name: string;
  type: string;
  namespace: string;
  region: string;
  status: string;
  metrics: { name: string; unit: string }[];
  dimensions?: Record<string, string>;
}

interface ServiceStatus {
  id: string;
  name: string;
  namespace: string;
  type: string;
  status: string;
  region: string;
  metrics: { name: string; unit: string }[];
  dimensions?: Record<string, string>;
}

interface MetricPreviewItem {
  id: string;
  label: string;
  icon: React.ElementType;
  colorClass: string;
  configured: boolean;
  stat?: string;
}

interface DimensionPreviewItem {
  key: string;
  label: string;
  value: string;
  icon: React.ElementType;
}

// ── Constants ───────────────────────────────────────────────────────────────
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

const TYPE_ICON_STYLES: Record<string, string> = {
  ECS: "bg-cyan-500/15 text-cyan-500 ring-cyan-500/20",
  EC2: "bg-orange-500/15 text-orange-500 ring-orange-500/20",
  RDS: "bg-blue-500/15 text-blue-500 ring-blue-500/20",
  Lambda: "bg-violet-500/15 text-violet-500 ring-violet-500/20",
  DynamoDB: "bg-amber-500/15 text-amber-500 ring-amber-500/20",
  S3: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/20",
  ElastiCache: "bg-red-500/15 text-red-500 ring-red-500/20",
  SQS: "bg-pink-500/15 text-pink-500 ring-pink-500/20",
  SNS: "bg-indigo-500/15 text-indigo-500 ring-indigo-500/20",
};

const METRIC_PREVIEW: Record<string, { icon: React.ElementType; label: string; colorClass: string }> = {
  CPUUtilization: { icon: Cpu, label: "CPU", colorClass: "text-indigo-500 bg-indigo-500/10 ring-indigo-500/20" },
  MemoryUtilization: { icon: HardDrive, label: "Memory", colorClass: "text-orange-500 bg-orange-500/10 ring-orange-500/20" },
  RunningTaskCount: { icon: Layers, label: "Running tasks", colorClass: "text-emerald-500 bg-emerald-500/10 ring-emerald-500/20" },
  PendingTaskCount: { icon: Loader2, label: "Pending tasks", colorClass: "text-amber-500 bg-amber-500/10 ring-amber-500/20" },
  NetworkIn: { icon: ArrowDownToLine, label: "Network in", colorClass: "text-cyan-500 bg-cyan-500/10 ring-cyan-500/20" },
  NetworkOut: { icon: ArrowUpFromLine, label: "Network out", colorClass: "text-sky-500 bg-sky-500/10 ring-sky-500/20" },
  Invocations: { icon: Zap, label: "Invocations", colorClass: "text-violet-500 bg-violet-500/10 ring-violet-500/20" },
  Errors: { icon: XCircle, label: "Errors", colorClass: "text-red-500 bg-red-500/10 ring-red-500/20" },
  Duration: { icon: Clock, label: "Duration", colorClass: "text-blue-500 bg-blue-500/10 ring-blue-500/20" },
  Throttles: { icon: Gauge, label: "Throttles", colorClass: "text-amber-500 bg-amber-500/10 ring-amber-500/20" },
  DatabaseConnections: { icon: Database, label: "Connections", colorClass: "text-blue-500 bg-blue-500/10 ring-blue-500/20" },
  FreeableMemory: { icon: HardDrive, label: "Free memory", colorClass: "text-orange-500 bg-orange-500/10 ring-orange-500/20" },
  RequestCount: { icon: Activity, label: "Requests", colorClass: "text-emerald-500 bg-emerald-500/10 ring-emerald-500/20" },
  TargetResponseTime: { icon: Clock, label: "Response time", colorClass: "text-violet-500 bg-violet-500/10 ring-violet-500/20" },
  ActiveConnectionCount: { icon: Network, label: "Connections", colorClass: "text-cyan-500 bg-cyan-500/10 ring-cyan-500/20" },
  ConsumedReadCapacityUnits: { icon: Hash, label: "Read capacity", colorClass: "text-indigo-500 bg-indigo-500/10 ring-indigo-500/20" },
  ConsumedWriteCapacityUnits: { icon: Hash, label: "Write capacity", colorClass: "text-pink-500 bg-pink-500/10 ring-pink-500/20" },
  DiskReadOps: { icon: Activity, label: "Disk read", colorClass: "text-indigo-500 bg-indigo-500/10 ring-indigo-500/20" },
  DiskWriteOps: { icon: Activity, label: "Disk write", colorClass: "text-orange-500 bg-orange-500/10 ring-orange-500/20" },
  StatusCheckFailed: { icon: AlertTriangle, label: "Status check", colorClass: "text-red-500 bg-red-500/10 ring-red-500/20" },
};

const DIMENSION_PREVIEW: Record<string, { icon: React.ElementType; label: string }> = {
  ClusterName: { icon: Layers, label: "Cluster" },
  ServiceName: { icon: Container, label: "Service" },
  InstanceId: { icon: Server, label: "Instance" },
  FunctionName: { icon: Zap, label: "Function" },
  DBInstanceIdentifier: { icon: Database, label: "Database" },
  LoadBalancer: { icon: Network, label: "Load balancer" },
  TargetGroup: { icon: Boxes, label: "Target group" },
  QueueName: { icon: MessageSquare, label: "Queue" },
  TopicName: { icon: MessageSquare, label: "Topic" },
  TableName: { icon: Database, label: "Table" },
  CacheClusterId: { icon: Box, label: "Cache" },
  BucketName: { icon: Globe, label: "Bucket" },
};

const DIMENSION_ORDER = [
  "ClusterName",
  "ServiceName",
  "InstanceId",
  "FunctionName",
  "DBInstanceIdentifier",
  "LoadBalancer",
  "TargetGroup",
  "QueueName",
  "TopicName",
  "TableName",
  "CacheClusterId",
  "BucketName",
];

function getHealthColor(status: string) {
  switch (status) {
    case "healthy": return "text-emerald-500";
    case "degraded": return "text-amber-500";
    case "critical": return "text-red-500";
    default: return "text-muted-foreground";
  }
}

function getHealthBg(status: string) {
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

function getTypeIconStyle(type: string) {
  return TYPE_ICON_STYLES[type] || "bg-primary/10 text-primary ring-primary/20";
}

function getStatusDot(status: string) {
  switch (status) {
    case "healthy": return "bg-emerald-500";
    case "degraded": return "bg-amber-500";
    case "critical": return "bg-red-500";
    default: return "bg-muted-foreground";
  }
}

function getMetricPreview(metricName: string) {
  return (
    METRIC_PREVIEW[metricName] ?? {
      icon: Activity,
      label: metricName.replace(/([A-Z])/g, " $1").trim(),
      colorClass: "text-muted-foreground bg-muted/50 ring-border/40",
    }
  );
}

function getDisplayTitle(name: string, type: string) {
  const prefix = `${type}: `;
  if (name.startsWith(prefix)) return name.slice(prefix.length);
  return name;
}

function buildDimensionPreview(
  dimensions: Record<string, string> | undefined
): DimensionPreviewItem[] {
  if (!dimensions) return [];
  const entries = Object.entries(dimensions).filter(([, v]) => v);
  entries.sort(([a], [b]) => {
    const ai = DIMENSION_ORDER.indexOf(a);
    const bi = DIMENSION_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  return entries.map(([key, value]) => {
    const cfg = DIMENSION_PREVIEW[key] ?? { icon: Hash, label: key };
    return { key, label: cfg.label, value, icon: cfg.icon };
  });
}

function buildMetricPreview(
  panels: MetricPanel[] | undefined,
  availableMetrics: { name: string; unit: string }[]
): MetricPreviewItem[] {
  if (panels && panels.length > 0) {
    return panels.map((panel) => {
      const cfg = getMetricPreview(panel.metricName);
      return {
        id: panel.id,
        label: panel.title || cfg.label,
        icon: cfg.icon,
        colorClass: cfg.colorClass,
        configured: true,
        stat: panel.stat,
      };
    });
  }
  return availableMetrics.slice(0, 4).map((m) => {
    const cfg = getMetricPreview(m.name);
    return {
      id: m.name,
      label: cfg.label,
      icon: cfg.icon,
      colorClass: cfg.colorClass,
      configured: false,
    };
  });
}

function getGroupedSections(
  product: Product,
  filtered: ServiceStatus[]
): { group: ResourceGroup | null; services: ServiceStatus[] }[] {
  const groups = product.resourceGroups ?? [];
  const byGroup = new Map<string, ServiceStatus[]>();
  const ungrouped: ServiceStatus[] = [];

  for (const svc of filtered) {
    const resource = product.resources.find((r) => r.serviceId === svc.id);
    const groupId = resource?.groupId;
    if (groupId && groups.some((g) => g.id === groupId)) {
      if (!byGroup.has(groupId)) byGroup.set(groupId, []);
      byGroup.get(groupId)!.push(svc);
    } else {
      ungrouped.push(svc);
    }
  }

  const sections: { group: ResourceGroup | null; services: ServiceStatus[] }[] = [];
  for (const group of groups) {
    const svcs = byGroup.get(group.id) ?? [];
    if (svcs.length > 0) sections.push({ group, services: svcs });
  }
  if (ungrouped.length > 0) sections.push({ group: null, services: ungrouped });
  return sections;
}

// ── Component ───────────────────────────────────────────────────────────────
export default function ProductPage() {
  const params = useParams();
  const {
    getProduct,
    toggleResource,
    removeResourceFromProduct,
    addResourceGroup,
    updateResourceGroup,
    deleteResourceGroup,
    assignResourceToGroup,
  } = useProductStore();
  const product = getProduct(params.id as string);
  const { activeCredentialId } = useSettingsStore();

  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [showResourceDialog, setShowResourceDialog] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(PRODUCT_COLORS[0]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [allServices, setAllServices] = useState<DiscoveredService[]>([]);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceSearch, setResourceSearch] = useState("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("all");

  // ── Derived ──
  const totalResources = product?.resources.length ?? 0;
  const healthyCount = services.filter((s) => s.status === "healthy").length;
  const degradedCount = services.filter((s) => s.status === "degraded").length;
  const criticalCount = services.filter((s) => s.status === "critical").length;

  // ── Fetch service status ──
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

      const res = await fetch(
        `/api/aws/services?credentialId=${activeCredentialId}&ids=${serviceIds.join(",")}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const assignedIds = new Set(product.resources.map((r) => r.serviceId));

      setServices(
        (data.services || [])
          .filter((s: { id: string }) => assignedIds.has(s.id))
          .map((s: DiscoveredService) => ({
            id: s.id,
            name: s.name,
            namespace: s.namespace,
            type: s.type,
            status: s.status || "unknown",
            region: s.region,
            metrics: s.metrics ?? [],
            dimensions: s.dimensions,
          }))
      );
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load services");
    } finally {
      setLoading(false);
    }
  }, [product, activeCredentialId]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // ── Fetch all resources (assign dialog) ──
  const fetchAllResources = useCallback(async () => {
    if (!activeCredentialId) return;
    setResourceLoading(true);
    try {
      const res = await fetch(`/api/aws/services?credentialId=${activeCredentialId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAllServices(data.services || []);
    } catch {
      // ignore
    } finally {
      setResourceLoading(false);
    }
  }, [activeCredentialId]);

  useEffect(() => {
    if (showResourceDialog) fetchAllResources();
  }, [showResourceDialog, fetchAllResources]);

  const handleToggleResource = (svc: DiscoveredService) => {
    if (!product) return;
    toggleResource(product.id, {
      serviceId: svc.id,
      serviceName: svc.name,
      namespace: svc.namespace,
      type: svc.type,
      region: svc.region,
      dimensions: svc.dimensions,
    });
  };

  const handleRemoveResource = (serviceId: string) => {
    if (!product) return;
    removeResourceFromProduct(product.id, serviceId);
  };

  const handleCreateGroup = () => {
    if (!product || !newGroupName.trim()) return;
    addResourceGroup(product.id, newGroupName.trim(), newGroupColor);
    setNewGroupName("");
    setNewGroupColor(PRODUCT_COLORS[(product.resourceGroups?.length ?? 0) % PRODUCT_COLORS.length]);
  };

  const handleSaveGroupRename = (groupId: string) => {
    if (!product || !editingGroupName.trim()) return;
    updateResourceGroup(product.id, groupId, { name: editingGroupName.trim() });
    setEditingGroupId(null);
    setEditingGroupName("");
  };

  const resourceGroups = product?.resourceGroups ?? [];

  // ── Filters ──
  const filteredServices = services.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const resource = product?.resources.find((r) => r.serviceId === s.id);
    const group = resourceGroups.find((g) => g.id === resource?.groupId);
    return (
      s.name.toLowerCase().includes(q) ||
      s.type.toLowerCase().includes(q) ||
      s.namespace.toLowerCase().includes(q) ||
      (group?.name.toLowerCase().includes(q) ?? false)
    );
  });

  const groupedSections = product ? getGroupedSections(product, filteredServices) : [];

  const filteredResources = allServices.filter((s) => {
    if (resourceSearch) {
      const q = resourceSearch.toLowerCase();
      if (
        !s.name.toLowerCase().includes(q) &&
        !s.id.toLowerCase().includes(q) &&
        !s.type.toLowerCase().includes(q) &&
        !s.namespace.toLowerCase().includes(q)
      ) return false;
    }
    if (resourceTypeFilter !== "all" && s.type !== resourceTypeFilter) return false;
    return true;
  });

  const resourceTypes = ["all", ...new Set(allServices.map((s) => s.type))];

  const isResourceAssigned = (serviceId: string) =>
    product?.resources.some((r) => r.serviceId === serviceId) ?? false;

  if (!product) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertTriangle className="h-12 w-12 text-muted-foreground/40" />
          <h2 className="text-xl font-semibold">Product not found</h2>
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={fetchServices} disabled={loading}>
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setShowGroupDialog(true)}
            >
              <FolderTree className="h-3.5 w-3.5" />
              Manage Groups
            </Button>
            <Button variant="default" size="sm" className="h-8 gap-1.5" onClick={() => setShowResourceDialog(true)}>
              <ListPlus className="h-3.5 w-3.5" />
              Manage Resources
            </Button>
          </div>
        </div>
      </div>

      {/* ── Status KPIs ── */}
      <div className="grid grid-cols-4 gap-3 mb-6">
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

      {/* ── Loading ── */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-14 w-14 rounded-xl flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
                <div className="space-y-2 pt-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-8 w-full rounded-lg" />
                  <Skeleton className="h-8 w-full rounded-lg" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-20 rounded-lg" />
                  <Skeleton className="h-10 w-20 rounded-lg" />
                  <Skeleton className="h-10 w-20 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Error ── */}
      {fetchError && !loading && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-500">Failed to load services</p>
              <p className="text-xs text-red-500/70 mt-0.5">{fetchError}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchServices}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Empty state ── */}
      {!loading && !fetchError && totalResources === 0 && (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
              <Layers className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold">No resources assigned</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Assign AWS resources to this product to start monitoring their health.
              </p>
            </div>
            <Button variant="default" size="sm" onClick={() => setShowResourceDialog(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Assign Resources
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Resource Tiles ── */}
      {!loading && totalResources > 0 && (
        <div>
          {filteredServices.length === 0 && searchQuery ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
                <Search className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-base font-medium">No resources match your search</p>
                <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                  Clear Search
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {groupedSections.map(({ group, services: sectionServices }) => {
                const healthyInSection = sectionServices.filter((s) => s.status === "healthy").length;
                const showUngroupedHeader = !group && resourceGroups.length > 0;

                return (
                  <section key={group?.id ?? "__ungrouped"}>
                    {(group || showUngroupedHeader) && (
                      <div className="flex items-center gap-3 mb-4">
                        {group ? (
                          <>
                            <div
                              className="h-3 w-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: group.color ?? product.color }}
                            />
                            <h2 className="text-base font-semibold tracking-tight">{group.name}</h2>
                          </>
                        ) : (
                          <>
                            <FolderTree className="h-4 w-4 text-muted-foreground" />
                            <h2 className="text-base font-semibold tracking-tight text-muted-foreground">
                              Ungrouped
                            </h2>
                          </>
                        )}
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {sectionServices.length}{" "}
                          {sectionServices.length === 1 ? "resource" : "resources"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {healthyInSection}/{sectionServices.length} healthy
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sectionServices.map((svc) => {
                const Icon = getServiceIcon(svc.type);
                const resource = product.resources.find((r) => r.serviceId === svc.id);
                const panels = resource?.panels ?? [];
                const hasPanels = panels.length > 0;
                const dimensions = buildDimensionPreview(
                  resource?.dimensions ?? svc.dimensions
                );
                const metricItems = buildMetricPreview(panels, svc.metrics);
                const displayTitle = getDisplayTitle(svc.name, svc.type);
                const detailHref = `/service-detail?id=${encodeURIComponent(svc.id)}&productId=${encodeURIComponent(product.id)}`;

                return (
                  <div key={svc.id} className="group relative">
                    <Link href={detailHref} className="block">
                      <Card
                        className={`border overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/30 cursor-pointer ${getHealthBg(svc.status)}`}
                      >
                        <CardContent className="p-5">
                          {/* Header */}
                          <div className="flex items-start gap-4">
                            <div className="relative flex-shrink-0">
                              <div
                                className={`h-14 w-14 rounded-xl ring-1 flex items-center justify-center ${getTypeIconStyle(svc.type)}`}
                              >
                                <Icon className="h-7 w-7" />
                              </div>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-card ${getStatusDot(svc.status)}`}
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <p className="text-sm font-semibold truncate pr-6 group-hover:text-primary transition-colors">
                                      {displayTitle}
                                    </p>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" align="start">
                                    <p className="text-xs font-mono">{svc.name}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {svc.type} · {svc.namespace} · {svc.region}
                              </p>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-2 py-0 h-5 capitalize ${getHealthColor(svc.status)} ${getHealthBg(svc.status)}`}
                                >
                                  {svc.status}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] px-2 py-0 h-5">
                                  {svc.type}
                                </Badge>
                              </div>
                            </div>

                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
                          </div>

                          {/* Resource composition */}
                          <div className="mt-4 pt-4 border-t border-border/30 space-y-3">
                            {dimensions.length > 0 && (
                              <div>
                                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-2">
                                  Components
                                </p>
                                <div className="space-y-1.5">
                                  {dimensions.map((dim) => {
                                    const DimIcon = dim.icon;
                                    return (
                                      <div
                                        key={dim.key}
                                        className="flex items-center gap-2 min-w-0 rounded-md bg-background/50 px-2.5 py-1.5 ring-1 ring-border/40"
                                      >
                                        <DimIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                          {dim.label}
                                        </span>
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger>
                                              <span className="text-[11px] font-medium truncate ml-auto">
                                                {dim.value}
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p className="text-xs font-mono">{dim.value}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {metricItems.length > 0 && (
                              <div>
                                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-2">
                                  {hasPanels ? "Monitored metrics" : "Available metrics"}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {metricItems.map((metric) => {
                                    const MetricIcon = metric.icon;
                                    return (
                                      <TooltipProvider key={metric.id}>
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <div
                                              className={`flex flex-col items-center justify-center gap-1 min-w-[4.5rem] px-2 py-2 rounded-lg ring-1 transition-colors ${
                                                metric.configured
                                                  ? `${metric.colorClass} ring-current/20`
                                                  : "bg-muted/30 text-muted-foreground ring-border/40 opacity-75"
                                              }`}
                                            >
                                              <MetricIcon className="h-4 w-4" />
                                              <span className="text-[10px] font-medium text-center leading-tight line-clamp-2">
                                                {metric.label}
                                              </span>
                                              {metric.stat && (
                                                <span className="text-[9px] opacity-70 font-mono">
                                                  {metric.stat}
                                                </span>
                                              )}
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="text-xs">
                                              {metric.configured
                                                ? `${metric.label} (${metric.stat ?? "configured"})`
                                                : `${metric.label} — configure in detail view`}
                                            </p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {dimensions.length === 0 && metricItems.length === 0 && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground/70 py-1">
                                <LayoutDashboard className="h-3.5 w-3.5" />
                                <span>No components detected — open detail to configure</span>
                              </div>
                            )}
                          </div>

                          <p className="text-[11px] text-muted-foreground/60 mt-3 pt-3 border-t border-border/30 group-hover:text-muted-foreground transition-colors flex items-center gap-1">
                            <span>View details and charts</span>
                            <ChevronRight className="h-3 w-3" />
                          </p>
                        </CardContent>
                      </Card>
                    </Link>

                    {/* Remove resource (hover only) */}
                    <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      {resourceGroups.length > 0 && (
                        <Select
                          value={resource?.groupId ?? "__none__"}
                          onValueChange={(v: string | null) => {
                            if (!v) return;
                            assignResourceToGroup(
                              product.id,
                              svc.id,
                              v === "__none__" ? null : v
                            );
                          }}
                        >
                          <SelectTrigger
                            className="h-7 w-7 p-0 border-0 bg-background/80 shadow-sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                          >
                            <FolderTree className="h-3.5 w-3.5 mx-auto text-muted-foreground" />
                          </SelectTrigger>
                          <SelectContent align="end">
                            <SelectItem value="__none__" className="text-xs">
                              Ungrouped
                            </SelectItem>
                            {resourceGroups.map((g) => (
                              <SelectItem key={g.id} value={g.id} className="text-xs">
                                {g.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-red-500/10 hover:text-red-500"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRemoveResource(svc.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove resource</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
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
            <Select value={resourceTypeFilter} onValueChange={(val: string | null) => val && setResourceTypeFilter(val)}>
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
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <p className="text-xs text-muted-foreground">
                          {svc.type} · {svc.namespace} · {svc.region}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 flex-shrink-0">
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

      {/* ── Resource Groups Dialog ── */}
      <Dialog
        open={showGroupDialog}
        onOpenChange={(open) => {
          setShowGroupDialog(open);
          if (!open) {
            setEditingGroupId(null);
            setEditingGroupName("");
            setNewGroupName("");
          }
        }}
      >
        <DialogContent className="w-auto min-w-[560px] max-w-[90vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-primary" />
              Manage Groups
            </DialogTitle>
            <DialogDescription>
              Create named groups to organize resources (e.g. &quot;n8n Production&quot;, &quot;Workers&quot;)
            </DialogDescription>
          </DialogHeader>

          {/* Create group */}
          <div className="space-y-2 py-2 border-b border-border/50">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              New group
            </p>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Group name…"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="h-9 text-sm flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
              />
              <div className="flex items-center gap-1">
                {PRODUCT_COLORS.slice(0, 6).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`h-5 w-5 rounded-full ring-2 transition-all ${
                      newGroupColor === c ? "ring-primary scale-110" : "ring-transparent opacity-70 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewGroupColor(c)}
                  />
                ))}
              </div>
              <Button size="sm" className="h-9" onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-[200px] space-y-4 py-2">
            {/* Existing groups */}
            {resourceGroups.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Groups ({resourceGroups.length})
                </p>
                {resourceGroups.map((group) => {
                  const count = product.resources.filter((r) => r.groupId === group.id).length;
                  const isEditing = editingGroupId === group.id;
                  return (
                    <div
                      key={group.id}
                      className="flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-muted/20"
                    >
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: group.color ?? product.color }}
                      />
                      {isEditing ? (
                        <Input
                          value={editingGroupName}
                          onChange={(e) => setEditingGroupName(e.target.value)}
                          className="h-8 text-sm flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveGroupRename(group.id);
                            if (e.key === "Escape") setEditingGroupId(null);
                          }}
                        />
                      ) : (
                        <span className="text-sm font-medium flex-1 truncate">{group.name}</span>
                      )}
                      <Badge variant="outline" className="text-[10px] h-5 flex-shrink-0">
                        {count} {count === 1 ? "resource" : "resources"}
                      </Badge>
                      {isEditing ? (
                        <Button size="sm" variant="default" className="h-7" onClick={() => handleSaveGroupRename(group.id)}>
                          Save
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingGroupId(group.id);
                            setEditingGroupName(group.name);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 hover:text-red-500 hover:bg-red-500/10"
                        onClick={() => deleteResourceGroup(product.id, group.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No groups yet. Create one above to get started.
              </p>
            )}

            {/* Assign resources */}
            {product.resources.length > 0 && resourceGroups.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Assign resources
                </p>
                <div className="space-y-1 max-h-[240px] overflow-y-auto">
                  {product.resources.map((resource) => {
                    const svc = services.find((s) => s.id === resource.serviceId);
                    const label = svc ? getDisplayTitle(svc.name, svc.type) : resource.serviceName;
                    return (
                      <div
                        key={resource.serviceId}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/40"
                      >
                        <span className="text-xs truncate flex-1 min-w-0">{label}</span>
                        <Select
                          value={resource.groupId ?? "__none__"}
                          onValueChange={(v: string | null) => {
                            if (!v) return;
                            assignResourceToGroup(
                              product.id,
                              resource.serviceId,
                              v === "__none__" ? null : v
                            );
                          }}
                        >
                          <SelectTrigger className="h-8 w-40 text-xs">
                            <SelectValue placeholder="Group" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" className="text-xs">
                              Ungrouped
                            </SelectItem>
                            {resourceGroups.map((g) => (
                              <SelectItem key={g.id} value={g.id} className="text-xs">
                                {g.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border/50 pt-4">
            <Button variant="outline" onClick={() => setShowGroupDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
