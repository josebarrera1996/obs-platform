/** Grafana-style panel transforms — applied after query, before visualization */

export type TransformType =
  | "filterByValue"
  | "organizeFields"
  | "extractFields"
  | "groupBy"
  | "sql"
  | "join"
  | "reduce";

export type FilterOperator =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "regex"
  | "isNull"
  | "isNotNull";

export type AggregateOp = "sum" | "avg" | "min" | "max" | "count" | "first" | "last";

export type ReduceOp = "last" | "first" | "min" | "max" | "mean" | "sum" | "count";

export interface FilterByValueTransform {
  id: string;
  type: "filterByValue";
  enabled?: boolean;
  field: string;
  operator: FilterOperator;
  value?: string | number;
}

export interface OrganizeFieldConfig {
  name: string;
  rename?: string;
  visible?: boolean;
}

export interface OrganizeFieldsTransform {
  id: string;
  type: "organizeFields";
  enabled?: boolean;
  fields: OrganizeFieldConfig[];
}

export interface ExtractFieldsTransform {
  id: string;
  type: "extractFields";
  enabled?: boolean;
  sourceField: string;
  format: "json" | "regex";
  /** For regex format — capture group names or use numbered groups */
  regex?: string;
}

export interface GroupByAggregation {
  field: string;
  op: AggregateOp;
  alias?: string;
}

export interface GroupByTransform {
  id: string;
  type: "groupBy";
  enabled?: boolean;
  groupByFields: string[];
  aggregations: GroupByAggregation[];
}

export interface SqlTransform {
  id: string;
  type: "sql";
  enabled?: boolean;
  /** Logs Insights / Grafana style — table alias `A` = query result */
  query: string;
}

export interface JoinTransform {
  id: string;
  type: "join";
  enabled?: boolean;
  onField: string;
  mode: "outer" | "inner";
}

export interface ReduceFieldConfig {
  field: string;
  op: ReduceOp;
  alias?: string;
}

export interface ReduceTransform {
  id: string;
  type: "reduce";
  enabled?: boolean;
  fields: ReduceFieldConfig[];
}

export type PanelTransform =
  | FilterByValueTransform
  | OrganizeFieldsTransform
  | ExtractFieldsTransform
  | GroupByTransform
  | SqlTransform
  | JoinTransform
  | ReduceTransform;

export interface DataFrame {
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface TransformResult {
  frame: DataFrame;
  /** Hint for visualization layer */
  viewMode: "timeseries" | "table" | "stat";
}

export const TRANSFORM_CATALOG: {
  type: TransformType;
  label: string;
  description: string;
}[] = [
  {
    type: "filterByValue",
    label: "Filter data by values",
    description: "Remove rows using field conditions",
  },
  {
    type: "organizeFields",
    label: "Organize fields by name",
    description: "Re-order, hide, or rename columns",
  },
  {
    type: "extractFields",
    label: "Extract fields",
    description: "Parse JSON or regex from a column",
  },
  {
    type: "groupBy",
    label: "Group by",
    description: "Group rows and compute aggregates",
  },
  {
    type: "sql",
    label: "SQL Transform",
    description: "SQL queries on the result set (table A)",
  },
  {
    type: "join",
    label: "Join / Merge",
    description: "Merge rows sharing the same key field",
  },
  {
    type: "reduce",
    label: "Reduce",
    description: "Collapse series to min, max, avg, sum, etc.",
  },
];

export function createDefaultTransform(type: TransformType): PanelTransform {
  const id = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  switch (type) {
    case "filterByValue":
      return { id, type, field: "", operator: "gt", value: 0 };
    case "organizeFields":
      return { id, type, fields: [] };
    case "extractFields":
      return { id, type, sourceField: "", format: "json" };
    case "groupBy":
      return { id, type, groupByFields: [], aggregations: [{ field: "", op: "avg" }] };
    case "sql":
      return {
        id,
        type,
        query: "SELECT *\nFROM A\nLIMIT 100",
      };
    case "join":
      return { id, type, onField: "timestamp", mode: "outer" };
    case "reduce":
      return { id, type, fields: [{ field: "", op: "mean" }] };
  }
}
