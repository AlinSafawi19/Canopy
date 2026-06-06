import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateId } from "@/lib/utils";
import { validateEntryValues } from "@/lib/limits";

export type IoField = { name: string; type: string; options?: string[] };
export type ImportMode = "replace" | "merge";

// ── CSV helpers ────────────────────────────────────────────────────────────────

function csvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCSV(fields: IoField[], rows: Array<Record<string, unknown>>): string {
  const header = fields.map((f) => csvCell(f.name)).join(",");
  const lines = rows.map((row) =>
    fields.map((f) => csvCell(String(row[f.name] ?? ""))).join(",")
  );
  return [header, ...lines].join("\n");
}

// ── Export handler (shared across roles) ──────────────────────────────────────

export async function handleExport(
  request: NextRequest,
  category: { id: string; name: string; slug: string | null; fields: unknown },
): Promise<NextResponse | Response> {
  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";
  const idsParam = request.nextUrl.searchParams.get("ids");
  const ids = idsParam ? idsParam.split(",").filter(Boolean) : null;
  const fields = (Array.isArray(category.fields) ? category.fields : []) as IoField[];
  const filename = (category.slug ?? category.name).replace(/[^a-z0-9_-]/gi, "_");

  const entries = await prisma.contentCategoryEntry.findMany({
    where: {
      categoryId: category.id,
      archivedAt: null,
      ...(ids ? { id: { in: ids } } : {}),
    },
    orderBy: { sortIndex: "asc" },
    select: { values: true },
    take: 10_000,
  });

  const rows = entries.map((e) => e.values as Record<string, unknown>);

  if (format === "csv") {
    const csv = toCSV(fields, rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}-entries.csv"`,
      },
    });
  }

  const json = JSON.stringify(rows, null, 2);
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}-entries.json"`,
    },
  });
}

// ── Import handler (shared across roles) ──────────────────────────────────────

const MAX_IMPORT_ROWS = 500;

const HTML_RE = /<[a-z][\s\S]*?>/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]*)?\s*$/;
const BOOL_RE = /^(true|false)$/i;
const NUMBER_RE = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;
const URL_RE = /^https?:\/\/.+/i;
const SAFE_FIELD_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_ ]{0,63}$/;

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, (e) => {
    const map: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
    return map[e] ?? e;
  });
}

function inferFieldType(value: unknown): string {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") {
    const t = value.trim();
    if (HTML_RE.test(t)) return "rich_text";
    if (BOOL_RE.test(t)) return "boolean";
    if (ISO_DATE_RE.test(t)) return "date";
  }
  return "text";
}

// Returns inferred type (and options for enum) by inspecting all rows in a column.
function inferColumnType(rows: Record<string, unknown>[], key: string): Pick<IoField, "type" | "options"> {
  const nonEmpty = rows.map(r => r[key]).filter(v => v !== "" && v !== null && v !== undefined);

  // All numeric → number
  if (nonEmpty.length > 0 && nonEmpty.every(v =>
    (typeof v === "number" && isFinite(v)) ||
    (typeof v === "string" && NUMBER_RE.test((v as string).trim()))
  )) return { type: "number" };

  // All URLs → url
  if (nonEmpty.length > 0 && nonEmpty.every(v =>
    typeof v === "string" && URL_RE.test((v as string).trim())
  )) return { type: "url" };

  // Repeated values from a small finite set → enum
  const strValues = nonEmpty.map(v => String(v));
  const distinct = new Set(strValues);
  if (
    distinct.size >= 2 &&
    distinct.size <= 20 &&
    distinct.size < strValues.length &&
    strValues.every(v => !HTML_RE.test(v) && !ISO_DATE_RE.test(v.trim()) && !BOOL_RE.test(v.trim()))
  ) return { type: "enum", options: Array.from(distinct) };

  return { type: inferFieldType(rows[0]?.[key]) };
}

function normalizeValue(raw: unknown, type: string): string {
  if (type === "boolean") {
    if (typeof raw === "boolean") return String(raw);
    return String(raw ?? "").trim().toLowerCase() === "true" ? "true" : "false";
  }
  if (type === "date") {
    const m = String(raw ?? "").trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : String(raw ?? "");
  }
  if (type === "number") {
    const n = Number(String(raw ?? "").trim());
    return isNaN(n) ? "" : String(n);
  }
  const str = String(raw ?? "");
  // Strip HTML from plain text fields to prevent stored XSS
  if (type === "text") return stripHtml(str);
  return str;
}

// Explains exactly why a column name fails the safe-name rule, naming the
// specific offending characters so the user knows what to change.
function describeInvalidFieldName(key: string): string {
  const reasons: string[] = [];

  if (key.trim() === "") {
    return "it is empty — every column needs a name";
  }
  if (key.length > 64) {
    reasons.push(`it is ${key.length} characters long (the maximum is 64)`);
  }
  if (!/^[a-zA-Z_]/.test(key)) {
    reasons.push(`it starts with "${key[0]}" — names must begin with a letter (a–z) or an underscore (_)`);
  }
  const disallowed = Array.from(new Set(Array.from(key).filter((c) => !/[a-zA-Z0-9_ ]/.test(c))));
  if (disallowed.length > 0) {
    const list = disallowed.map((c) => `"${c}"`).join(", ");
    reasons.push(
      `it contains ${disallowed.length === 1 ? "the character" : "the characters"} ${list}, ` +
      `which ${disallowed.length === 1 ? "is" : "are"} not allowed — only letters, digits, underscores, and spaces are permitted`
    );
  }
  return reasons.join("; ");
}

// Only validates field names that would create NEW columns — existing columns
// were already accepted by the schema editor and must not be rejected here.
function validateFieldNames(keys: string[], existing: Set<string>): string | null {
  for (const key of keys) {
    if (existing.has(key)) continue;
    if (!SAFE_FIELD_NAME_RE.test(key)) {
      return (
        `The column "${key}" can't create a new field because ${describeInvalidFieldName(key)}. ` +
        `Fix it by renaming the column in your file to use only letters, digits, underscores, and spaces ` +
        `(for example, "Cover (img 1)" → "Cover img 1"). ` +
        `Alternatively, create a column with this exact name from "Manage Columns" first — ` +
        `existing columns are imported as-is.`
      );
    }
  }
  return null;
}

export async function handleImport(
  rows: unknown,
  category: { id: string; fields: unknown },
  mode: ImportMode = "merge",
): Promise<NextResponse> {
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided." }, { status: 400 });
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json(
      { error: `Cannot import more than ${MAX_IMPORT_ROWS} rows at once.` },
      { status: 400 },
    );
  }

  let fields = (Array.isArray(category.fields) ? category.fields : []) as IoField[];
  const errors: Array<{ row: number; error: string }> = [];
  let created = 0;
  let updated = 0;
  const validRows = rows.filter(
    (r): r is Record<string, unknown> => typeof r === "object" && r !== null && !Array.isArray(r)
  );

  if (mode === "replace") {
    // Wipe all existing entries for this category
    await prisma.contentCategoryEntry.deleteMany({ where: { categoryId: category.id } });

    // Rebuild field schema from imported data (preserve type where column name matches)
    const firstRow = rows[0] as Record<string, unknown>;
    const fieldNameErr = validateFieldNames(Object.keys(firstRow), new Set(fields.map((f) => f.name)));
    if (fieldNameErr) return NextResponse.json({ error: fieldNameErr }, { status: 400 });
    fields = Object.keys(firstRow).map((key) => {
      const existing = fields.find((f) => f.name === key);
      return existing ?? { name: key, ...inferColumnType(validRows, key) };
    });
    await prisma.contentCategory.update({
      where: { id: category.id },
      data: { fields: fields as never },
    });

    // Insert all rows fresh starting at sortIndex 0
    let nextSort = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        errors.push({ row: i + 1, error: "Row must be an object." });
        continue;
      }
      const raw = row as Record<string, unknown>;
      const values: Record<string, unknown> = {};
      for (const key of Object.keys(raw)) {
        const field = fields.find((f) => f.name === key);
        values[key] = field ? normalizeValue(raw[key], field.type) : String(raw[key] ?? "");
      }
      const valErr = validateEntryValues(values, fields);
      if (valErr) { errors.push({ row: i + 1, error: valErr }); continue; }
      await prisma.contentCategoryEntry.create({
        data: { id: generateId(), categoryId: category.id, values: values as never, sortIndex: nextSort++ },
      });
      created++;
    }
  } else {
    // Merge: ensure field schema includes every imported column
    const firstRow = rows[0] as Record<string, unknown>;
    const fieldNameErr = validateFieldNames(Object.keys(firstRow), new Set(fields.map((f) => f.name)));
    if (fieldNameErr) return NextResponse.json({ error: fieldNameErr }, { status: 400 });
    if (fields.length === 0) {
      fields = Object.keys(firstRow).map((key) => ({ name: key, ...inferColumnType(validRows, key) }));
      await prisma.contentCategory.update({
        where: { id: category.id },
        data: { fields: fields as never },
      });
    } else {
      const existingNames = new Set(fields.map((f) => f.name));
      const newFields = Object.keys(firstRow)
        .filter((key) => !existingNames.has(key))
        .map((key) => ({ name: key, ...inferColumnType(validRows, key) }));
      if (newFields.length > 0) {
        fields = [...fields, ...newFields];
        await prisma.contentCategory.update({
          where: { id: category.id },
          data: { fields: fields as never },
        });
      }
    }

    // Match imported rows to existing entries by position (sortIndex order)
    const existingEntries = await prisma.contentCategoryEntry.findMany({
      where: { categoryId: category.id, archivedAt: null },
      orderBy: { sortIndex: "asc" },
    });
    const last = await prisma.contentCategoryEntry.findFirst({
      where: { categoryId: category.id },
      orderBy: { sortIndex: "desc" },
      select: { sortIndex: true },
    });
    let nextSort = (last?.sortIndex ?? -1) + 1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        errors.push({ row: i + 1, error: "Row must be an object." });
        continue;
      }
      const raw = row as Record<string, unknown>;
      const values: Record<string, unknown> = {};
      for (const key of Object.keys(raw)) {
        const field = fields.find((f) => f.name === key);
        values[key] = field ? normalizeValue(raw[key], field.type) : String(raw[key] ?? "");
      }
      const valErr = validateEntryValues(values, fields);
      if (valErr) { errors.push({ row: i + 1, error: valErr }); continue; }

      if (i < existingEntries.length) {
        // Update existing entry: imported values override, existing values fill missing columns
        const existing = existingEntries[i];
        const existingValues = existing.values as Record<string, unknown>;
        const mergedValues = { ...existingValues, ...values };
        if (JSON.stringify(existingValues) !== JSON.stringify(mergedValues)) {
          await prisma.contentCategoryEntry.update({
            where: { id: existing.id },
            data: { values: mergedValues as never },
          });
          updated++;
        }
      } else {
        await prisma.contentCategoryEntry.create({
          data: { id: generateId(), categoryId: category.id, values: values as never, sortIndex: nextSort++ },
        });
        created++;
      }
    }
  }

  return NextResponse.json({ created, updated, errors });
}
