"use client";

import { useEffect, useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Activity,
  Database,
  RefreshCw,
  BarChart3,
  Clock,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Layers,
  ArrowUpDown,
  FileJson,
  Network,
  Search,
  Terminal,
  Shield,
} from "lucide-react";

interface PipelineStats {
  totalMetrics: number;
  filesOnDisk: number;
  storageSizeBytes: number;
  storageSizeMB: string;
  oldestData: string;
  newestData: string;
  namespaces: string[];
  dailyCounts: { date: string; count: number }[];
  healthy: boolean;
}

interface QuickwitStatus {
  status: string;
  service: string;
  reachable: boolean;
  version?: string;
  error?: string;
  endpoint: string;
}

interface LogEntry {
  timestamp: string;
  message: string;
  serviceId?: string;
  namespace?: string;
  level?: string;
}

export default function PipelineDashboardPage() {
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Quickwit state
  const [qwStatus, setQwStatus] = useState<QuickwitStatus | null>(null);
  const [qwLoading, setQwLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("*");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSearchError, setLogSearchError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/pipeline/stats");
      if (!res.ok) throw new Error("Failed to fetch pipeline stats");
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchQuickwitStatus = async () => {
    try {
      setQwLoading(true);
      const res = await fetch("/api/pipeline/quickwit");
      if (res.ok) {
        const data = await res.json();
        setQwStatus(data);
      }
    } catch {
      setQwStatus(null);
    } finally {
      setQwLoading(false);
    }
  };

  const searchLogs = async () => {
    try {
      setLogsLoading(true);
      setLogSearchError(null);
      const res = await fetch(
        `/api/pipeline/logs?query=${encodeURIComponent(searchQuery)}&maxHits=50`
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      setLogSearchError(err instanceof Error ? err.message : "Search error");
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    fetchStats();
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    fetchQuickwitStatus();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Database className="h-6 w-6 text-chart-1" />
              Pipeline Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitoreo en tiempo real del data pipeline de métricas AWS
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchStats();
              fetchQuickwitStatus();
            }}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {error && (
          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span>Error: {error}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Make sure you have added AWS credentials and the pipeline has collected some data.
              </p>
            </CardContent>
          </Card>
        )}

        {stats && (
          <>
            {/* Health Status */}
            <Card className={stats.healthy ? "border-green-500/30" : "border-red-500/30"}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {stats.healthy ? (
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                    ) : (
                      <XCircle className="h-8 w-8 text-red-500" />
                    )}
                    <div>
                      <p className="font-semibold text-lg">
                        {stats.healthy ? "Pipeline Healthy" : "Pipeline Issues"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {stats.totalMetrics > 0
                          ? `Collecting data successfully — ${stats.totalMetrics.toLocaleString()} metrics ingested`
                          : "No data collected yet — add credentials and run ingest"}
                      </p>
                    </div>
                  </div>
                  <Badge variant={stats.healthy ? "default" : "destructive"}>
                    {stats.healthy ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Metrics</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.totalMetrics.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Data points collected
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Files on Disk</CardTitle>
                  <FileJson className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.filesOnDisk}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    JSONL files (fallback storage)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Storage</CardTitle>
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.storageSizeMB} MB</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatBytes(stats.storageSizeBytes)} on disk
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Namespaces</CardTitle>
                  <Layers className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.namespaces.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.namespaces.join(", ") || "None"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quickwit Status */}
            <Card className={qwStatus?.reachable ? "border-green-500/30" : "border-yellow-500/30"}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Network className="h-4 w-4 text-chart-2" />
                  Quickwit Storage Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {qwLoading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    ) : qwStatus?.reachable ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    )}
                    <div>
                      <p className="font-medium">
                        {qwLoading
                          ? "Checking..."
                          : qwStatus?.reachable
                          ? "Quickwit Connected"
                          : "Quickwit Not Available"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {qwStatus?.reachable
                          ? `Version ${qwStatus.version} — Endpoint: ${qwStatus.endpoint}`
                          : qwStatus?.error
                          ? `Fallback: JSONL files — ${qwStatus.error}`
                          : "Fallback: JSONL files on disk"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchQuickwitStatus}
                    disabled={qwLoading}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${qwLoading ? "animate-spin" : ""}`} />
                    Check
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quickwit Log Viewer */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-chart-3" />
                  Log Explorer
                  {qwStatus?.reachable && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      Quickwit
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={qwStatus?.reachable ? 'Search logs (e.g. "error OR critical")' : "Quickwit not available — logs stored as JSONL"}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && searchLogs()}
                      className="pl-9"
                      disabled={!qwStatus?.reachable}
                    />
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={searchLogs}
                    disabled={logsLoading || !qwStatus?.reachable}
                  >
                    {logsLoading ? (
                      <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4 mr-1" />
                    )}
                    Search
                  </Button>
                </div>

                {logSearchError && (
                  <p className="text-sm text-destructive mb-2">{logSearchError}</p>
                )}

                {!qwStatus?.reachable ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <HardDrive className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Quickwit no está disponible</p>
                    <p className="text-xs mt-1">
                      Los logs se almacenan como archivos JSONL en .data/pipeline/
                    </p>
                    <p className="text-xs mt-2 text-yellow-500">
                      Ejecutá: docker compose --profile pipeline up -d
                    </p>
                  </div>
                ) : logs.length === 0 && !logsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Enter a query and click Search</p>
                    <p className="text-xs mt-1">
                      Try: * to see all logs, or filter by serviceId:api-gateway
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
                    {logsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      logs.map((log, i) => (
                        <div
                          key={i}
                          className="flex gap-2 p-2 rounded hover:bg-muted/50 border-b border-border/30 last:border-0"
                        >
                          <span className="text-muted-foreground shrink-0 w-20 truncate">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <Badge
                            variant={
                              log.level === "error"
                                ? "destructive"
                                : log.level === "warn"
                                ? "secondary"
                                : "outline"
                            }
                            className="shrink-0 text-[10px] px-1 py-0 h-4"
                          >
                            {log.level || "info"}
                          </Badge>
                          {log.serviceId && (
                            <span className="text-chart-2 shrink-0 truncate max-w-[120px]">
                              {log.serviceId}
                            </span>
                          )}
                          <span className="text-foreground truncate flex-1">
                            {log.message}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {logs.length > 0 && !logsLoading && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Showing {logs.length} results — query: {searchQuery}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Data Freshness */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Data Freshness
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Oldest Data</p>
                    <p className="font-medium">
                      {stats.oldestData || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Newest Data</p>
                    <p className="font-medium">
                      {stats.newestData || "N/A"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Daily Ingestion Chart */}
            {stats.dailyCounts && stats.dailyCounts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Daily Ingestion
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2 h-32">
                    {stats.dailyCounts.slice(-14).map((day, i) => {
                      const max = Math.max(...stats.dailyCounts.map((d) => d.count), 1);
                      const height = (day.count / max) * 100;
                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col items-center gap-1"
                          title={`${day.date}: ${day.count.toLocaleString()} metrics`}
                        >
                          <div
                            className="w-full bg-chart-1/80 rounded-t hover:bg-chart-1 transition-colors"
                            style={{ height: `${Math.max(height, 2)}%` }}
                          />
                          <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                            {day.date.slice(5)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {day.count.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      fetch("/api/pipeline/stats", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "cleanup", retentionDays: 90 }),
                      }).then(() => fetchStats())
                    }
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Clean Old Data
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = "/api/pipeline/query?format=csv"}
                  >
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = "/insights"}
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    View Insights
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}