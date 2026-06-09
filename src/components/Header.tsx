"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settings";
import {
  ChevronRight,
  SlidersHorizontal,
  Download,
  Search,
  Bell,
  Clock,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CloudTrailEvent {
  eventId: string;
  eventName: string;
  eventTime: string;
  eventSource: string;
  username?: string;
  errorMessage?: string;
  resources?: { ARN: string; ResourceType: string }[];
}

interface TimeRange {
  label: string;
  value: string;
}

const timeRanges: TimeRange[] = [
  { label: "1h", value: "1h" },
  { label: "6h", value: "6h" },
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
];

export function Header() {
  const pathname = usePathname();
  const activeCredentialId = useSettingsStore((s) => s.activeCredentialId);
  const [timeRange, setTimeRange] = useState<TimeRange>(timeRanges[2]); // 24h
  const [lastUpdated, setLastUpdated] = useState(new Date());
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_secondsAgo, setSecondsAgo] = useState(0);
  const [events, setEvents] = useState<CloudTrailEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Live timer
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
      setSecondsAgo(0);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch real events from CloudTrail
  useEffect(() => {
    if (!activeCredentialId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEventsLoading(true);
    fetch(
      `/api/aws/events?credentialId=${activeCredentialId}&timeRange=${timeRange.value}&maxResults=20`
    )
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events || []);
      })
      .catch(() => {
        setEvents([]);
      })
      .finally(() => {
        setEventsLoading(false);
      });
  }, [activeCredentialId, timeRange]);

  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

  // Filter to error-type events as "incidents"
  const errorEvents = events.filter(
    (e) =>
      e.errorMessage ||
      e.eventName?.startsWith("Delete") ||
      e.eventName?.startsWith("Terminate") ||
      e.eventName?.startsWith("Stop") ||
      e.eventName?.startsWith("Reboot")
  );

  const openIncidents = errorEvents.length;

  // Dispatch custom event to open search dialog
  const openSearch = () => {
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  const now = new Date();
  const diffMs = now.getTime() - lastUpdated.getTime();
  const formattedDiff =
    diffMs < 60000
      ? `${Math.floor(diffMs / 1000)}s ago`
      : `${Math.floor(diffMs / 60000)}m ago`;

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Home</span>
        {segments.map((segment, i) => (
          <span key={i} className="flex items-center gap-2">
            <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            <span
              className={cn(
                i === segments.length - 1
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {segment}
            </span>
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Live indicator */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{formattedDiff}</span>
        </div>

        {/* Time range */}
        <Select
          value={timeRange.value}
          onValueChange={(val) => {
            const found = timeRanges.find((tr) => tr.value === val);
            if (found) setTimeRange(found);
          }}
        >
          <SelectTrigger className="h-8 w-16 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timeRanges.map((tr) => (
              <SelectItem key={tr.value} value={tr.value}>
                {tr.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search button */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={openSearch}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-mono text-muted-foreground/70">
            ⌘K
          </kbd>
        </Button>

        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filters</span>
        </Button>

        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>

        {/* Notifications */}
        <Popover>
          <PopoverTrigger nativeButton={false} render={<span className="inline-flex relative" />}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 relative"
            >
              <Bell className="h-4 w-4" />
              {openIncidents > 0 && (
                <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 flex items-center justify-center rounded-full bg-red-500 text-[10px] text-white border-0">
                  {openIncidents}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="px-4 py-3 border-b border-border/40">
              <p className="text-sm font-semibold">Notifications</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {openIncidents} event{openIncidents !== 1 ? "s" : ""}
                {eventsLoading ? " (loading...)" : ""}
              </p>
            </div>
            <div className="max-h-64 overflow-auto">
              {errorEvents.length === 0 && !eventsLoading && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No recent incidents
                </div>
              )}
              {errorEvents.slice(0, 10).map((evt) => (
                <div
                  key={evt.eventId}
                  className="px-4 py-3 border-b border-border/20 text-sm hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => (window.location.href = `/incidents`)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        evt.errorMessage
                          ? "bg-red-500"
                          : "bg-amber-500"
                      }`}
                    />
                    <span className="font-medium truncate text-xs">
                      {evt.eventName}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {evt.errorMessage || evt.eventSource}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    {new Date(evt.eventTime).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}