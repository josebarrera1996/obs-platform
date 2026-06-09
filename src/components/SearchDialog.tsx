"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSettingsStore } from "@/store/settings";
import { Skeleton } from "@/components/Skeleton";

interface SearchResult {
  id: string;
  type: "account" | "service" | "incident";
  title: string;
  subtitle: string;
  href: string;
  status?: string;
  namespace?: string;
}

export function SearchDialog() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [resultsCache, setResultsCache] = useState<SearchResult[]>([]);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(false);

  const activeCredentialId = useSettingsStore((s) => s.activeCredentialId);
  const awsAccounts = useSettingsStore((s) => s.accounts);

  // Listen for ⌘K / Ctrl+K globally
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Fetch services from AWS API and build search cache
  const buildCache = useCallback(async () => {
    if (!activeCredentialId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/aws/services?credentialId=${activeCredentialId}`
      );
      if (res.ok) {
        const data = await res.json();
        const services = data.services || [];

        const cache: SearchResult[] = [];

        // Add accounts
        awsAccounts.forEach((acc) => {
          cache.push({
            id: acc.id,
            type: "account",
            title: acc.alias || acc.accountId,
            subtitle: `AWS · ${acc.region} · ${acc.servicesCount} services`,
            href: `/accounts/${acc.id}`,
            status: acc.status,
          });
        });

        // Add services
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        services.forEach((svc: any) => {
          const dimensions = svc.dimensions
            ? `&dimensions=${encodeURIComponent(JSON.stringify(svc.dimensions))}`
            : "";
          cache.push({
            id: svc.id,
            type: "service",
            title: svc.name,
            subtitle: `${svc.namespace} · ${svc.type} · ${svc.region}`,
            href: `/service-detail?credentialId=${activeCredentialId}&serviceId=${svc.id}&namespace=${svc.namespace}&region=${svc.region}${dimensions}`,
            status: svc.status,
            namespace: svc.namespace,
          });
        });

        setResultsCache(cache);
        setCached(true);
      }
    } catch {
      // Fall back to empty cache
    } finally {
      setLoading(false);
    }
  }, [activeCredentialId, awsAccounts]);

  // Rebuild cache when dialog opens
  useEffect(() => {
    if (open) {
      if (!cached) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        buildCache();
      }
      // Focus input when dialog opens
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
    }
  }, [open, cached, buildCache]);

  const filteredResults = (() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return resultsCache
      .filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.subtitle.toLowerCase().includes(q) ||
          r.namespace?.toLowerCase().includes(q)
      )
      .slice(0, 15);
  })();

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    router.push(result.href);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[550px] p-0 gap-0">
        <DialogTitle className="sr-only">Search resources</DialogTitle>
        <div className="flex items-center border-b border-border/40 px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search accounts, services, incidents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 px-3 h-12 text-sm bg-transparent"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/50">
            ESC
          </kbd>
        </div>

        <ScrollArea className="max-h-[400px]">
          {loading && (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && query.length < 2 && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Type to search across all resources
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Press <kbd className="text-[10px] font-mono">⌘</kbd>+
                <kbd className="text-[10px] font-mono">K</kbd> anytime to open
              </p>
            </div>
          )}

          {!loading && query.length >= 2 && filteredResults.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No results found for &quot;{query}&quot;
              </p>
            </div>
          )}

          {!loading && filteredResults.length > 0 && (
            <div className="p-2">
              {filteredResults.map((result) => (
                <div
                  key={`${result.type}-${result.id}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => handleSelect(result)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSelect(result);
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Navigate to ${result.title}`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/40 bg-muted/30">
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 font-mono uppercase"
                    >
                      {result.type === "account"
                        ? "ACC"
                        : result.type === "service"
                          ? "SVC"
                          : "INC"}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {result.title}
                      </span>
                      {result.status && (
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            result.status === "healthy" ||
                            result.status === "running"
                              ? "bg-emerald-500"
                              : result.status === "degraded" ||
                                  result.status === "stopped"
                                ? "bg-amber-500"
                                : "bg-red-500"
                          }`}
                        />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {result.subtitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !activeCredentialId && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No AWS credentials configured.
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Add credentials in Settings to enable search.
              </p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}