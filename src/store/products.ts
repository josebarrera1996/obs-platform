"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product, ProductResource, MetricPanel, ResourceGroup } from "@/types/products";

interface ProductState {
  products: Product[];
  addProduct: (name: string, description: string, color: string) => Product;
  updateProduct: (id: string, updates: Partial<Omit<Product, "id" | "createdAt">>) => void;
  deleteProduct: (id: string) => void;
  addResourceToProduct: (productId: string, resource: ProductResource) => void;
  removeResourceFromProduct: (productId: string, serviceId: string) => void;
  toggleResource: (productId: string, resource: ProductResource) => void;
  getProduct: (id: string) => Product | undefined;
  findResourceByServiceId: (
    serviceId: string,
    productId?: string
  ) => { product: Product; resource: ProductResource } | undefined;
  // Panel management (per resource)
  addPanel: (productId: string, serviceId: string, panel: MetricPanel) => void;
  updatePanel: (productId: string, serviceId: string, panelId: string, updates: Partial<MetricPanel>) => void;
  removePanel: (productId: string, serviceId: string, panelId: string) => void;
  setResourcePanels: (productId: string, serviceId: string, panels: MetricPanel[]) => void;
  addResourceGroup: (productId: string, name: string, color?: string) => ResourceGroup;
  updateResourceGroup: (
    productId: string,
    groupId: string,
    updates: Partial<Pick<ResourceGroup, "name" | "color">>
  ) => void;
  deleteResourceGroup: (productId: string, groupId: string) => void;
  assignResourceToGroup: (
    productId: string,
    serviceId: string,
    groupId: string | null
  ) => void;
}

export const useProductStore = create<ProductState>()(
  persist(
    (set, get) => ({
      products: [],

      addProduct: (name: string, description: string, color: string) => {
        const product: Product = {
          id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          description,
          color,
          resources: [],
          resourceGroups: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ products: [...state.products, product] }));
        return product;
      },

      updateProduct: (id, updates) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          ),
        }));
      },

      deleteProduct: (id) => {
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        }));
      },

      addResourceToProduct: (productId, resource) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  resources: p.resources.some((r) => r.serviceId === resource.serviceId)
                    ? p.resources
                    : [...p.resources, resource],
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      removeResourceFromProduct: (productId, serviceId) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  resources: p.resources.filter((r) => r.serviceId !== serviceId),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      toggleResource: (productId, resource) => {
        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== productId) return p;
            const exists = p.resources.some((r) => r.serviceId === resource.serviceId);
            return {
              ...p,
              resources: exists
                ? p.resources.filter((r) => r.serviceId !== resource.serviceId)
                : [...p.resources, resource],
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      getProduct: (id) => {
        return get().products.find((p) => p.id === id);
      },

      findResourceByServiceId: (serviceId, productId) => {
        const products = get().products;
        if (productId) {
          const product = products.find((p) => p.id === productId);
          const resource = product?.resources.find((r) => r.serviceId === serviceId);
          return product && resource ? { product, resource } : undefined;
        }
        for (const product of products) {
          const resource = product.resources.find((r) => r.serviceId === serviceId);
          if (resource) return { product, resource };
        }
        return undefined;
      },

      addPanel: (productId, serviceId, panel) => {
        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== productId) return p;
            return {
              ...p,
              resources: p.resources.map((r) =>
                r.serviceId === serviceId
                  ? { ...r, panels: [...(r.panels ?? []), panel] }
                  : r
              ),
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      updatePanel: (productId, serviceId, panelId, updates) => {
        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== productId) return p;
            return {
              ...p,
              resources: p.resources.map((r) =>
                r.serviceId === serviceId
                  ? {
                      ...r,
                      panels: (r.panels ?? []).map((panel) =>
                        panel.id === panelId ? { ...panel, ...updates } : panel
                      ),
                    }
                  : r
              ),
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      removePanel: (productId, serviceId, panelId) => {
        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== productId) return p;
            return {
              ...p,
              resources: p.resources.map((r) =>
                r.serviceId === serviceId
                  ? { ...r, panels: (r.panels ?? []).filter((panel) => panel.id !== panelId) }
                  : r
              ),
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      setResourcePanels: (productId, serviceId, panels) => {
        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== productId) return p;
            return {
              ...p,
              resources: p.resources.map((r) =>
                r.serviceId === serviceId ? { ...r, panels } : r
              ),
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      addResourceGroup: (productId, name, color) => {
        const group: ResourceGroup = {
          id: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: name.trim(),
          color,
        };
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  resourceGroups: [...(p.resourceGroups ?? []), group],
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
        return group;
      },

      updateResourceGroup: (productId, groupId, updates) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  resourceGroups: (p.resourceGroups ?? []).map((g) =>
                    g.id === groupId ? { ...g, ...updates } : g
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      deleteResourceGroup: (productId, groupId) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  resourceGroups: (p.resourceGroups ?? []).filter((g) => g.id !== groupId),
                  resources: p.resources.map((r) =>
                    r.groupId === groupId ? { ...r, groupId: undefined } : r
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      assignResourceToGroup: (productId, serviceId, groupId) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  resources: p.resources.map((r) =>
                    r.serviceId === serviceId
                      ? { ...r, groupId: groupId ?? undefined }
                      : r
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },
    }),
    {
      name: "obs-products",
    }
  )
);
