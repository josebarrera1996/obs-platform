"use client";

import { useState } from "react";
import {
  PanelTransform,
  TransformType,
  TRANSFORM_CATALOG,
  createDefaultTransform,
  type OrganizeFieldConfig,
} from "@/types/transforms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Wand2,
  GripVertical,
} from "lucide-react";

interface TransformPipelineEditorProps {
  transforms: PanelTransform[];
  onChange: (transforms: PanelTransform[]) => void;
  availableFields: string[];
}

function TransformConfig({
  transform,
  availableFields,
  onChange,
}: {
  transform: PanelTransform;
  availableFields: string[];
  onChange: (t: PanelTransform) => void;
}) {
  switch (transform.type) {
    case "filterByValue":
      return (
        <div className="grid grid-cols-3 gap-2">
          <Select
            value={transform.field || undefined}
            onValueChange={(v: string | null) => v && onChange({ ...transform, field: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Field" />
            </SelectTrigger>
            <SelectContent>
              {availableFields.map((f) => (
                <SelectItem key={f} value={f} className="text-xs">
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={transform.operator}
            onValueChange={(v: string | null) =>
              v && onChange({ ...transform, operator: v as typeof transform.operator })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["eq", "ne", "gt", "gte", "lt", "lte", "regex", "isNull", "isNotNull"].map(
                (op) => (
                  <SelectItem key={op} value={op} className="text-xs">
                    {op}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
          {!["isNull", "isNotNull"].includes(transform.operator) && (
            <Input
              className="h-8 text-xs"
              placeholder="Value"
              value={transform.value ?? ""}
              onChange={(e) =>
                onChange({
                  ...transform,
                  value: e.target.value,
                })
              }
            />
          )}
        </div>
      );

    case "organizeFields":
      return (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {(transform.fields.length > 0
            ? transform.fields
            : availableFields.map((name): OrganizeFieldConfig => ({ name, visible: true }))
          ).map((field, idx) => (
            <div key={`${field.name}-${idx}`} className="flex items-center gap-2">
              <Input
                className="h-7 text-xs flex-1 font-mono"
                value={field.name}
                readOnly
              />
              <Input
                className="h-7 text-xs flex-1"
                placeholder="Rename"
                value={field.rename ?? ""}
                onChange={(e) => {
                  const fields = [...(transform.fields.length ? transform.fields : availableFields.map((n): OrganizeFieldConfig => ({ name: n, visible: true })))];
                  fields[idx] = { ...fields[idx], rename: e.target.value };
                  onChange({ ...transform, fields });
                }}
              />
              <label className="text-[10px] flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={field.visible !== false}
                  onChange={(e) => {
                    const fields = [...(transform.fields.length ? transform.fields : availableFields.map((n): OrganizeFieldConfig => ({ name: n, visible: true })))];
                    fields[idx] = { ...fields[idx], visible: e.target.checked };
                    onChange({ ...transform, fields });
                  }}
                />
                Show
              </label>
            </div>
          ))}
          {availableFields.length === 0 && (
            <p className="text-[10px] text-muted-foreground">Run preview to load fields</p>
          )}
        </div>
      );

    case "extractFields":
      return (
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={transform.sourceField || undefined}
            onValueChange={(v: string | null) => v && onChange({ ...transform, sourceField: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Source field" />
            </SelectTrigger>
            <SelectContent>
              {availableFields.map((f) => (
                <SelectItem key={f} value={f} className="text-xs">
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={transform.format}
            onValueChange={(v: string | null) =>
              v && onChange({ ...transform, format: v as "json" | "regex" })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json" className="text-xs">
                JSON
              </SelectItem>
              <SelectItem value="regex" className="text-xs">
                Regex
              </SelectItem>
            </SelectContent>
          </Select>
          {transform.format === "regex" && (
            <Input
              className="h-8 text-xs col-span-2 font-mono"
              placeholder="Regex pattern"
              value={transform.regex ?? ""}
              onChange={(e) => onChange({ ...transform, regex: e.target.value })}
            />
          )}
        </div>
      );

    case "groupBy":
      return (
        <div className="space-y-2">
          <Input
            className="h-8 text-xs"
            placeholder="Group by fields (comma-separated)"
            value={transform.groupByFields.join(", ")}
            onChange={(e) =>
              onChange({
                ...transform,
                groupByFields: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
          {transform.aggregations.map((agg, idx) => (
            <div key={idx} className="flex gap-2">
              <Select
                value={agg.field || undefined}
                onValueChange={(v: string | null) => {
                  const aggregations = [...transform.aggregations];
                  if (v) aggregations[idx] = { ...agg, field: v };
                  onChange({ ...transform, aggregations });
                }}
              >
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Field" />
                </SelectTrigger>
                <SelectContent>
                  {availableFields.map((f) => (
                    <SelectItem key={f} value={f} className="text-xs">
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={agg.op}
                onValueChange={(v: string | null) => {
                  const aggregations = [...transform.aggregations];
                  if (v) aggregations[idx] = { ...agg, op: v as typeof agg.op };
                  onChange({ ...transform, aggregations });
                }}
              >
                <SelectTrigger className="h-8 text-xs w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["sum", "avg", "min", "max", "count", "first", "last"].map((op) => (
                    <SelectItem key={op} value={op} className="text-xs">
                      {op}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() =>
              onChange({
                ...transform,
                aggregations: [...transform.aggregations, { field: "", op: "avg" }],
              })
            }
          >
            <Plus className="h-3 w-3 mr-1" /> Aggregation
          </Button>
        </div>
      );

    case "sql":
      return (
        <textarea
          value={transform.query}
          onChange={(e) => onChange({ ...transform, query: e.target.value })}
          rows={5}
          spellCheck={false}
          className="w-full rounded-lg border border-input bg-muted/30 px-3 py-2 text-xs font-mono"
          placeholder="SELECT * FROM A LIMIT 10"
        />
      );

    case "join":
      return (
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={transform.onField}
            onValueChange={(v: string | null) => v && onChange({ ...transform, onField: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Join field" />
            </SelectTrigger>
            <SelectContent>
              {availableFields.map((f) => (
                <SelectItem key={f} value={f} className="text-xs">
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={transform.mode}
            onValueChange={(v: string | null) =>
              v && onChange({ ...transform, mode: v as "outer" | "inner" })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="outer" className="text-xs">
                Outer merge
              </SelectItem>
              <SelectItem value="inner" className="text-xs">
                Inner merge
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      );

    case "reduce":
      return (
        <div className="space-y-2">
          {transform.fields.map((field, idx) => (
            <div key={idx} className="flex gap-2">
              <Select
                value={field.field || undefined}
                onValueChange={(v: string | null) => {
                  const fields = [...transform.fields];
                  if (v) fields[idx] = { ...field, field: v };
                  onChange({ ...transform, fields });
                }}
              >
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Field" />
                </SelectTrigger>
                <SelectContent>
                  {availableFields.map((f) => (
                    <SelectItem key={f} value={f} className="text-xs">
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={field.op}
                onValueChange={(v: string | null) => {
                  const fields = [...transform.fields];
                  if (v) fields[idx] = { ...field, op: v as typeof field.op };
                  onChange({ ...transform, fields });
                }}
              >
                <SelectTrigger className="h-8 text-xs w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["last", "first", "min", "max", "mean", "sum", "count"].map((op) => (
                    <SelectItem key={op} value={op} className="text-xs">
                      {op}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() =>
              onChange({
                ...transform,
                fields: [...transform.fields, { field: "", op: "mean" }],
              })
            }
          >
            <Plus className="h-3 w-3 mr-1" /> Reducer
          </Button>
        </div>
      );

    default:
      return null;
  }
}

export function TransformPipelineEditor({
  transforms,
  onChange,
  availableFields,
}: TransformPipelineEditorProps) {
  const [showCatalog, setShowCatalog] = useState(false);

  const addTransform = (type: TransformType) => {
    onChange([...transforms, createDefaultTransform(type)]);
    setShowCatalog(false);
  };

  const updateAt = (index: number, updated: PanelTransform) => {
    const copy = [...transforms];
    copy[index] = updated;
    onChange(copy);
  };

  const removeAt = (index: number) => {
    onChange(transforms.filter((_, i) => i !== index));
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= transforms.length) return;
    const copy = [...transforms];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    onChange(copy);
  };

  const catalogItem = (type: TransformType) =>
    TRANSFORM_CATALOG.find((c) => c.type === type);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-violet-500" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Transformations
          </span>
          {transforms.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5">
              {transforms.length}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setShowCatalog((v) => !v)}
        >
          <Plus className="h-3 w-3" />
          Add transform
        </Button>
      </div>

      {showCatalog && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-lg border border-border/50 bg-muted/20">
          {TRANSFORM_CATALOG.map((item) => (
            <button
              key={item.type}
              type="button"
              className="text-left p-3 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-colors"
              onClick={() => addTransform(item.type)}
            >
              <p className="text-xs font-semibold">{item.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.description}</p>
            </button>
          ))}
        </div>
      )}

      {transforms.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No transforms yet. Data flows: Query → Transform → Visualization.
        </p>
      ) : (
        <div className="space-y-2">
          {transforms.map((transform, index) => {
            const meta = catalogItem(transform.type);
            return (
              <div
                key={transform.id}
                className="rounded-lg border border-border/50 bg-background/60 p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                  <Badge variant="outline" className="text-[10px] h-5">
                    {meta?.label ?? transform.type}
                  </Badge>
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => move(index, 1)}
                      disabled={index === transforms.length - 1}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:text-red-500"
                      onClick={() => removeAt(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <TransformConfig
                  transform={transform}
                  availableFields={availableFields}
                  onChange={(t) => updateAt(index, t)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
