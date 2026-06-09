"use client";

import { useEffect, useState, useCallback } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useSettingsStore } from "@/store/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/Pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Cloud,
  Activity,
  RefreshCw,
} from "lucide-react";

const PAGE_SIZE = 15;

interface AlarmEvent {
  name?: string;
  eventId?: string;
  eventName?: string;
  eventTime?: string;
  eventSource?: string;
  stateValue?: string;
  stateReason?: string;
  severity: string;
  description?: string;
  source: "alarm" | "event";
}

export default function IncidentsPage() {
  const activeCredentialId = useSettingsStore((s) => s.activeCredentialId);
  const [items, setItems] = useState<AlarmEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchAll = useCallback(async () => {
    if (!activeCredentialId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [alarmsRes, eventsRes] = await Promise.allSettled([
        fetch(`/api/aws/alarms?credentialId=${activeCredentialId}&stateValue=ALARM&maxResults=50`),
        fetch(`/api/aws/events?credentialId=${activeCredentialId}&timeRange=7d&maxResults=50`),
      ]);

      const allItems: AlarmEvent[] = [];

      // Process alarms
      if (alarmsRes.status === "fulfilled" && alarmsRes.value.ok) {
        const alarmsData = await alarmsRes.value.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (alarmsData.alarms || []).forEach((a: any) => {
          allItems.push({
            name: a.name,
            stateValue: a.stateValue,
            stateReason: a.stateReason,
            eventTime: a.stateUpdatedTimestamp,
            severity: a.severity,
            description: a.description,
            source: "alarm",
          });
        });
      }

      // Process events
      if (eventsRes.status === "fulfilled" && eventsRes.value.ok) {
        const eventsData = await eventsRes.value.json();
        (eventsData.events || [])
          .filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (e: any) =>
              e.errorMessage ||
              e.eventName?.startsWith("Delete") ||
              e.eventName?.startsWith("Terminate") ||
              e.eventName?.startsWith("Stop") ||
              e.eventName?.startsWith("Reboot") ||
              e.eventName?.startsWith("Disable")
          )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .forEach((e: any) => {
            allItems.push({
              eventId: e.eventId,
              eventName: e.eventName,
              eventTime: e.eventTime,
              eventSource: e.eventSource,
              severity: e.errorMessage ? "critical" : "warning",
              description: e.errorMessage,
              source: "event",
            });
          });
      }

      // Sort by time descending
      allItems.sort(
        (a, b) =>
          new Date(b.eventTime || 0).getTime() -
          new Date(a.eventTime || 0).getTime()
      );

      setItems(allItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch incidents");
    } finally {
      setLoading(false);
    }
  }, [activeCredentialId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, [fetchAll]);

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-blue-500" />;
    }
  };

  const severityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
      case "warning":
        return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
      default:
        return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400";
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Incidents</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time incidents from CloudWatch Alarms + CloudTrail
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                Critical
              </div>
              <p className="text-2xl font-bold text-red-500">
                {items.filter((i) => i.severity === "critical").length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Warnings
              </div>
              <p className="text-2xl font-bold text-amber-500">
                {items.filter((i) => i.severity === "warning").length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Activity className="h-4 w-4" />
                Total
              </div>
              <p className="text-2xl font-bold">{items.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Loading */}
        {loading && (
          <Card>
            <CardContent className="p-8">
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-48 mb-1" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Cloud className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={fetchAll}>
              Retry
            </Button>
          </div>
        )}

        {/* No credential */}
        {!activeCredentialId && !loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Cloud className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Configure AWS credentials in Settings to view real incidents.
            </p>
          </div>
        )}

        {/* Incidents Table */}
        {!loading && !error && activeCredentialId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                All Incidents ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Incident</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((item, idx) => (
                    <TableRow key={`${item.source}-${item.name || item.eventId || idx}`}>
                      <TableCell>{severityIcon(item.severity)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {item.name || item.eventName || "Unknown"}
                          </p>
                          {(item.stateReason || item.description) && (
                            <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {item.stateReason || item.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {item.source === "alarm" ? "CloudWatch" : "CloudTrail"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${severityBadge(item.severity)}`}
                        >
                          {item.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.eventTime
                          ? new Date(item.eventTime).toLocaleString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
                        <p className="text-sm text-muted-foreground">
                          No incidents found
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          All CloudWatch alarms are OK and no error events in CloudTrail
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {!loading && items.length > PAGE_SIZE && (
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(items.length / PAGE_SIZE)}
            totalItems={items.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        )}
      </div>
    </MainLayout>
  );
}