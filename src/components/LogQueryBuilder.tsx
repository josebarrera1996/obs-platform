"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { LogPanel } from "@/types/products";
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
  Loader2,
  Plus,
  X,
  RefreshCw,
  ScrollText,
  AlertCircle,
  Search,
} from "lucide-react";
import {
  DEFAULT_LOGS_QUERY,
  ERROR_LOGS_QUERY,
  type LogRecord,
} from "@/lib/cloudwatch-logs";
import { TransformPipelineEditor } from "@/components/TransformPipelineEditor";
import { transformLogRecords } from "@/lib/transforms";
import type { PanelTransform } from "@/types/transforms";

const TIME_RANGES = [
  { value: "1h", label: "Last hour" },
  { value: "6h", label: "Last 6 hours" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
];

const QUERY_TEMPLATES = [
  { label: "Recent logs", query: DEFAULT_LOGS_QUERY },
  { label: "Errors & failures", query: ERROR_LOGS_QUERY },
];

interface LogGroupOption {
  name: string;
  storedBytes?: number;
}

interface LogQueryBuilderProps {
  open: boolean;
  onClose: () => void;
  onSave: (panel: LogPanel) => void;
  initialPanel?: LogPanel;
  credentialId: string;
  defaultLogGroups?: string[];
  serviceType?: string;
}

export function LogQueryBuilder({
  open,
  onClose,
  onSave,
  initialPanel,
  credentialId,
  defaultLogGroups = [],
  serviceType,
}: LogQueryBuilderProps) {
  const [title, setTitle] = useState(initialPanel?.title ?? "");
  const [logGroupNames, setLogGroupNames] = useState<string[]>(
    initialPanel?.logGroupNames ?? defaultLogGroups
  );
  const [query, setQuery] = useState(initialPanel?.query ?? DEFAULT_LOGS_QUERY);
  const [timeRange, setTimeRange] = useState(initialPanel?.timeRange ?? "24h");
  const [manualGroup, setManualGroup] = useState("");

  const [availableGroups, setAvailableGroups] = useState<LogGroupOption[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupPrefix, setGroupPrefix] = useState("");

  const [previewRecords, setPreviewRecords] = useState<LogRecord[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [hasPreview, setHasPreview] = useState(false);
  const [transforms, setTransforms] = useState<PanelTransform[]>(
    initialPanel?.transforms ?? []
  );

  useEffect(() => {
    if (!open) return;
    setTitle(initialPanel?.title ?? "");
    setLogGroupNames(initialPanel?.logGroupNames ?? defaultLogGroups);
    setQuery(initialPanel?.query ?? DEFAULT_LOGS_QUERY);
    setTimeRange(initialPanel?.timeRange ?? "24h");
    setPreviewRecords([]);
    setHasPreview(false);
    setPreviewError(null);
    setGroupSearch("");
    setGroupPrefix(serviceType === "Lambda" ? "/aws/lambda/" : "");
    setTransforms(initialPanel?.transforms ?? []);
  }, [open, initialPanel, defaultLogGroups, serviceType]);

  const loadLogGroups = useCallback(async () => {
    if (!credentialId) return;
    setGroupsLoading(true);
    setGroupsError(null);
    try {
      const params = new URLSearchParams({ credentialId, limit: "100" });
      if (groupPrefix.trim()) params.set("prefix", groupPrefix.trim());
      const res = await fetch(`/api/aws/logs/groups?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAvailableGroups(data.logGroups ?? []);
    } catch (err) {
      setGroupsError((err as Error).message);
    } finally {
      setGroupsLoading(false);
    }
  }, [credentialId, groupPrefix]);

  useEffect(() => {
    if (open && credentialId) loadLogGroups();
  }, [open, credentialId, loadLogGroups]);

  const filteredGroups = availableGroups.filter((g) =>
    !groupSearch.trim()
      ? true
      : g.name.toLowerCase().includes(groupSearch.trim().toLowerCase())
  );

  const toggleLogGroup = (name: string) => {
    setLogGroupNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const addManualGroup = () => {
    const name = manualGroup.trim();
    if (!name || logGroupNames.includes(name)) return;
    setLogGroupNames((prev) => [...prev, name]);
    setManualGroup("");
  };

  const runPreview = async () => {
    if (!credentialId || logGroupNames.length === 0 || !query.trim()) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await fetch("/api/aws/logs/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentialId,
          logGroupNames,
          query,
          timeRange,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPreviewRecords(data.records ?? []);
      setHasPreview(true);
    } catch (err) {
      setPreviewError((err as Error).message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = () => {
    const panel: LogPanel = {
      id: initialPanel?.id ?? `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "logs",
      title: title.trim() || "CloudWatch Logs",
      logGroupNames,
      query: query.trim(),
      timeRange,
      transforms: transforms.length > 0 ? transforms : undefined,
    };
    onSave(panel);
  };

  const canSave = logGroupNames.length > 0 && query.trim().length > 0;

  const previewFields = useMemo(() => {
    if (previewRecords.length === 0) return ["@timestamp", "@message"];
    const keys = new Set<string>();
    for (const r of previewRecords) {
      for (const k of Object.keys(r)) keys.add(k);
    }
    return Array.from(keys);
  }, [previewRecords]);

  const transformedPreview = useMemo(() => {
    if (!hasPreview || previewRecords.length === 0) {
      return { records: previewRecords, error: null as string | null };
    }
    try {
      const result = transformLogRecords(previewRecords, transforms);
      return { records: result.records, error: null as string | null };
    } catch (err) {
      return { records: previewRecords, error: (err as Error).message };
    }
  }, [hasPreview, previewRecords, transforms]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="min-w-[720px] max-w-[94vw] max-h-[92vh] overflow-y-auto flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-cyan-500" />
            {initialPanel ? "Edit Logs Panel" : "Add Logs Panel"}
          </DialogTitle>
          <DialogDescription>
            Query CloudWatch Logs with Logs Insights QL — like Grafana CloudWatch Logs
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5 flex-1">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Panel Title <span className="normal-case font-normal">(optional)</span>
            </label>
            <Input
              placeholder="e.g. Lambda errors — last 24h"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Log groups */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Log Groups
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              <Input
                placeholder="Name prefix filter (e.g. /aws/lambda/)"
                value={groupPrefix}
                onChange={(e) => setGroupPrefix(e.target.value)}
                className="h-8 text-xs flex-1 min-w-[180px]"
              />
              <Button variant="outline" size="sm" className="h-8" onClick={loadLogGroups} disabled={groupsLoading}>
                {groupsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
            </div>

            {logGroupNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {logGroupNames.map((name) => (
                  <Badge key={name} variant="secondary" className="text-[10px] gap-1 pr-1 font-mono">
                    {name}
                    <button type="button" onClick={() => toggleLogGroup(name)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="Or type log group path manually…"
                value={manualGroup}
                onChange={(e) => setManualGroup(e.target.value)}
                className="h-8 text-xs font-mono flex-1"
                onKeyDown={(e) => e.key === "Enter" && addManualGroup()}
              />
              <Button variant="outline" size="sm" className="h-8" onClick={addManualGroup} disabled={!manualGroup.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search available log groups…"
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                className="h-8 text-xs pl-8"
              />
            </div>

            <div className="border border-border/50 rounded-lg max-h-36 overflow-y-auto">
              {groupsError ? (
                <p className="text-xs text-destructive p-3">{groupsError}</p>
              ) : groupsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : filteredGroups.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">No log groups found</p>
              ) : (
                filteredGroups.map((g) => {
                  const selected = logGroupNames.includes(g.name);
                  return (
                    <button
                      key={g.name}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-xs font-mono border-b border-border/30 last:border-0 hover:bg-muted/50 ${
                        selected ? "bg-primary/10 text-primary" : ""
                      }`}
                      onClick={() => toggleLogGroup(g.name)}
                    >
                      {g.name}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Query + time range */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Logs Insights QL
                </label>
                <div className="flex gap-1">
                  {QUERY_TEMPLATES.map((t) => (
                    <Button
                      key={t.label}
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => setQuery(t.query)}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={6}
                spellCheck={false}
                className="w-full rounded-lg border border-input bg-muted/30 px-3 py-2 text-xs font-mono leading-relaxed resize-y min-h-[120px] focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder={DEFAULT_LOGS_QUERY}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Time Range
              </label>
              <Select value={timeRange} onValueChange={(v: string | null) => v && setTimeRange(v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-sm">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Preview
              </label>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={runPreview}
                disabled={previewLoading || !canSave}
              >
                {previewLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Run query
              </Button>
            </div>
            {previewError && (
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {previewError}
              </div>
            )}
            {transformedPreview.error && (
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                Transform error: {transformedPreview.error}
              </div>
            )}
            {hasPreview && !previewError && (
              <div className="border border-border/50 rounded-lg max-h-40 overflow-auto bg-muted/20">
                {transformedPreview.records.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-4 text-center">No results</p>
                ) : (
                  transformedPreview.records.slice(0, 8).map((r, i) => (
                    <div key={i} className="px-3 py-2 border-b border-border/30 last:border-0 text-[10px] font-mono">
                      <span className="text-muted-foreground mr-2">{r["@timestamp"]}</span>
                      <span className="break-all">{(r["@message"] ?? r.message ?? JSON.stringify(r)).slice(0, 200)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <TransformPipelineEditor
            transforms={transforms}
            onChange={setTransforms}
            availableFields={previewFields}
          />
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/60 gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {initialPanel ? "Save Panel" : "Add Panel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
