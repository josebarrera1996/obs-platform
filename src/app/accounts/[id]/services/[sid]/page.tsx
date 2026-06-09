"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { MainLayout } from "@/components/MainLayout";
import { useSettingsStore } from "@/store/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Activity,
  Cpu,
  HardDrive,
  AlertTriangle,
  Zap,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";

interface MetricPoint {
  timestamp: string;
  value: number;
}

interface MetricResult {
  id: string;
  label: string;
  unit: string;
  stat: string;
  datapoints: MetricPoint[];
}

interface CloudTrailEvent {
  eventId: string;
  eventName: string;
  eventTime: string;
  eventSource: string;
  errorMessage?: string;
}

export default function ServiceDetailNestedPage() {
  const params = useParams();
  const serviceId = params.sid as string;
  const activeCredentialId = useSettingsStore((s) => s.activeCredentialId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricResult[]>([]);
  const [events, setEvents] = useState<CloudTrailEvent[]>([]);
  const [timeRange] = useState("24h");

  // Fetch metrics for this service
  const fetchMetrics = useCallback(async () => {
    if (!activeCredentialId) return;
    setLoading(true);
    setError(null);
    try {
      // Try CPU + Memory metrics from CloudWatch
      const res = await fetch("/api/aws/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentialId: activeCredentialId,
          metrics: [
            {
              namespace: "AWS/ECS",
              metricName: "CPUUtilization",
              dimensions: [{ Name: "ServiceName", Value: serviceId }],
              stat: "Average",
              timeRange,
            },
            {
              namespace: "AWS/ECS",
              metricName: "MemoryUtilization",
              dimensions: [{ Name: "ServiceName", Value: serviceId }],
              stat: "Average",
              timeRange,
            },
            {
              namespace: "AWS/EC2",
              metricName: "CPUUtilization",
              dimensions: [{ Name: "InstanceId", Value: serviceId }],
              stat: "Average",
              timeRange,
            },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.results || []);
      }
    } catch (err) {
      console.error("Failed to fetch metrics:", err);
    }
  }, [activeCredentialId, serviceId, timeRange]);

  // Fetch CloudTrail events as "incidents"
  const fetchEvents = useCallback(async () => {
    if (!activeCredentialId) return;
    try {
      const res = await fetch(
        `/api/aws/events?credentialId=${activeCredentialId}&timeRange=${timeRange}&maxResults=20`
      );
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {
      // Ignore events errors
    } finally {
      setLoading(false);
    }
  }, [activeCredentialId, timeRange]);

  useEffect(() => {
    if (activeCredentialId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      Promise.all([fetchMetrics(), fetchEvents()]);
    } else {
      setLoading(false);
    }
  }, [fetchMetrics, fetchEvents, activeCredentialId]);

  // Format metrics for charts
  const metricChartData = (metric: MetricResult) =>
    metric.datapoints.map((dp) => ({
      time: new Date(dp.timestamp).toLocaleTimeString(),
      value: Number(dp.value.toFixed(2)),
    }));

  const errorEvents = events.filter(
    (e) =>
      e.errorMessage ||
      e.eventName?.startsWith("Delete") ||
      e.eventName?.startsWith("Terminate") ||
      e.eventName?.startsWith("Stop") ||
      e.eventName?.startsWith("Reboot")
  );

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        {/* Back link */}
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">{serviceId}</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Service Detail · {timeRange} view
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchMetrics}>
              <Activity className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-32 mb-4" />
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <AlertTriangle className="h-12 w-12 text-red-400/60" />
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={fetchMetrics}>
              Retry
            </Button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <div className="space-y-6">
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((m) => {
                const avg =
                  m.datapoints.length > 0
                    ? m.datapoints.reduce((s, p) => s + p.value, 0) /
                      m.datapoints.length
                    : 0;
                const latest =
                  m.datapoints.length > 0
                    ? m.datapoints[m.datapoints.length - 1].value
                    : 0;
                return (
                  <Card key={m.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Activity className="h-4 w-4" />
                        {m.label}
                      </div>
                      <p className="text-2xl font-bold">
                        {latest.toFixed(1)}
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                          {m.unit}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Avg: {avg.toFixed(1)} {m.unit}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
              {metrics.length === 0 && (
                <>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Cpu className="h-4 w-4" />
                        CPU
                      </div>
                      <p className="text-2xl font-bold text-muted-foreground/40">
                        --
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <HardDrive className="h-4 w-4" />
                        Memory
                      </div>
                      <p className="text-2xl font-bold text-muted-foreground/40">
                        --
                      </p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Charts */}
            {metrics.map((metric) => (
              <Card key={metric.id}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    {metric.label} ({metric.unit})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {metric.datapoints.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={metricChartData(metric)}>
                          <defs>
                            <linearGradient
                              id={`gradient-${metric.id}`}
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="hsl(var(--chart-1))"
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="95%"
                                stopColor="hsl(var(--chart-1))"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            className="stroke-border/50"
                          />
                          <XAxis
                            dataKey="time"
                            tick={{ fontSize: 11 }}
                            className="text-muted-foreground"
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            className="text-muted-foreground"
                            unit={metric.unit}
                          />
                          <Tooltip />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="hsl(var(--chart-1))"
                            fill={`url(#gradient-${metric.id})`}
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                        No data available for this time range
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Events / Incidents */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Recent Events
                  <Badge variant="outline" className="ml-1">
                    {errorEvents.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errorEvents.slice(0, 10).map((evt) => (
                      <TableRow key={evt.eventId}>
                        <TableCell className="text-xs">
                          {new Date(evt.eventTime).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-medium text-xs">
                          {evt.eventName}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {evt.eventSource?.split(".")[0] || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              evt.errorMessage
                                ? "border-red-200 text-red-600 dark:border-red-800 dark:text-red-400"
                                : "border-amber-200 text-amber-600 dark:border-amber-800 dark:text-amber-400"
                            }
                          >
                            {evt.errorMessage ? "Error" : "Warning"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {errorEvents.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-sm text-muted-foreground py-8"
                        >
                          <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-400" />
                          No recent incidents
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* No credential state */}
        {!activeCredentialId && !loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertTriangle className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No active credential configured.
            </p>
            <Link href="/settings">
              <Button variant="outline">Go to Settings</Button>
            </Link>
          </div>
        )}
      </div>
    </MainLayout>
  );
}