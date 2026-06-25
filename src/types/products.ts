export interface MetricPanel {
  id: string;
  title?: string;
  /** Discriminator; omitted on legacy panels (= metric) */
  type?: "metric";
  namespace: string;
  metricName: string;
  stat: string;
  dimensions: Record<string, string>;
  period?: number;
  unit?: string;
  /** When false (Grafana default), partial dimensions match all series */
  matchExact?: boolean;
}

export interface LogPanel {
  id: string;
  title?: string;
  type: "logs";
  /** CloudWatch log group names (e.g. /aws/lambda/my-fn) */
  logGroupNames: string[];
  /** Logs Insights QL query string */
  query: string;
  region?: string;
  timeRange?: string;
  limit?: number;
}

export type ResourcePanel = MetricPanel | LogPanel;

export function isMetricPanel(panel: ResourcePanel): panel is MetricPanel {
  return panel.type !== "logs";
}

export function isLogPanel(panel: ResourcePanel): panel is LogPanel {
  return panel.type === "logs";
}

export interface ProductResource {
  serviceId: string;
  serviceName: string;
  namespace: string;
  type: string;
  region: string;
  /** CloudWatch dimensions discovered for this resource (e.g. ECS ClusterName + ServiceName) */
  dimensions?: Record<string, string>;
  panels?: ResourcePanel[];
  /** Optional group for organizing resources in the product overview */
  groupId?: string;
}

export interface ResourceGroup {
  id: string;
  name: string;
  color?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  color: string;
  resources: ProductResource[];
  resourceGroups?: ResourceGroup[];
  createdAt: string;
  updatedAt: string;
}

export const PRODUCT_COLORS = [
  "#6366f1", // indigo
  "#f97316", // orange
  "#10b981", // emerald
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f59e0b", // amber
  "#ec4899", // pink
  "#14b8a6", // teal
  "#84cc16", // lime
];
