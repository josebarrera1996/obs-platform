import type {
  DataFrame,
  PanelTransform,
  TransformResult,
  ReduceFieldConfig,
} from "@/types/transforms";
import {
  normalizeFrame,
  inferColumns,
  toNumber,
  detectViewMode,
} from "./frame";
import { executeSql } from "./sql-runner";

function rowPassesFilter(
  row: Record<string, unknown>,
  field: string,
  operator: string,
  value?: string | number
): boolean {
  const raw = row[field];
  const num = toNumber(raw);
  const cmp = toNumber(value);

  switch (operator) {
    case "eq":
      return String(raw) === String(value);
    case "ne":
      return String(raw) !== String(value);
    case "gt":
      return num !== null && cmp !== null && num > cmp;
    case "gte":
      return num !== null && cmp !== null && num >= cmp;
    case "lt":
      return num !== null && cmp !== null && num < cmp;
    case "lte":
      return num !== null && cmp !== null && num <= cmp;
    case "regex":
      try {
        return new RegExp(String(value), "i").test(String(raw ?? ""));
      } catch {
        return false;
      }
    case "isNull":
      return raw === null || raw === undefined || raw === "";
    case "isNotNull":
      return raw !== null && raw !== undefined && raw !== "";
    default:
      return true;
  }
}

function applyFilterByValue(
  frame: DataFrame,
  transform: Extract<PanelTransform, { type: "filterByValue" }>
): DataFrame {
  const rows = frame.rows.filter((row) =>
    rowPassesFilter(row, transform.field, transform.operator, transform.value)
  );
  return { ...frame, rows };
}

function applyOrganizeFields(
  frame: DataFrame,
  transform: Extract<PanelTransform, { type: "organizeFields" }>
): DataFrame {
  if (transform.fields.length === 0) return frame;

  const ordered = transform.fields.filter((f) => f.visible !== false);
  const columns = ordered.map((f) => f.rename?.trim() || f.name);

  const rows = frame.rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const cfg of ordered) {
      if (!(cfg.name in row)) continue;
      const key = cfg.rename?.trim() || cfg.name;
      out[key] = row[cfg.name];
    }
    return out;
  });

  return { columns, rows };
}

function applyExtractFields(
  frame: DataFrame,
  transform: Extract<PanelTransform, { type: "extractFields" }>
): DataFrame {
  const { sourceField, format, regex } = transform;
  const rows = frame.rows.map((row) => {
    const out = { ...row };
    const raw = row[sourceField];
    if (raw === undefined || raw === null) return out;

    if (format === "json") {
      try {
        const parsed = JSON.parse(String(raw));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          for (const [k, v] of Object.entries(parsed)) {
            out[k] = typeof v === "object" ? JSON.stringify(v) : v;
          }
        }
      } catch {
        // keep row unchanged
      }
    } else if (format === "regex" && regex) {
      try {
        const match = String(raw).match(new RegExp(regex));
        if (match?.groups) {
          Object.assign(out, match.groups);
        } else if (match) {
          match.slice(1).forEach((val, i) => {
            out[`group_${i + 1}`] = val;
          });
        }
      } catch {
        // ignore invalid regex
      }
    }
    return out;
  });

  return { columns: inferColumns(rows), rows };
}

function aggregateValues(values: unknown[], op: string): unknown {
  const nums = values.map(toNumber).filter((n): n is number => n !== null);
  switch (op) {
    case "sum":
      return nums.reduce((a, b) => a + b, 0);
    case "avg":
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    case "min":
      return nums.length ? Math.min(...nums) : null;
    case "max":
      return nums.length ? Math.max(...nums) : null;
    case "count":
      return values.length;
    case "first":
      return values[0] ?? null;
    case "last":
      return values[values.length - 1] ?? null;
    default:
      return null;
  }
}

function applyGroupBy(
  frame: DataFrame,
  transform: Extract<PanelTransform, { type: "groupBy" }>
): DataFrame {
  const groups = new Map<string, Record<string, unknown>[]>();
  const groupFields = transform.groupByFields.filter(Boolean);
  if (groupFields.length === 0) return frame;

  for (const row of frame.rows) {
    const key = groupFields.map((f) => String(row[f] ?? "")).join("|||");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const rows: Record<string, unknown>[] = [];
  for (const groupRows of groups.values()) {
    const out: Record<string, unknown> = {};
    for (const gf of groupFields) {
      out[gf] = groupRows[0][gf];
    }
    for (const agg of transform.aggregations) {
      if (!agg.field) continue;
      const alias = agg.alias?.trim() || `${agg.op}_${agg.field}`;
      out[alias] = aggregateValues(
        groupRows.map((r) => r[agg.field]),
        agg.op
      );
    }
    rows.push(out);
  }

  return { columns: inferColumns(rows), rows };
}

function applySql(
  frame: DataFrame,
  transform: Extract<PanelTransform, { type: "sql" }>
): DataFrame {
  const query = transform.query.trim();
  if (!query) return frame;

  try {
    const rows = executeSql(frame.rows, query);
    return { columns: inferColumns(rows), rows };
  } catch (err) {
    throw new Error(`SQL transform failed: ${(err as Error).message}`);
  }
}

function applyJoin(
  frame: DataFrame,
  transform: Extract<PanelTransform, { type: "join" }>
): DataFrame {
  const key = transform.onField || "timestamp";
  const map = new Map<string, Record<string, unknown>>();

  for (const row of frame.rows) {
    const k = String(row[key] ?? "");
    const existing = map.get(k);
    if (!existing) {
      map.set(k, { ...row });
      continue;
    }
    for (const [field, value] of Object.entries(row)) {
      if (field === key) continue;
      if (existing[field] === undefined) {
        existing[field] = value;
      } else if (transform.mode === "inner" && existing[field] !== value) {
        existing.__drop = true;
      }
    }
  }

  const rows = Array.from(map.values()).filter((r) => !r.__drop);
  rows.forEach((r) => delete r.__drop);
  return { columns: inferColumns(rows), rows };
}

function applyReduce(
  frame: DataFrame,
  transform: Extract<PanelTransform, { type: "reduce" }>
): DataFrame {
  const configs = transform.fields.filter((f) => f.field);
  const fieldsToReduce: ReduceFieldConfig[] =
    configs.length > 0
      ? configs
      : inferColumns(frame.rows)
          .filter((c) => c !== "timestamp" && c !== "@timestamp")
          .map((field): ReduceFieldConfig => ({ field, op: "mean" }));

  const out: Record<string, unknown> = {};
  for (const cfg of fieldsToReduce) {
    const alias = cfg.alias?.trim() || `${cfg.op}_${cfg.field}`;
    out[alias] = aggregateValues(
      frame.rows.map((r) => r[cfg.field]),
      cfg.op === "mean" ? "avg" : cfg.op
    );
  }

  return { columns: Object.keys(out), rows: [out] };
}

export function applyTransform(
  frame: DataFrame,
  transform: PanelTransform
): DataFrame {
  if (transform.enabled === false) return frame;
  const normalized = normalizeFrame(frame);

  switch (transform.type) {
    case "filterByValue":
      return applyFilterByValue(normalized, transform);
    case "organizeFields":
      return applyOrganizeFields(normalized, transform);
    case "extractFields":
      return applyExtractFields(normalized, transform);
    case "groupBy":
      return applyGroupBy(normalized, transform);
    case "sql":
      return applySql(normalized, transform);
    case "join":
      return applyJoin(normalized, transform);
    case "reduce":
      return applyReduce(normalized, transform);
    default:
      return normalized;
  }
}

export function applyTransformPipeline(
  frame: DataFrame,
  transforms: PanelTransform[] | undefined
): TransformResult {
  let current = normalizeFrame(frame);

  for (const transform of transforms ?? []) {
    if (transform.enabled === false) continue;
    current = applyTransform(current, transform);
  }

  return {
    frame: current,
    viewMode: detectViewMode(current),
  };
}
