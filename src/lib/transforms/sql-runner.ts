import { toNumber } from "./frame";

/** Grafana-style SQL on in-memory rows (table alias A). No external SQL engine. */

function parseOrderBy(clause: string): { field: string; dir: "ASC" | "DESC" }[] {
  return clause.split(",").map((part) => {
    const bits = part.trim().split(/\s+/);
    const field = bits[0];
    const dir = (bits[1]?.toUpperCase() === "DESC" ? "DESC" : "ASC") as "ASC" | "DESC";
    return { field, dir };
  });
}

function compareValues(a: unknown, b: unknown): number {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== null && nb !== null) return na - nb;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function evalCondition(row: Record<string, unknown>, expr: string): boolean {
  const trimmed = expr.trim();

  const nullMatch = /^(\w+)\s+IS\s+NULL$/i.exec(trimmed);
  if (nullMatch) {
    const v = row[nullMatch[1]];
    return v === null || v === undefined || v === "";
  }

  const notNullMatch = /^(\w+)\s+IS\s+NOT\s+NULL$/i.exec(trimmed);
  if (notNullMatch) {
    const v = row[notNullMatch[1]];
    return v !== null && v !== undefined && v !== "";
  }

  const likeMatch = /^(\w+)\s+LIKE\s+'([^']*)'$/i.exec(trimmed);
  if (likeMatch) {
    const pattern = likeMatch[2].replace(/%/g, ".*").replace(/_/g, ".");
    return new RegExp(`^${pattern}$`, "i").test(String(row[likeMatch[1]] ?? ""));
  }

  const cmpMatch = /^(\w+)\s*(=|!=|<>|>=|<=|>|<)\s*(.+)$/i.exec(trimmed);
  if (cmpMatch) {
    const [, field, op, rawVal] = cmpMatch;
    const left = row[field];
    let right: unknown = rawVal.trim();
    if (/^'.*'$/.test(right as string)) {
      right = (right as string).slice(1, -1);
    } else if (/^".*"$/.test(right as string)) {
      right = (right as string).slice(1, -1);
    } else {
      const n = toNumber(right);
      if (n !== null) right = n;
    }

    switch (op) {
      case "=":
        return (
          String(left) === String(right) ||
          (toNumber(left) !== null && toNumber(left) === toNumber(right))
        );
      case "!=":
      case "<>":
        return String(left) !== String(right);
      case ">":
        return compareValues(left, right) > 0;
      case ">=":
        return compareValues(left, right) >= 0;
      case "<":
        return compareValues(left, right) < 0;
      case "<=":
        return compareValues(left, right) <= 0;
    }
  }

  throw new Error(`Unsupported WHERE condition: ${expr}`);
}

function evalWhere(row: Record<string, unknown>, clause: string): boolean {
  const andParts = clause.split(/\s+AND\s+/i);
  return andParts.every((part) => evalCondition(row, part.trim()));
}

function parseSelectList(selectPart: string): string[] | "*" {
  const trimmed = selectPart.trim();
  if (/^\*$/i.test(trimmed)) return "*";
  return trimmed.split(",").map((c) => {
    const col = c.trim();
    const aliasMatch = /\s+AS\s+(\w+)$/i.exec(col);
    if (aliasMatch) return aliasMatch[1];
    return col.split(/\s+/).pop()!;
  });
}

function pickColumns(
  row: Record<string, unknown>,
  columns: string[] | "*"
): Record<string, unknown> {
  if (columns === "*") return { ...row };
  const out: Record<string, unknown> = {};
  for (const col of columns) {
    if (col in row) out[col] = row[col];
  }
  return out;
}

function parseAggregateExpr(expr: string): { fn: string; field: string; alias: string } | null {
  const m = /^(\w+)\s*\(\s*(\*|\w+)\s*\)(?:\s+AS\s+(\w+))?$/i.exec(expr.trim());
  if (!m) return null;
  const fn = m[1].toLowerCase();
  const field = m[2];
  const alias = m[3] || `${fn}_${field === "*" ? "all" : field}`;
  return { fn, field, alias };
}

function runAggregate(fn: string, values: unknown[]): unknown {
  const nums = values.map(toNumber).filter((n): n is number => n !== null);
  switch (fn) {
    case "count":
      return values.length;
    case "sum":
      return nums.reduce((a, b) => a + b, 0);
    case "avg":
    case "average":
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    case "min":
      return nums.length ? Math.min(...nums) : null;
    case "max":
      return nums.length ? Math.max(...nums) : null;
    default:
      throw new Error(`Unsupported aggregate: ${fn}`);
  }
}

export function executeSql(
  rows: Record<string, unknown>[],
  rawQuery: string
): Record<string, unknown>[] {
  const query = rawQuery.trim().replace(/;+\s*$/, "");
  if (!query) return rows;

  if (!/\bFROM\s+A\b/i.test(query)) {
    throw new Error('SQL transform must use table alias A (e.g. SELECT * FROM A)');
  }

  const selectRaw = query
    .replace(/^SELECT\s+/i, "")
    .replace(/\s+(WHERE|GROUP BY|ORDER BY|LIMIT)\s+[\s\S]*$/i, "")
    .trim();

  let tail = query.replace(/^SELECT\s+[\s\S]+?\bFROM\s+A\b/gi, "").trim();
  let where: string | null = null;
  let groupBy: string | null = null;
  let orderBy: string | null = null;
  let limit: number | null = null;

  const limitM = tail.match(/\bLIMIT\s+(\d+)\s*$/i);
  if (limitM) {
    limit = parseInt(limitM[1], 10);
    tail = tail.slice(0, limitM.index).trim();
  }
  const orderM = tail.match(/\bORDER BY\s+([\s\S]+)$/i);
  if (orderM) {
    orderBy = orderM[1].trim();
    tail = tail.slice(0, orderM.index).trim();
  }
  const groupM = tail.match(/\bGROUP BY\s+([\s\S]+)$/i);
  if (groupM) {
    groupBy = groupM[1].trim();
    tail = tail.slice(0, groupM.index).trim();
  }
  const whereM = tail.match(/\bWHERE\s+([\s\S]+)$/i);
  if (whereM) {
    where = whereM[1].trim();
  }

  let result = [...rows];

  if (where) {
    result = result.filter((row) => evalWhere(row, where!));
  }

  if (groupBy) {
    const groupFields = groupBy.split(",").map((f) => f.trim());
    const aggExprs = selectRaw.split(",").map((e) => e.trim());
    const groups = new Map<string, Record<string, unknown>[]>();

    for (const row of result) {
      const key = groupFields.map((f) => String(row[f] ?? "")).join("|||");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    result = [];
    for (const groupRows of groups.values()) {
      const out: Record<string, unknown> = {};
      for (const gf of groupFields) {
        out[gf] = groupRows[0][gf];
      }
      for (const expr of aggExprs) {
        const agg = parseAggregateExpr(expr);
        if (agg) {
          const vals = agg.field === "*" ? groupRows : groupRows.map((r) => r[agg.field]);
          out[agg.alias] = runAggregate(agg.fn, vals);
        } else if (!(expr in out)) {
          out[expr] = groupRows[0][expr];
        }
      }
      result.push(out);
    }
  } else {
    const columns = parseSelectList(selectRaw);
    const hasAgg = selectRaw.split(",").some((e) => parseAggregateExpr(e.trim()));
    if (hasAgg && result.length > 0) {
      const out: Record<string, unknown> = {};
      for (const expr of selectRaw.split(",").map((e) => e.trim())) {
        const agg = parseAggregateExpr(expr);
        if (agg) {
          const vals = agg.field === "*" ? result : result.map((r) => r[agg.field]);
          out[agg.alias] = runAggregate(agg.fn, vals);
        }
      }
      result = [out];
    } else if (columns !== "*") {
      result = result.map((row) => pickColumns(row, columns));
    }
  }

  if (orderBy) {
    const orders = parseOrderBy(orderBy);
    result.sort((a, b) => {
      for (const { field, dir } of orders) {
        const cmp = compareValues(a[field], b[field]);
        if (cmp !== 0) return dir === "DESC" ? -cmp : cmp;
      }
      return 0;
    });
  }

  if (limit !== null && limit >= 0) {
    result = result.slice(0, limit);
  }

  return result;
}
