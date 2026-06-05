import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CreateEntryButton } from "./create-entry-button";
import { EntriesTable } from "./entries-table";
import { ManageSchemaButton } from "./manage-schema-button";
import { ExportEntriesButton } from "@/components/ui/export-entries-button";
import { ImportEntriesButton } from "@/components/ui/import-entries-button";
import { ArrowLeft } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { parsePage, parseLimit, parseSearch, parseSortDir } from "@/lib/pagination";


export default async function CategoryDetailPage({
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

  const category = await prisma.contentCategory.findFirst({
    where: {
      id: catId,
      projectId: id,
      project: { adminTenantId: session!.tenantId! },
    },
    include: {
      project: { select: { id: true, name: true, previewUrl: true } },
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

  const fields: Array<{ name: string; type: string }> = Array.isArray(category.fields)
    ? (category.fields as unknown as Array<{ name: string; type: string }>)
    : [];
  const basePath = `/admin/projects/${id}/categories/${catId}`;

  const extraParams: Record<string, string> = { limit: String(limit), sortDir };
  if (search) extraParams.search = search;
  const sortExtras: Record<string, string> = { limit: String(limit), ...(search ? { search } : {}) };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <Link href={`/admin/projects/${id}`}>
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
          <ExportEntriesButton projectId={id} categoryId={catId} categoryName={category.name} />
          <ImportEntriesButton projectId={id} categoryId={catId} fields={fields} totalEntries={total} />
          <ManageSchemaButton projectId={id} categoryId={catId} fields={fields} />
          <CreateEntryButton categoryId={catId} projectId={id} fields={fields} />
        </div>
      </div>

      {/* Database table */}
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
                previewUrl={category.project.previewUrl ?? null}
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
