import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateId } from "@/lib/utils";
import { validateEntryValues } from "@/lib/limits";

export type IoField = { name: string; type: string };

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

  const fields = (Array.isArray(category.fields) ? category.fields : []) as IoField[];

  const last = await prisma.contentCategoryEntry.findFirst({
    where: { categoryId: category.id },
    orderBy: { sortIndex: "desc" },
    select: { sortIndex: true },
  });
  let nextSort = (last?.sortIndex ?? -1) + 1;

  let created = 0;
  const errors: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      errors.push({ row: i + 1, error: "Row must be an object." });
      continue;
    }
    const values = row as Record<string, unknown>;
    const valErr = validateEntryValues(values, fields);
    if (valErr) {
      errors.push({ row: i + 1, error: valErr });
      continue;
    }
    await prisma.contentCategoryEntry.create({
      data: { id: generateId(), categoryId: category.id, values: values as never, sortIndex: nextSort++ },
    });
    created++;
  }

  return NextResponse.json({ created, errors });
}
