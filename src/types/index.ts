export type AccountType = "aws" | "gcp" | "azure" | "kubernetes";

export type Status = "healthy" | "degraded" | "critical";
export type IncidentSeverity = "critical" | "warning" | "info";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  status: Status;
  uptime: number; // percentage 0-100
  servicesCount: number;
  incidentsCount: number;
  region: string;
}

export interface Service {
  id: string;
  accountId: string;
  name: string;
  status: Status;
  cpu: number; // percentage
  memory: number; // percentage
  latency: number; // ms (p95)
  errorRate: number; // percentage
  uptime: number; // percentage
  rps: number;
  type: string;
}

export interface Operation {
  id: string;
  serviceId: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  rps: number;
  p95Latency: number; // ms
  errorRate: number; // percentage
  status: Status;
  avgDuration: number; // ms
}

export interface Incident {
  id: string;
  serviceId: string;
  severity: IncidentSeverity;
  title: string;
  description: string;
  status: "open" | "resolved" | "acknowledged";
  createdAt: string;
  resolvedAt?: string;
}

export interface TimeRange {
  label: string;
  value: string; // e.g. "1h", "6h", "24h", "7d", "30d"
}

export interface TimeseriesPoint {
  timestamp: string;
  value: number;
}
