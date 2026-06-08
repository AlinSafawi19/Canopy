import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CreateEntryButton } from "@/app/admin/projects/[id]/categories/[catId]/create-entry-button";
import { EntriesTable } from "@/app/admin/projects/[id]/categories/[catId]/entries-table";
import { ManageSchemaButton } from "@/app/admin/projects/[id]/categories/[catId]/manage-schema-button";
import { ExportEntriesButton } from "@/components/ui/export-entries-button";
import { ImportEntriesButton } from "@/components/ui/import-entries-button";
import { ArrowLeft } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { parsePage, parseLimit, parseSearch, parseSortDir } from "@/lib/pagination";
import { getEntryLabel } from "@/lib/utils";

const BASE = "/api/client/projects";


export default async function ClientCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; catId: string }>;
  searchParams: Promise<{ page?: string; limit?: string; search?: string; sortDir?: string }>;
}) {
  const { id, catId } = await params;
  const session = await getSession();
  const { page: rawPage, limit: rawLimit, search: rs, sortDir: rsd } = await searchParams;
  const page = parsePage(rawPage);
  const limit = parseLimit(rawLimit);
  const search = parseSearch(rs);
  const sortDir = parseSortDir(rsd);
  const skip = (page - 1) * limit;

  const assignment = await prisma.clientAssignment.findFirst({
    where: { projectId: id, clientId: session!.id, archivedAt: null },
  });
  if (!assignment) notFound();

  const category = await prisma.contentCategory.findFirst({
    where: { id: catId, projectId: id },
    include: {
      project: { select: { id: true, name: true } },
    },
  });

  if (!category) notFound();

  let matchingIds: string[] | null = null;
  if (search) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "ContentCategoryEntry"
      WHERE "categoryId" = ${catId}
      AND "archivedAt" IS NULL
      AND values::text ILIKE ${'%' + search + '%'}
    `;
    matchingIds = rows.map((r) => r.id);
  }

  const activeWhere = {
    categoryId: catId,
    archivedAt: null,
    ...(matchingIds !== null ? { id: { in: matchingIds } } : {}),
  };

  const [total, entries] = await Promise.all([
    prisma.contentCategoryEntry.count({ where: activeWhere }),
    prisma.contentCategoryEntry.findMany({
      where: activeWhere,
      orderBy: { sortIndex: sortDir },
      skip,
      take: limit,
    }),
  ]);

  const entryIds = entries.map((e) => e.id);
  const requestCounts = entryIds.length > 0
    ? await prisma.changeRequest.groupBy({
        by: ["entryId"],
        where: { entryId: { in: entryIds }, resolvedAt: null },
        _count: { entryId: true },
      })
    : [];
  const openRequestsByEntry = Object.fromEntries(requestCounts.map((r) => [r.entryId, r._count.entryId]));

  const fields: Array<{ name: string; type: string; options?: string[]; relationCategoryId?: string; multiple?: boolean; countCategoryId?: string; countFieldName?: string }> = Array.isArray(category.fields)
    ? (category.fields as unknown as Array<{ name: string; type: string; options?: string[]; relationCategoryId?: string; multiple?: boolean; countCategoryId?: string; countFieldName?: string }>)
    : [];

  const projectCategories = await prisma.contentCategory.findMany({
    where: { projectId: id, archivedAt: null },
    select: { id: true, name: true, fields: true },
    orderBy: { name: "asc" },
  });

  const relationFields = fields.filter((f) => f.type === "relation" && f.relationCategoryId);
  let relatedEntries: Record<string, string> = {};
  if (relationFields.length > 0) {
    const referencedIds = new Set<string>();
    for (const entry of entries) {
      const vals = entry.values as Record<string, unknown>;
      for (const f of relationFields) {
        const v = vals[f.name];
        if (Array.isArray(v)) {
          for (const item of v) if (typeof item === "string" && item) referencedIds.add(item);
        } else if (typeof v === "string" && v) {
          referencedIds.add(v);
        }
      }
    }
    if (referencedIds.size > 0) {
      const referencedRows = await prisma.contentCategoryEntry.findMany({
        where: { id: { in: Array.from(referencedIds) } },
        select: { id: true, values: true },
      });
      relatedEntries = Object.fromEntries(
        referencedRows.map((r) => [r.id, getEntryLabel(r.values as Record<string, unknown>)])
      );
    }
  }

  const countFields = fields.filter((f) => f.type === "count" && f.countCategoryId);
  const entryCounts: Record<string, Record<string, number>> = {};
  if (countFields.length > 0 && entryIds.length > 0) {
    const valueToEntryId = new Map<string, string>();
    for (const entry of entries) {
      valueToEntryId.set(entry.id, entry.id);
      for (const val of Object.values(entry.values as Record<string, unknown>)) {
        if (typeof val === "string" && val) valueToEntryId.set(val, entry.id);
      }
    }
    for (const cf of countFields) {
      let fieldName = cf.countFieldName ?? "";
      if (!fieldName) {
        const sourceCat = await prisma.contentCategory.findFirst({
          where: { id: cf.countCategoryId! },
          select: { fields: true },
        });
        const srcFields = (Array.isArray(sourceCat?.fields) ? sourceCat!.fields : []) as Array<{ name: string; type: string; relationCategoryId?: string }>;
        const match = srcFields.find((f) => f.type === "relation" && f.relationCategoryId === catId);
        if (!match) continue;
        fieldName = match.name;
      }
      const sourceEntries = await prisma.contentCategoryEntry.findMany({
        where: { categoryId: cf.countCategoryId!, archivedAt: null },
        select: { values: true },
        take: 10_000,
      });
      const counts: Record<string, number> = {};
      for (const se of sourceEntries) {
        const v = (se.values as Record<string, unknown>)[fieldName];
        const refs = Array.isArray(v)
          ? v.filter((x): x is string => typeof x === "string" && !!x)
          : typeof v === "string" && v ? [v] : [];
        for (const ref of refs) {
          const resolvedId = valueToEntryId.get(ref);
          if (resolvedId) counts[resolvedId] = (counts[resolvedId] ?? 0) + 1;
        }
      }
      entryCounts[cf.name] = counts;
    }
  }

  const basePath = `/client/projects/${id}/categories/${catId}`;

  const extraParams: Record<string, string> = { limit: String(limit), sortDir };
  if (search) extraParams.search = search;
  const sortExtras: Record<string, string> = { limit: String(limit), ...(search ? { search } : {}) };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 flex-wrap">
        <Link href={`/client/projects/${id}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft size={14} />
            {category.project.name}
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-slate-900">{category.name}</h2>
          {category.description && (
            <p className="text-slate-500 text-sm">{category.description}</p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 w-full sm:w-auto">
          <ExportEntriesButton projectId={id} categoryId={catId} categoryName={category.name} basePath={BASE} className="w-full sm:w-auto" />
          <ImportEntriesButton projectId={id} categoryId={catId} fields={fields} totalEntries={total} basePath={BASE} categories={projectCategories} />
          <ManageSchemaButton projectId={id} categoryId={catId} fields={fields} categories={projectCategories.map((c) => ({ id: c.id, name: c.name, fields: (Array.isArray(c.fields) ? c.fields : []) as Array<{ name: string; type: string; relationCategoryId?: string }> }))} basePath={BASE} />
          <CreateEntryButton categoryId={catId} projectId={id} fields={fields} basePath={BASE} />
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>
              {total} {total === 1 ? "entry" : "entries"}
            </CardTitle>
            <SearchInput
              value={search}
              placeholder="Search entries…"
              basePath={basePath}
              extraParams={{ sortDir, limit: String(limit) }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
              <p className="text-sm font-medium text-slate-600">No columns defined</p>
              <p className="text-xs">Click <span className="font-medium text-slate-700">Manage Columns</span> to define your schema first, then add rows.</p>
            </div>
          ) : (
            <>
              <EntriesTable
                entries={entries}
                fields={fields}
                projectId={id}
                categoryId={catId}
                skip={skip}
                search={search}
                pagePath={basePath}
                sortDir={sortDir}
                sortExtras={sortExtras}
                apiBase={BASE}
                previewUrl={category.previewUrl ?? null}
                relatedEntries={relatedEntries}
                entryCounts={entryCounts}
                categoryName={category.name}
                openRequestsByEntry={openRequestsByEntry}
                canRequestChange
              />
              <div className="px-4 border-t border-slate-100">
                <Pagination total={total} page={page} limit={limit} basePath={basePath} extraParams={extraParams} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
