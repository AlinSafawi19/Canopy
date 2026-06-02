import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateId } from "@/lib/utils";
import { validateEntryValues } from "@/lib/limits";

export type IoField = { name: string; type: string };
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
  const fields = (Array.isArray(category.fields) ? category.fields : []) as IoField[];
  const filename = (category.slug ?? category.name).replace(/[^a-z0-9_-]/gi, "_");

  const entries = await prisma.contentCategoryEntry.findMany({
    where: { categoryId: category.id, archivedAt: null },
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

  if (mode === "replace") {
    // Wipe all existing entries for this category
    await prisma.contentCategoryEntry.deleteMany({ where: { categoryId: category.id } });

    // Rebuild field schema from imported data (preserve type where column name matches)
    const firstRow = rows[0] as Record<string, unknown>;
    fields = Object.keys(firstRow).map((key) => {
      const existing = fields.find((f) => f.name === key);
      return existing ?? { name: key, type: "text" };
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
      const values = row as Record<string, unknown>;
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
    if (fields.length === 0) {
      fields = Object.keys(firstRow).map((key) => ({ name: key, type: "text" }));
      await prisma.contentCategory.update({
        where: { id: category.id },
        data: { fields: fields as never },
      });
    } else {
      const existingNames = new Set(fields.map((f) => f.name));
      const newFields = Object.keys(firstRow)
        .filter((key) => !existingNames.has(key))
        .map((key) => ({ name: key, type: "text" as const }));
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
      const values = row as Record<string, unknown>;
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
