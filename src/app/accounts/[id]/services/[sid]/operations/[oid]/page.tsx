"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { MainLayout } from "@/components/MainLayout";
import { useSettingsStore } from "@/store/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/Skeleton";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import {
  ArrowLeft,
  Zap,
  Activity,
  AlertTriangle,
  Cpu,
  Network,
  Database,
  Globe,
  Box,
  MessageSquare,
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

interface MetricPoint {
  timestamp: string;
  value: number;
}

interface DiscoveredService {
  id: string;
  name: string;
  namespace: string;
  type: string;
  status: string;
  region: string;
  metrics: { name: string; unit: string }[];
}

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

const SERVICE_ICONS: Record<string, typeof Cpu> = {
  EC2: Cpu,
  RDS: Database,
  ALB: Network,
  NLB: Network,
  Lambda: Zap,
  ECS: Box,
  DynamoDB: Database,
  S3: Globe,
  ElastiCache: Box,
  SQS: MessageSquare,
  SNS: MessageSquare,
};

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toFixed(2);
}

function OperationDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { activeCredentialId } = useSettingsStore();
  
  const serviceId = params.sid as string;
  const operationId = params.oid as string;
  const ns = searchParams.get("ns") || "AWS/EC2";

  const [service, setService] = useState<DiscoveredService | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricData, setMetricData] = useState<MetricPoint[]>([]);
  const [metricName, setMetricName] = useState("");

  useEffect(() => {
    if (!activeCredentialId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    // Fetch service info and metrics
    async function loadData() {
      try {
        // Get all services
        const res = await fetch(`/api/aws/services?credentialId=${activeCredentialId}`);
        if (!res.ok) throw new Error("Failed to fetch services");
        const data = await res.json();
        
        const svc = (data.services || []).find(
          (s: DiscoveredService) => s.id === serviceId || s.name.includes(serviceId)
        );
        
        if (svc) {
          setService(svc);
          const dimName = DIMENSION_MAP[ns] || "InstanceId";
          // Find the metric for this operation
          const metric = svc.metrics.find((m: { name: string; unit: string }) => m.name === operationId) || svc.metrics[0];
          
          if (metric) {
            setMetricName(metric.name);
            // Fetch the metric data
            const metricRes = await fetch(
              `/api/aws/metrics?credentialId=${activeCredentialId}&namespace=${encodeURIComponent(ns)}&metricName=${metric.name}&dimensionName=${dimName}&dimensionValue=${encodeURIComponent(serviceId)}&timeRange=1h&stat=Average`
            );
            if (metricRes.ok) {
              const metricData = await metricRes.json();
              if (metricData.datapoints && Array.isArray(metricData.datapoints)) {
                setMetricData(metricData.datapoints);
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to load operation:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [activeCredentialId, serviceId, ns, operationId]);

  const Icon = service ? (SERVICE_ICONS[service.type] || Activity) : Activity;

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Back button */}
        <Link
          href={`/service-detail?ns=${encodeURIComponent(ns)}&id=${encodeURIComponent(serviceId)}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Service
        </Link>

        {service ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sidebar-accent/10">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{metricName || operationId}</h1>
                <p className="text-sm text-muted-foreground">
                  {service.name} · {service.namespace}
                </p>
              </div>
            </div>

            {/* Metric Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">{metricName || operationId} — Last Hour</CardTitle>
              </CardHeader>
              <CardContent>
                {metricData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={metricData}>
                        <defs>
                          <linearGradient id="opGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="timestamp"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v: string) => {
                            const d = new Date(v);
                            return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
                          }}
                        />
                        <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v: number) => formatNumber(v)} />
                        <RechartTooltip
                          contentStyle={{
                            background: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          labelFormatter={(label) => typeof label === 'string' ? new Date(label).toLocaleString() : label as React.ReactNode}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#6366f1"
                          fill="url(#opGrad)"
                          strokeWidth={2}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                    No data available for this metric
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Current Value</p>
                  <p className="text-lg font-bold mt-1">
                    {metricData.length > 0 
                      ? formatNumber(metricData[metricData.length - 1].value)
                      : "N/A"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Average</p>
                  <p className="text-lg font-bold mt-1">
                    {metricData.length > 0
                      ? formatNumber(metricData.reduce((s, p) => s + p.value, 0) / metricData.length)
                      : "N/A"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Maximum</p>
                  <p className="text-lg font-bold mt-1">
                    {metricData.length > 0
                      ? formatNumber(Math.max(...metricData.map((p) => p.value)))
                      : "N/A"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Datapoints</p>
                  <p className="text-lg font-bold mt-1">{metricData.length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Operation Details</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground">Namespace:</span> {service.namespace}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Metric:</span> {metricName || operationId}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Resource:</span> {service.name}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span> {service.status}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-muted-foreground">Operation not found</p>
              <Link href="/" className="text-sm text-primary hover:underline mt-2 inline-block">
                Return to Dashboard
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

export default function OperationDetailPage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    }>
      <OperationDetailContent />
    </Suspense>
  );
}