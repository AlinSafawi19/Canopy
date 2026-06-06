import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export interface FieldShape {
  name: string;
  type: string;
  multiple?: boolean;
  options?: string[];
}

const NUMBER_RE = /^-?\d+(\.\d+)?$/;

/**
 * Best-effort conversion of a stored entry value when its field's type (or
 * relation multiplicity) changes. Keeps the value when it's still valid for the
 * new type, otherwise clears it. Never throws.
 */
export function coerceEntryValue(value: unknown, from: FieldShape, to: FieldShape): unknown {
  // → relation: only meaningful when the source was also a relation (values are IDs)
  if (to.type === "relation") {
    let ids: string[] = [];
    if (from.type === "relation") {
      if (Array.isArray(value)) ids = value.filter((x): x is string => typeof x === "string" && !!x);
      else if (typeof value === "string" && value) ids = [value];
    }
    return to.multiple ? ids : (ids[0] ?? "");
  }

  // relation → non-relation: stored IDs are meaningless as text/number/etc.
  if (from.type === "relation") return "";

  // scalar string ↔ scalar string
  const str = typeof value === "string" ? value : "";
  if (!str) return "";

  switch (to.type) {
    case "number":  return NUMBER_RE.test(str.trim()) ? str : "";
    case "boolean": return str === "true" || str === "false" ? str : "";
    case "enum":    return Array.isArray(to.options) && to.options.includes(str) ? str : "";
    case "date":    return Number.isNaN(Date.parse(str)) ? "" : str;
    // text, textarea, rich_text, url, email — all plain strings, interchangeable
    default:        return str;
  }
}

export interface MigrationImpact {
  name: string;
  from: string;
  to: string;
  total: number;     // entries that currently have a value for this field
  converted: number; // values that survive the type change
  cleared: number;   // values that can't be converted and will be wiped
}

function isEmptyValue(v: unknown): boolean {
  if (Array.isArray(v)) return v.length === 0;
  return v === undefined || v === null || v === "";
}

/** Dry-run: how many values would convert vs. be cleared for each changed field. */
export async function computeMigrationImpact(
  catId: string,
  oldFields: FieldShape[],
  newFields: FieldShape[],
): Promise<MigrationImpact[]> {
  const oldByName = new Map(oldFields.map((f) => [f.name, f]));
  const changed = newFields.filter((nf) => {
    const of = oldByName.get(nf.name);
    return of && (of.type !== nf.type || !!of.multiple !== !!nf.multiple);
  });
  if (changed.length === 0) return [];

  const entries = await prisma.contentCategoryEntry.findMany({
    where: { categoryId: catId },
    select: { values: true },
  });

  const impact: MigrationImpact[] = changed.map((nf) => {
    const of = oldByName.get(nf.name)!;
    const label = (f: FieldShape) => (f.type === "relation" && f.multiple ? "relation (multiple)" : f.type);
    return { name: nf.name, from: label(of), to: label(nf), total: 0, converted: 0, cleared: 0 };
  });

  for (const entry of entries) {
    const vals = entry.values as Record<string, unknown>;
    changed.forEach((nf, i) => {
      const raw = vals[nf.name];
      if (isEmptyValue(raw)) return;
      impact[i].total++;
      const next = coerceEntryValue(raw, oldByName.get(nf.name)!, nf);
      if (isEmptyValue(next)) impact[i].cleared++;
      else impact[i].converted++;
    });
  }

  return impact;
}

/**
 * When a category's field schema changes, migrate every entry's stored values
 * for any field whose type or relation-multiplicity changed. Matches fields by
 * name; new/removed fields are left untouched.
 */
export async function migrateEntryValues(
  catId: string,
  oldFields: FieldShape[],
  newFields: FieldShape[],
): Promise<void> {
  const oldByName = new Map(oldFields.map((f) => [f.name, f]));

  const changed = newFields.filter((nf) => {
    const of = oldByName.get(nf.name);
    return of && (of.type !== nf.type || !!of.multiple !== !!nf.multiple);
  });
  if (changed.length === 0) return;

  const entries = await prisma.contentCategoryEntry.findMany({
    where: { categoryId: catId },
    select: { id: true, values: true },
  });

  for (const entry of entries) {
    const vals = { ...(entry.values as Record<string, unknown>) };
    let touched = false;
    for (const nf of changed) {
      if (!(nf.name in vals)) continue;
      const of = oldByName.get(nf.name)!;
      const next = coerceEntryValue(vals[nf.name], of, nf);
      if (JSON.stringify(next) !== JSON.stringify(vals[nf.name])) {
        vals[nf.name] = next;
        touched = true;
      }
    }
    if (touched) {
      await prisma.contentCategoryEntry.update({
        where: { id: entry.id },
        data: { values: vals as Prisma.InputJsonValue },
      });
    }
  }
}
