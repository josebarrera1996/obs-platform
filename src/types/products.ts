export interface ProductResource {
  serviceId: string;
  serviceName: string;
  namespace: string;
  type: string;
  region: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  color: string;
  resources: ProductResource[];
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
