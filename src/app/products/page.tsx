"use client";

import { useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useProductStore } from "@/store/products";
import { PRODUCT_COLORS } from "@/types/products";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Plus,
  Package,
  Trash2,
  Settings2,
  AlertTriangle,
  Layers,
  ArrowRight,
} from "lucide-react";

export default function ProductsPage() {
  const { products, addProduct, deleteProduct } = useProductStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRODUCT_COLORS[0]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    addProduct(newName.trim(), newDesc.trim(), selectedColor);
    setNewName("");
    setNewDesc("");
    setSelectedColor(PRODUCT_COLORS[0]);
    setShowCreate(false);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Products</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Group your AWS resources into products for focused monitoring
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Product
          </Button>
        </div>

        {/* ── Product Grid ── */}
        {products.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <Package className="h-16 w-16 text-muted-foreground/30" />
              <div className="text-center">
                <p className="text-lg font-medium text-muted-foreground">No products yet</p>
                <p className="text-sm text-muted-foreground/60 mt-1">
                  Create a product to group related resources (e.g., &quot;Hestia&quot;, &quot;Backend API&quot;)
                </p>
              </div>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Product
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <Card key={product.id} className="group hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: product.color }}
                      >
                        {product.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <CardTitle className="text-base">{product.name}</CardTitle>
                        {product.description && (
                          <CardDescription className="text-xs mt-0.5">
                            {product.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                      onClick={() => deleteProduct(product.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Layers className="h-4 w-4" />
                    <span>{product.resources.length} resource{product.resources.length !== 1 ? "s" : ""}</span>
                  </div>

                  {/* ── Resource preview ── */}
                  {product.resources.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {product.resources.slice(0, 5).map((r) => (
                        <Badge key={r.serviceId} variant="secondary" className="text-xs">
                          {r.serviceName.length > 20 ? r.serviceName.slice(0, 18) + "…" : r.serviceName}
                        </Badge>
                      ))}
                      {product.resources.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{product.resources.length - 5} more
                        </Badge>
                      )}
                    </div>
                  )}

                  <Link
                    href={`/products/${product.id}`}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors mt-2"
                  >
                    View Dashboard
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Create Dialog ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Product</DialogTitle>
            <DialogDescription>
              Define a product to group related AWS resources for focused monitoring.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Product Name</label>
              <Input
                placeholder="e.g. Hestia, Backend API, Data Pipeline"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description (optional)</label>
              <Input
                placeholder="What does this product do?"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Color</label>
              <div className="flex gap-2 flex-wrap">
                {PRODUCT_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      selectedColor === color
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setSelectedColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Create Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}