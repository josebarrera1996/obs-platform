import { Account, Service, Operation, Incident } from "@/types";

export const accounts: Account[] = [
  {
    id: "acc-1",
    name: "Production AWS",
    type: "aws",
    status: "healthy",
    uptime: 99.97,
    servicesCount: 8,
    incidentsCount: 1,
    region: "us-east-1",
  },
  {
    id: "acc-2",
    name: "Staging GCP",
    type: "gcp",
    status: "degraded",
    uptime: 98.2,
    servicesCount: 6,
    incidentsCount: 3,
    region: "us-central1",
  },
  {
    id: "acc-3",
    name: "K8s Production",
    type: "kubernetes",
    status: "healthy",
    uptime: 99.99,
    servicesCount: 12,
    incidentsCount: 0,
    region: "eu-west-1",
  },
  {
    id: "acc-4",
    name: "Azure Dev",
    type: "azure",
    status: "critical",
    uptime: 94.5,
    servicesCount: 4,
    incidentsCount: 5,
    region: "eastus",
  },
  {
    id: "acc-5",
    name: "GCP Analytics",
    type: "gcp",
    status: "healthy",
    uptime: 99.5,
    servicesCount: 5,
    incidentsCount: 0,
    region: "europe-west4",
  },
];

export const services: Service[] = [
  // acc-1: Production AWS
  { id: "svc-1", accountId: "acc-1", name: "api-gateway", status: "healthy", cpu: 34, memory: 67, latency: 45, errorRate: 0.02, uptime: 99.99, rps: 2300, type: "Gateway" },
  { id: "svc-2", accountId: "acc-1", name: "user-service", status: "degraded", cpu: 72, memory: 83, latency: 230, errorRate: 1.2, uptime: 99.91, rps: 890, type: "Microservice" },
  { id: "svc-3", accountId: "acc-1", name: "order-service", status: "healthy", cpu: 45, memory: 58, latency: 89, errorRate: 0.1, uptime: 99.95, rps: 560, type: "Microservice" },
  { id: "svc-4", accountId: "acc-1", name: "payment-service", status: "healthy", cpu: 28, memory: 41, latency: 120, errorRate: 0.05, uptime: 99.98, rps: 340, type: "Microservice" },
  { id: "svc-5", accountId: "acc-1", name: "notification-service", status: "healthy", cpu: 12, memory: 35, latency: 30, errorRate: 0.0, uptime: 100, rps: 1200, type: "Worker" },
  { id: "svc-6", accountId: "acc-1", name: "auth-service", status: "healthy", cpu: 55, memory: 62, latency: 65, errorRate: 0.01, uptime: 99.97, rps: 1800, type: "Microservice" },
  { id: "svc-7", accountId: "acc-1", name: "cache-layer", status: "healthy", cpu: 18, memory: 78, latency: 2, errorRate: 0.0, uptime: 99.99, rps: 15000, type: "Infrastructure" },
  { id: "svc-8", accountId: "acc-1", name: "search-service", status: "degraded", cpu: 88, memory: 92, latency: 340, errorRate: 2.1, uptime: 99.7, rps: 420, type: "Microservice" },
  // acc-2: Staging GCP
  { id: "svc-9", accountId: "acc-2", name: "api-gateway-stg", status: "degraded", cpu: 56, memory: 71, latency: 180, errorRate: 3.5, uptime: 97.5, rps: 450, type: "Gateway" },
  { id: "svc-10", accountId: "acc-2", name: "user-service-stg", status: "healthy", cpu: 23, memory: 44, latency: 55, errorRate: 0.3, uptime: 99.2, rps: 120, type: "Microservice" },
  { id: "svc-11", accountId: "acc-2", name: "order-service-stg", status: "healthy", cpu: 15, memory: 38, latency: 42, errorRate: 0.0, uptime: 99.8, rps: 80, type: "Microservice" },
  { id: "svc-12", accountId: "acc-2", name: "ml-pipeline", status: "degraded", cpu: 91, memory: 88, latency: 5200, errorRate: 5.8, uptime: 96.1, rps: 15, type: "Pipeline" },
  { id: "svc-13", accountId: "acc-2", name: "data-warehouse", status: "healthy", cpu: 62, memory: 76, latency: 890, errorRate: 0.8, uptime: 98.9, rps: 45, type: "Data" },
  { id: "svc-14", accountId: "acc-2", name: "event-bus", status: "healthy", cpu: 31, memory: 55, latency: 8, errorRate: 0.0, uptime: 99.95, rps: 3400, type: "Infrastructure" },
  // acc-3: K8s Production
  { id: "svc-15", accountId: "acc-3", name: "frontend-web", status: "healthy", cpu: 41, memory: 52, latency: 15, errorRate: 0.01, uptime: 99.99, rps: 5600, type: "Frontend" },
  { id: "svc-16", accountId: "acc-3", name: "bff-layer", status: "healthy", cpu: 38, memory: 48, latency: 22, errorRate: 0.0, uptime: 100, rps: 4800, type: "Gateway" },
  { id: "svc-17", accountId: "acc-3", name: "catalog-service", status: "healthy", cpu: 52, memory: 66, latency: 95, errorRate: 0.2, uptime: 99.98, rps: 780, type: "Microservice" },
  { id: "svc-18", accountId: "acc-3", name: "cart-service", status: "healthy", cpu: 29, memory: 43, latency: 35, errorRate: 0.01, uptime: 99.99, rps: 1200, type: "Microservice" },
  { id: "svc-19", accountId: "acc-3", name: "checkout-service", status: "degraded", cpu: 78, memory: 85, latency: 410, errorRate: 3.2, uptime: 99.1, rps: 280, type: "Microservice" },
  { id: "svc-20", accountId: "acc-3", name: "recommendation-engine", status: "healthy", cpu: 64, memory: 72, latency: 160, errorRate: 0.5, uptime: 99.7, rps: 340, type: "Microservice" },
  { id: "svc-21", accountId: "acc-3", name: "inventory-service", status: "healthy", cpu: 33, memory: 47, latency: 55, errorRate: 0.0, uptime: 99.95, rps: 450, type: "Microservice" },
  { id: "svc-22", accountId: "acc-3", name: "shipping-service", status: "healthy", cpu: 22, memory: 38, latency: 70, errorRate: 0.1, uptime: 99.8, rps: 190, type: "Microservice" },
  { id: "svc-23", accountId: "acc-3", name: "cdn", status: "healthy", cpu: 8, memory: 12, latency: 1.5, errorRate: 0.0, uptime: 100, rps: 45000, type: "Infrastructure" },
  { id: "svc-24", accountId: "acc-3", name: "message-queue", status: "healthy", cpu: 15, memory: 28, latency: 3, errorRate: 0.0, uptime: 99.99, rps: 22000, type: "Infrastructure" },
  { id: "svc-25", accountId: "acc-3", name: "logging-pipeline", status: "healthy", cpu: 45, memory: 68, latency: 12, errorRate: 0.0, uptime: 99.9, rps: 8000, type: "Pipeline" },
  { id: "svc-26", accountId: "acc-3", name: "monitoring-agent", status: "healthy", cpu: 11, memory: 22, latency: 5, errorRate: 0.0, uptime: 100, rps: 12000, type: "Agent" },
  // acc-4: Azure Dev
  { id: "svc-27", accountId: "acc-4", name: "dev-api", status: "critical", cpu: 96, memory: 94, latency: 5200, errorRate: 12.5, uptime: 82.3, rps: 65, type: "Gateway" },
  { id: "svc-28", accountId: "acc-4", name: "experiment-service", status: "degraded", cpu: 45, memory: 67, latency: 290, errorRate: 4.2, uptime: 95.8, rps: 25, type: "Microservice" },
  { id: "svc-29", accountId: "acc-4", name: "sandbox-db", status: "critical", cpu: 34, memory: 99, latency: 8900, errorRate: 8.1, uptime: 88.4, rps: 10, type: "Data" },
  { id: "svc-30", accountId: "acc-4", name: "feature-flags", status: "healthy", cpu: 8, memory: 15, latency: 8, errorRate: 0.0, uptime: 99.5, rps: 90, type: "Infrastructure" },
  // acc-5: GCP Analytics
  { id: "svc-31", accountId: "acc-5", name: "analytics-api", status: "healthy", cpu: 48, memory: 55, latency: 210, errorRate: 0.3, uptime: 99.6, rps: 320, type: "Gateway" },
  { id: "svc-32", accountId: "acc-5", name: "data-pipeline", status: "healthy", cpu: 68, memory: 74, latency: 450, errorRate: 0.1, uptime: 99.4, rps: 180, type: "Pipeline" },
  { id: "svc-33", accountId: "acc-5", name: "reporting-engine", status: "degraded", cpu: 82, memory: 80, latency: 890, errorRate: 2.4, uptime: 98.2, rps: 55, type: "Microservice" },
  { id: "svc-34", accountId: "acc-5", name: "bigquery-connector", status: "healthy", cpu: 38, memory: 42, latency: 320, errorRate: 0.02, uptime: 99.8, rps: 110, type: "Data" },
  { id: "svc-35", accountId: "acc-5", name: "dashboard-service", status: "healthy", cpu: 25, memory: 48, latency: 95, errorRate: 0.0, uptime: 99.9, rps: 230, type: "Frontend" },
];

export const operations: Operation[] = [
  // svc-1: api-gateway
  { id: "op-1", serviceId: "svc-1", name: "Proxy Request", method: "GET", path: "/api/*", rps: 950, p95Latency: 12, errorRate: 0.01, status: "healthy", avgDuration: 8 },
  { id: "op-2", serviceId: "svc-1", name: "Authenticate", method: "POST", path: "/api/auth", rps: 620, p95Latency: 45, errorRate: 0.05, status: "healthy", avgDuration: 32 },
  { id: "op-3", serviceId: "svc-1", name: "Rate Limiter", method: "GET", path: "/api/*", rps: 1800, p95Latency: 2, errorRate: 0.0, status: "healthy", avgDuration: 1 },
  // svc-2: user-service (degraded)
  { id: "op-4", serviceId: "svc-2", name: "GetUser", method: "GET", path: "/users/:id", rps: 340, p95Latency: 85, errorRate: 0.2, status: "healthy", avgDuration: 55 },
  { id: "op-5", serviceId: "svc-2", name: "UpdateProfile", method: "PUT", path: "/users/:id/profile", rps: 80, p95Latency: 190, errorRate: 1.8, status: "degraded", avgDuration: 140 },
  { id: "op-6", serviceId: "svc-2", name: "ListUsers", method: "GET", path: "/users", rps: 150, p95Latency: 420, errorRate: 3.2, status: "critical", avgDuration: 380 },
  { id: "op-7", serviceId: "svc-2", name: "DeleteUser", method: "DELETE", path: "/users/:id", rps: 15, p95Latency: 56, errorRate: 0.0, status: "healthy", avgDuration: 42 },
  // svc-3: order-service
  { id: "op-8", serviceId: "svc-3", name: "CreateOrder", method: "POST", path: "/orders", rps: 120, p95Latency: 95, errorRate: 0.1, status: "healthy", avgDuration: 72 },
  { id: "op-9", serviceId: "svc-3", name: "GetOrder", method: "GET", path: "/orders/:id", rps: 280, p95Latency: 45, errorRate: 0.05, status: "healthy", avgDuration: 30 },
  { id: "op-10", serviceId: "svc-3", name: "CancelOrder", method: "POST", path: "/orders/:id/cancel", rps: 35, p95Latency: 160, errorRate: 0.3, status: "healthy", avgDuration: 120 },
  // svc-4: payment-service
  { id: "op-11", serviceId: "svc-4", name: "ProcessPayment", method: "POST", path: "/payments", rps: 180, p95Latency: 340, errorRate: 0.08, status: "healthy", avgDuration: 280 },
  { id: "op-12", serviceId: "svc-4", name: "Refund", method: "POST", path: "/payments/:id/refund", rps: 12, p95Latency: 890, errorRate: 0.5, status: "healthy", avgDuration: 720 },
  { id: "op-13", serviceId: "svc-4", name: "GetPaymentStatus", method: "GET", path: "/payments/:id", rps: 150, p95Latency: 18, errorRate: 0.0, status: "healthy", avgDuration: 12 },
  // svc-8: search-service (degraded)
  { id: "op-14", serviceId: "svc-8", name: "Search", method: "GET", path: "/search", rps: 280, p95Latency: 520, errorRate: 3.5, status: "critical", avgDuration: 460 },
  { id: "op-15", serviceId: "svc-8", name: "IndexDocument", method: "POST", path: "/search/index", rps: 45, p95Latency: 230, errorRate: 1.2, status: "degraded", avgDuration: 190 },
  { id: "op-16", serviceId: "svc-8", name: "RebuildIndex", method: "POST", path: "/search/reindex", rps: 1, p95Latency: 15000, errorRate: 0.0, status: "healthy", avgDuration: 12000 },
  // svc-12: ml-pipeline (degraded)
  { id: "op-17", serviceId: "svc-12", name: "RunPrediction", method: "POST", path: "/ml/predict", rps: 8, p95Latency: 8900, errorRate: 8.5, status: "critical", avgDuration: 7200 },
  { id: "op-18", serviceId: "svc-12", name: "TrainModel", method: "POST", path: "/ml/train", rps: 1, p95Latency: 25000, errorRate: 2.0, status: "degraded", avgDuration: 18000 },
  { id: "op-19", serviceId: "svc-12", name: "GetModelStatus", method: "GET", path: "/ml/models/:id", rps: 5, p95Latency: 120, errorRate: 0.5, status: "healthy", avgDuration: 80 },
  // svc-19: checkout-service
  { id: "op-20", serviceId: "svc-19", name: "Checkout", method: "POST", path: "/checkout", rps: 85, p95Latency: 620, errorRate: 4.5, status: "critical", avgDuration: 520 },
  { id: "op-21", serviceId: "svc-19", name: "ValidateCart", method: "POST", path: "/checkout/validate", rps: 200, p95Latency: 95, errorRate: 0.3, status: "healthy", avgDuration: 65 },
  // svc-27: dev-api (critical)
  { id: "op-22", serviceId: "svc-27", name: "DevProxy", method: "GET", path: "/dev/*", rps: 40, p95Latency: 7800, errorRate: 15.0, status: "critical", avgDuration: 6500 },
  { id: "op-23", serviceId: "svc-27", name: "WebSocket", method: "GET", path: "/dev/ws", rps: 8, p95Latency: 1200, errorRate: 8.0, status: "critical", avgDuration: 950 },
  // svc-33: reporting-engine
  { id: "op-24", serviceId: "svc-33", name: "GenerateReport", method: "POST", path: "/reports/generate", rps: 20, p95Latency: 2100, errorRate: 3.8, status: "degraded", avgDuration: 1800 },
  { id: "op-25", serviceId: "svc-33", name: "GetReport", method: "GET", path: "/reports/:id", rps: 35, p95Latency: 340, errorRate: 1.2, status: "degraded", avgDuration: 280 },
];

export const incidents: Incident[] = [
  { id: "inc-1", serviceId: "svc-2", severity: "warning", title: "High latency on ListUsers", description: "P95 latency spiked to 420ms after deploy v2.4.1", status: "acknowledged", createdAt: "2026-06-08T08:23:00Z" },
  { id: "inc-2", serviceId: "svc-8", severity: "critical", title: "Search service 5xx errors", description: "Search endpoint returning 503 for 3.5% of requests", status: "open", createdAt: "2026-06-08T08:45:00Z" },
  { id: "inc-3", serviceId: "svc-12", severity: "critical", title: "ML pipeline predictions failing", description: "RunPrediction errors at 8.5% — suspected model drift", status: "open", createdAt: "2026-06-08T07:15:00Z" },
  { id: "inc-4", serviceId: "svc-19", severity: "critical", title: "Checkout service degraded", description: "Error rate at 4.5% on checkout — investigating DB connection pool", status: "open", createdAt: "2026-06-08T09:00:00Z" },
  { id: "inc-5", serviceId: "svc-27", severity: "critical", title: "Dev API unreachable", description: "Dev API returning timeout errors, CPU at 96%", status: "open", createdAt: "2026-06-08T06:30:00Z" },
  { id: "inc-6", serviceId: "svc-29", severity: "critical", title: "Sandbox DB memory exhaustion", description: "Memory usage at 99% — swap thrashing detected", status: "open", createdAt: "2026-06-08T05:50:00Z" },
  { id: "inc-7", serviceId: "svc-33", severity: "warning", title: "Report generation slow", description: "P95 latency at 2100ms for report generation", status: "acknowledged", createdAt: "2026-06-08T08:00:00Z" },
  { id: "inc-8", serviceId: "svc-9", severity: "warning", title: "Staging gateway elevated errors", description: "Error rate at 3.5% — possible config drift", status: "resolved", createdAt: "2026-06-07T22:00:00Z", resolvedAt: "2026-06-08T02:00:00Z" },
  { id: "inc-9", serviceId: "svc-28", severity: "warning", title: "Experiment service slow queries", description: "DB query performance degradation on experiment-service", status: "acknowledged", createdAt: "2026-06-07T18:00:00Z" },
];

export const timeRanges = [
  { label: "1h", value: "1h" },
  { label: "6h", value: "6h" },
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
];

// Helpers
export function getAccountById(id: string) { return accounts.find((a) => a.id === id); }
export function getServicesByAccount(accountId: string) { return services.filter((s) => s.accountId === accountId); }
export function getServiceById(id: string) { return services.find((s) => s.id === id); }
export function getOperationsByService(serviceId: string) { return operations.filter((o) => o.serviceId === serviceId); }
export function getIncidentsByService(serviceId: string) { return incidents.filter((i) => i.serviceId === serviceId); }
export function getIncidentsByAccount(accountId: string) {
  const svcIds = services.filter((s) => s.accountId === accountId).map((s) => s.id);
  return incidents.filter((i) => svcIds.includes(i.serviceId));
}
