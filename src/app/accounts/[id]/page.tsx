"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { MainLayout } from "@/components/MainLayout";
import { useSettingsStore } from "@/store/settings";
import type { AwsAccount } from "@/store/settings";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Server,
  Activity,
  AlertTriangle,
  Timer,
  XCircle,
  Cloud,
  ArrowLeft,
} from "lucide-react";

interface DiscoveredService {
  id: string;
  name: string;
  namespace: string;
  type: string;
  status: string;
  region: string;
  metrics: { name: string; unit: string }[];
  dimensions?: Record<string, string>;
}

interface ServicesResponse {
  services: DiscoveredService[];
  totalCount: number;
  byNamespace: Record<string, number>;
  region: string;
  lastUpdated: string;
  errors?: string[];
}

export default function AccountDetailPage() {
  const params = useParams();
  const accountId = params.id as string;

  const activeCredentialId = useSettingsStore((s) => s.activeCredentialId);
  const awsAccounts = useSettingsStore((s) => s.accounts);

  const [account, setAccount] = useState<AwsAccount | null>(null);
  const [services, setServices] = useState<DiscoveredService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Find account in store
  useEffect(() => {
    const found = awsAccounts.find((a) => a.id === accountId);
    if (found) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccount(found);
    } else if (awsAccounts.length > 0) {
      setError(`Account "${accountId}" not found`);
      setLoading(false);
    }
  }, [accountId, awsAccounts]);

  // Fetch services for this account
  const fetchServices = useCallback(async () => {
    if (!activeCredentialId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/aws/services?credentialId=${activeCredentialId}`
      );
      if (!res.ok) throw new Error("Failed to fetch services");
      const data: ServicesResponse = await res.json();
      setServices(data.services || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load services");
    } finally {
      setLoading(false);
    }
  }, [activeCredentialId]);

  useEffect(() => {
    if (activeCredentialId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchServices();
    }
  }, [fetchServices, activeCredentialId]);

  // Status helpers
  const statusColor = (status: string) => {
    switch (status) {
      case "healthy":
      case "running":
        return "bg-emerald-500";
      case "degraded":
      case "stopped":
        return "bg-amber-500";
      case "critical":
      case "terminated":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "healthy":
      case "running":
        return "Healthy";
      case "degraded":
      case "stopped":
        return "Degraded";
      case "critical":
      case "terminated":
        return "Critical";
      default:
        return status;
    }
  };

  if (!account && awsAccounts.length > 0 && !loading) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <XCircle className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">{error || "Account not found"}</p>
          <Link href="/">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Cloud className="h-6 w-6 text-primary" />
              {loading ? (
                <Skeleton className="h-8 w-48" />
              ) : (
                <h1 className="text-2xl font-bold">
                  {account?.alias || account?.accountId || "Account"}
                </h1>
              )}
            </div>
            {account && (
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span>AWS · {account.region}</span>
                <span className="flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${statusColor(account.status)}`} />
                  {statusLabel(account.status)}
                </span>
                <span>{account.servicesCount} services</span>
                <span>{account.uptime}% uptime</span>
              </div>
            )}
          </div>
        </div>

        {/* Loading skeleton */}
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-24 mb-4" />
                    <div className="space-y-2">
                      <Skeleton className="h-2 w-full" />
                      <Skeleton className="h-2 w-3/4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <XCircle className="h-12 w-12 text-red-400/60" />
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={fetchServices}>
              Retry
            </Button>
          </div>
        )}

        {/* Services Grid */}
        {!loading && !error && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Server className="h-4 w-4" />
                    Total Services
                  </div>
                  <p className="text-2xl font-bold">{services.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Activity className="h-4 w-4" />
                    Healthy
                  </div>
                  <p className="text-2xl font-bold text-emerald-500">
                    {services.filter((s) => s.status === "running" || s.status === "healthy").length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    Degraded
                  </div>
                  <p className="text-2xl font-bold text-amber-500">
                    {services.filter((s) => s.status === "degraded" || s.status === "stopped").length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Timer className="h-4 w-4" />
                    Uptime
                  </div>
                  <p className="text-2xl font-bold">{account?.uptime || 99.9}%</p>
                </CardContent>
              </Card>
            </div>

            {/* Services per namespace */}
            {Object.entries(
              services.reduce((acc, svc) => {
                acc[svc.namespace] = (acc[svc.namespace] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([namespace, count]) => (
              <div key={namespace}>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-muted-foreground" />
                  {namespace}
                  <Badge variant="outline" className="ml-2">{count}</Badge>
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {services
                    .filter((s) => s.namespace === namespace)
                    .map((service) => (
                      <Link
                        key={service.id}
                        href={`/service-detail?credentialId=${activeCredentialId}&serviceId=${service.id}&namespace=${service.namespace}&region=${service.region}${service.dimensions ? `&dimensions=${encodeURIComponent(JSON.stringify(service.dimensions))}` : ""}`}
                        className="block"
                      >
                        <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Server className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-sm">{service.name}</span>
                              </div>
                              <Badge variant="outline" className="text-[10px]">
                                {service.type}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <span className={`h-1.5 w-1.5 rounded-full ${statusColor(service.status)}`} />
                                {statusLabel(service.status)}
                              </span>
                              <span>{service.region}</span>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                </div>
              </div>
            ))}

            {/* No services state */}
            {services.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Cloud className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No services found in this account.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}