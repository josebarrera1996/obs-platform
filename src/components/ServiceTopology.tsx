"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, Server, Database, Globe, Zap, Box, Container } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TopologyService {
  id: string;
  name: string;
  type: string;
  status: string;
  namespace: string;
  region?: string;
}

export function ServiceTopology({
  services,
  title = "Service Topology",
}: {
  services: TopologyService[];
  title?: string;
}) {
  // Group services by namespace
  const groups = useMemo(() => {
    const map = new Map<string, TopologyService[]>();
    services.forEach((svc) => {
      const list = map.get(svc.namespace) || [];
      list.push(svc);
      map.set(svc.namespace, list);
    });
    return Array.from(map.entries());
  }, [services]);

  // Generate edges between services in different namespaces
  const edges = useMemo(() => {
    const result: { source: string; target: string }[] = [];
    const namespaces = groups.map(([ns]) => ns);
    // Connect the first service of each namespace to the first of the next
    for (let i = 0; i < namespaces.length - 1; i++) {
      const fromSvcs = groups.find(([ns]) => ns === namespaces[i])?.[1];
      const toSvcs = groups.find(([ns]) => ns === namespaces[i + 1])?.[1];
      if (fromSvcs?.length && toSvcs?.length) {
        result.push({ source: fromSvcs[0].id, target: toSvcs[0].id });
      }
    }
    return result;
  }, [groups]);

  const statusColors: Record<string, { fill: string; bg: string }> = {
    healthy: { fill: "#22c55e", bg: "bg-emerald-500/10" },
    running: { fill: "#22c55e", bg: "bg-emerald-500/10" },
    degraded: { fill: "#f59e0b", bg: "bg-amber-500/10" },
    stopped: { fill: "#f59e0b", bg: "bg-amber-500/10" },
    critical: { fill: "#ef4444", bg: "bg-red-500/10" },
    terminated: { fill: "#ef4444", bg: "bg-red-500/10" },
  };

  const typeIcons: Record<string, typeof Server> = {
    EC2: Server,
    RDS: Database,
    ALB: Globe,
    NLB: Globe,
    Lambda: Zap,
    ECS: Container,
    DynamoDB: Database,
    S3: Box,
    ElastiCache: Database,
    SQS: Box,
    SNS: Box,
  };

  if (services.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Network className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            No services to display in topology
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Network className="h-4 w-4" />
          {title}
          <Badge variant="outline" className="ml-1 text-[10px]">
            {services.length} services
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Topology visualization */}
        <div className="relative min-h-[250px] p-4">
          {/* Render namespace groups */}
          <div className="flex flex-wrap gap-6 justify-center items-start">
            {groups.map(([namespace, svcs]) => (
              <div
                key={namespace}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/40 bg-muted/20 min-w-[160px]"
              >
                <Badge variant="secondary" className="text-[10px] font-mono mb-1">
                  {namespace}
                </Badge>
                {svcs.map((svc) => {
                  const Icon = typeIcons[svc.type] || Server;
                  const colors = statusColors[svc.status] || {
                    fill: "#6b7280",
                    bg: "bg-gray-500/10",
                  };
                  return (
                    <div
                      key={svc.id}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
                      title={`${svc.name} (${svc.type}) - ${svc.status}`}
                    >
                      <div
                        className="flex items-center justify-center w-6 h-6 rounded-md"
                        style={{ backgroundColor: colors.fill + "20" }}
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color: colors.fill }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{svc.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {svc.type}
                        </p>
                      </div>
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: colors.fill }}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Connection legend */}
          {edges.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/20">
              <p className="text-[10px] text-muted-foreground mb-2">Connections:</p>
              <div className="flex flex-wrap gap-2">
                {edges.map((edge, i) => {
                  const source = services.find((s) => s.id === edge.source);
                  const target = services.find((s) => s.id === edge.target);
                  return (
                    <Badge key={i} variant="outline" className="text-[9px] font-mono">
                      {source?.name || edge.source} → {target?.name || edge.target}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}