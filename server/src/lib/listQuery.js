import { z } from "zod";

// Shared helpers for server-side sorting + per-column filtering on paginated
// list endpoints. Each module declares which columns are sortable / filterable;
// the frontend DataTable drives these via `sortBy` / `sortDir` and per-column
// query params.

// Zod fragment to spread into a module's listQuerySchema. `allowed` is the set
// of sortable column keys the module exposes. sortDir defaults to "desc".
export function sortSchema(allowed) {
  return {
    sortBy: z.enum(allowed).optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
  };
}

// Builds a Prisma `orderBy` from the parsed sort params. `map` translates a
// sortBy key to either a scalar field name or a factory `(dir) => orderByFrag`
// (used for relation ordering, e.g. `{ donor: { fullName: dir } }`). Falls back
// to the module's existing default ordering when sortBy is absent/unknown.
export function buildOrderBy(sortBy, sortDir, { map, fallback }) {
  const dir = sortDir === "asc" ? "asc" : "desc";
  const entry = sortBy ? map[sortBy] : undefined;
  if (!entry) return fallback;
  return typeof entry === "function" ? entry(dir) : { [entry]: dir };
}

// Builds an array of Prisma `where` fragments from per-column filter params.
// `fieldMap` maps a query-param key to a filter definition:
//   { type: "text" }                       → { field: { contains, mode:"insensitive" } }
//   { type: "enum" | "equals" }            → { field: value }
//   { type: "number" }                     → { field: Number(value) }
//   { where: (value) => ({...}) }          → full escape hatch (relations, OR, …)
// `field` defaults to the param key. Empty / missing values are skipped.
// Returns an array so the caller can merge via `where.AND` without key
// collisions when two filters touch the same relation.
export function buildColumnFilters(query, fieldMap) {
  const frags = [];
  for (const [key, def] of Object.entries(fieldMap)) {
    const value = query[key];
    if (value === undefined || value === null || value === "") continue;
    if (typeof def.where === "function") {
      const frag = def.where(value);
      if (frag) frags.push(frag);
      continue;
    }
    const field = def.field || key;
    if (def.type === "text") {
      frags.push({ [field]: { contains: String(value), mode: "insensitive" } });
    } else if (def.type === "number") {
      frags.push({ [field]: Number(value) });
    } else {
      // "enum" / "equals" / default
      frags.push({ [field]: value });
    }
  }
  return frags;
}

// Convenience: merge column-filter fragments into an existing `where` object
// under an AND clause, preserving any AND the caller already set.
export function applyColumnFilters(where, query, fieldMap) {
  const frags = buildColumnFilters(query, fieldMap);
  if (frags.length) {
    where.AND = [...(where.AND ?? []), ...frags];
  }
  return where;
}

// Shared Zod fragment for a free-text column filter param.
export const textFilter = z.string().trim().min(1).max(160).optional();
