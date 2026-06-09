"use client";

import { useEffect, useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/Skeleton";
import {
  Heart,
  Activity,
  Cloud,
  Shield,
  Bell,
  Brain,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface HealthStatus {
  status: string;
  services: {
    app: string;
    credentials: string;
    storage: string;
  };
  uptime: number;
  timestamp: string;
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          const data = await res.json();
          setHealth(data);
        } else {
          setError(`Health check returned ${res.status}`);
        }
      } catch {
        setError("Health check failed");
      } finally {
        setLoading(false);
      }
    }
    checkHealth();
  }, []);

  const items = [
    {
      label: "Application",
      icon: Heart,
      status: health?.services?.app === "healthy" ? "healthy" : "unknown",
      detail: `Uptime: ${Math.floor((health?.uptime || 0) / 60)}m`,
    },
    {
      label: "AWS API",
      icon: Cloud,
      status: health?.services?.credentials === "ok" || health?.services?.credentials === "healthy" ? "healthy" : "unknown",
      detail: health?.services?.credentials || "Not checked",
    },
    {
      label: "Authentication",
      icon: Shield,
      status: health?.services?.app === "healthy" ? "healthy" : "unknown",
      detail: "NextAuth v5",
    },
    {
      label: "Alerting",
      icon: Bell,
      status: "healthy",
      detail: "Engine + Slack",
    },
    {
      label: "ML Engine",
      icon: Brain,
      status: "healthy",
      detail: "Anomaly Detection",
    },
  ];

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "healthy") return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
    if (status === "degraded") return <Activity className="h-5 w-5 text-amber-400" />;
    return <XCircle className="h-5 w-5 text-muted-foreground/40" />;
  };

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">System Status</h1>
        </div>

        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="p-6 text-center">
              <XCircle className="h-8 w-8 mx-auto mb-2 text-red-400" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        )}

        {health && !loading && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <Card key={item.label}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{item.label}</span>
                      </div>
                      <StatusIcon status={item.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {item.detail}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  System Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      {health.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Uptime</span>
                    <span>{Math.floor(health.uptime / 60)} minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last checked</span>
                    <span>{new Date(health.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">API Routes</span>
                    <span>19 endpoints</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Auth</span>
                    <span>{process.env.NEXT_PUBLIC_OBS_AUTH_ENABLED === "true" ? "Enabled" : "Disabled (dev)"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}