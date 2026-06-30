"use client";

import { useState, useMemo } from "react";
import { LogPanel } from "@/types/products";
import type { LogRecord } from "@/lib/cloudwatch-logs";
import { transformLogRecords } from "@/lib/transforms";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, PenLine, Trash2, ScrollText, Search, X } from "lucide-react";

function formatLogTimestamp(ts: string | undefined): string {
  if (!ts) return "—";
  const n = Number(ts);
  const d = Number.isFinite(n) ? new Date(n) : new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getMessage(record: LogRecord): string {
  return record["@message"] ?? record.message ?? JSON.stringify(record);
}

interface DetailPanelLogsProps {
  panel: LogPanel;
  records: LogRecord[];
  loading?: boolean;
  error?: string;
  activeTimeRange?: string;
  onEdit?: () => void;
  onRemove?: () => void;
}

export function DetailPanelLogs({
  panel,
  records,
  loading,
  error,
  activeTimeRange,
  onEdit,
  onRemove,
}: DetailPanelLogsProps) {
  const { displayRecords, columns, transformError } = useMemo(() => {
    if (!panel.transforms?.length) {
      return {
        displayRecords: records,
        columns: ["@timestamp", "@message"] as string[],
        transformError: null as string | null,
      };
    }
    try {
      const result = transformLogRecords(records, panel.transforms);
      const cols =
        result.frame.columns.length > 0
          ? result.frame.columns
          : result.records.length > 0
            ? Object.keys(result.records[0])
            : ["@timestamp", "@message"];
      return {
        displayRecords: result.records,
        columns: cols,
        transformError: null as string | null,
      };
    } catch (err) {
      return {
        displayRecords: records,
        columns: ["@timestamp", "@message"] as string[],
        transformError: (err as Error).message,
      };
    }
  }, [records, panel.transforms]);

  const title = panel.title || "CloudWatch Logs";
  const groupsLabel =
    panel.logGroupNames.length === 1
      ? panel.logGroupNames[0]
      : `${panel.logGroupNames.length} log groups`;

  const visibleColumns =
    columns.length > 0
      ? columns
      : displayRecords.length > 0
        ? Object.keys(displayRecords[0])
        : ["@timestamp", "@message"];

  const [searchQuery, setSearchQuery] = useState("");

  const filteredDisplayRecords = useMemo(() => {
    if (!searchQuery.trim()) return displayRecords;
    const q = searchQuery.toLowerCase().trim();
    return displayRecords.filter((record) => {
      return visibleColumns.some((col) => {
        const val = record[col];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(q);
      });
    });
  }, [displayRecords, searchQuery, visibleColumns]);

  return (
    <Card className="border-border/60 overflow-hidden lg:col-span-2">
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2 border-b border-border/40">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <ScrollText className="h-4 w-4 text-cyan-500 flex-shrink-0" />
              <h3 className="text-sm font-semibold truncate">{title}</h3>
              <Badge variant="outline" className="text-[10px] h-5 bg-cyan-500/10 text-cyan-600 border-cyan-500/20">
                Logs Insights
              </Badge>
              {panel.transforms && panel.transforms.length > 0 && (
                <Badge variant="outline" className="text-[10px] h-5 text-violet-500 border-violet-500/30">
                  {panel.transforms.length} transform{panel.transforms.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 truncate font-mono">{groupsLabel}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onEdit && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                <PenLine className="h-3.5 w-3.5" />
              </Button>
            )}
            {onRemove && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:text-red-500 hover:bg-red-500/10"
                onClick={onRemove}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {transformError && (
          <div className="mx-4 mt-2 text-xs text-red-500 bg-red-500/5 border border-red-500/20 rounded-md px-3 py-2">
            Transform error: {transformError}
          </div>
        )}

        {!loading && !error && records.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border/20 bg-muted/10">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
              <Input
                type="text"
                placeholder="Filter logs by any visible field..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-8 h-8 text-xs bg-muted/40 border-border/40 focus-visible:ring-cyan-500/30"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {searchQuery && (
              <Badge variant="secondary" className="text-[10px] h-6 flex-shrink-0">
                {filteredDisplayRecords.length} found
              </Badge>
            )}
          </div>
        )}

        <div className="max-h-[360px] overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-destructive">{error}</div>
          ) : displayRecords.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No log entries for this time range
            </div>
          ) : filteredDisplayRecords.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No log entries match search filter "{searchQuery}"
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b border-border/50">
                  {visibleColumns.map((col) => (
                    <th
                      key={col}
                      className="text-left font-medium text-muted-foreground px-4 py-2 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDisplayRecords.map((record, i) => {
                  const msg = getMessage(record);
                  const isError = /error|exception|fail|timeout/i.test(msg);
                  return (
                    <tr
                      key={`${record["@timestamp"]}-${i}`}
                      className={`border-b border-border/30 hover:bg-muted/30 ${
                        isError ? "bg-red-500/5" : ""
                      }`}
                    >
                      {visibleColumns.map((col) => (
                        <td
                          key={col}
                          className={`px-4 py-2 align-top font-mono text-[11px] ${
                            col === "@timestamp"
                              ? "text-muted-foreground whitespace-nowrap text-[10px]"
                              : "text-foreground break-all whitespace-pre-wrap"
                          }`}
                        >
                          {col === "@timestamp"
                            ? formatLogTimestamp(String(record[col] ?? ""))
                            : String(record[col] ?? "")}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && !error && displayRecords.length > 0 && (
          <div className="px-4 py-2 border-t border-border/40 text-[10px] text-muted-foreground flex justify-between items-center">
            <div>
              {searchQuery ? `${filteredDisplayRecords.length} of ` : ""}{displayRecords.length} entries · {panel.timeRange && panel.timeRange !== "inherit" ? panel.timeRange : (activeTimeRange || "24h")}
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-[10px] text-cyan-500 hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
