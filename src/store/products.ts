"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product, ProductResource } from "@/types/products";

interface ProductState {
  products: Product[];
  addProduct: (name: string, description: string, color: string) => Product;
  updateProduct: (id: string, updates: Partial<Omit<Product, "id" | "createdAt">>) => void;
  deleteProduct: (id: string) => void;
  addResourceToProduct: (productId: string, resource: ProductResource) => void;
  removeResourceFromProduct: (productId: string, serviceId: string) => void;
  toggleResource: (productId: string, resource: ProductResource) => void;
  getProduct: (id: string) => Product | undefined;
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
    }),
    {
      name: "obs-products",
    }
  )
);
