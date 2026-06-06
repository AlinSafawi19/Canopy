import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CreateEntryButton } from "@/app/admin/projects/[id]/categories/[catId]/create-entry-button";
import { EntriesTable } from "@/app/admin/projects/[id]/categories/[catId]/entries-table";
import { ExportEntriesButton } from "@/components/ui/export-entries-button";
import { ImportEntriesButton } from "@/components/ui/import-entries-button";
import { parsePermissions } from "@/lib/contributor-permissions";
import { ArrowLeft } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { parsePage, parseLimit, parseSearch, parseSortDir } from "@/lib/pagination";
import { getEntryLabel } from "@/lib/utils";

const BASE = "/api/contributor/projects";

export default async function ContributorCategoryPage({
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

  const assignment = await prisma.contributorAssignment.findFirst({
    where: { contributorId: session!.id, projectId: id },
  });
  if (!assignment) notFound();

  const permissions = parsePermissions(assignment.permissions as unknown);

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

  const fields: Array<{ name: string; type: string; options?: string[]; relationCategoryId?: string }> = Array.isArray(category.fields)
    ? (category.fields as unknown as Array<{ name: string; type: string; options?: string[]; relationCategoryId?: string }>)
    : [];

  const relationFields = fields.filter((f) => f.type === "relation" && f.relationCategoryId);
  let relatedEntries: Record<string, string> = {};
  if (relationFields.length > 0) {
    const referencedIds = new Set<string>();
    for (const entry of entries) {
      const vals = entry.values as Record<string, unknown>;
      for (const f of relationFields) {
        const v = vals[f.name];
        if (typeof v === "string" && v) referencedIds.add(v);
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

  const basePath = `/contributor/projects/${id}/categories/${catId}`;

  const extraParams: Record<string, string> = { limit: String(limit), sortDir };
  if (search) extraParams.search = search;
  const sortExtras: Record<string, string> = { limit: String(limit), ...(search ? { search } : {}) };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 flex-wrap">
        <Link href={`/contributor/projects/${id}`}>
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
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          {permissions.canViewContent && (
            <ExportEntriesButton projectId={id} categoryId={catId} categoryName={category.name} basePath={BASE} />
          )}
          {permissions.canCreateEntries && (
            <>
              <ImportEntriesButton projectId={id} categoryId={catId} fields={fields} totalEntries={total} basePath={BASE} />
              <CreateEntryButton categoryId={catId} projectId={id} fields={fields} basePath={BASE} />
            </>
          )}
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
              <p className="text-xs">The project owner hasn&apos;t set up columns for this category yet.</p>
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
                canEdit={permissions.canEditEntries}
                canArchive={permissions.canEditEntries}
                canDelete={permissions.canDeleteEntries}
                previewUrl={category.previewUrl ?? null}
                relatedEntries={relatedEntries}
                categoryName={category.name}
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
