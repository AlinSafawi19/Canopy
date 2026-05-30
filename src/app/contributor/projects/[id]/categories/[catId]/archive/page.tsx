import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArchiveEntryActions } from "@/app/admin/projects/[id]/categories/[catId]/archive-entry-actions";
import { stripRichText } from "@/lib/utils";
import { ArrowLeft, Archive } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SortableHeader } from "@/components/ui/sortable-header";
import { parsePage, parseLimit, parseSearch, parseSortDir, parseSortBy } from "@/lib/pagination";
import { parsePermissions } from "@/lib/contributor-permissions";

const BASE = "/api/contributor/projects";

const TYPE_COLORS: Record<string, string> = {
  text:      "text-violet-500",
  textarea:  "text-blue-500",
  rich_text: "text-purple-600",
  number:    "text-amber-500",
  date:      "text-emerald-500",
  boolean:   "text-rose-500",
  url:       "text-cyan-500",
  email:     "text-indigo-500",
};

const SORT_FIELDS = ["archivedAt", "sortIndex"] as const;

export default async function ContributorArchivePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; catId: string }>;
  searchParams: Promise<{ page?: string; limit?: string; search?: string; sortDir?: string; sortBy?: string }>;
}) {
  const { id, catId } = await params;
  const session = await getSession();
  const { page: rawPage, limit: rawLimit, search: rs, sortDir: rsd, sortBy: rsb } = await searchParams;

  const page = parsePage(rawPage);
  const limit = parseLimit(rawLimit);
  const search = parseSearch(rs);
  const sortDir = parseSortDir(rsd);
  const sortBy = parseSortBy(rsb, SORT_FIELDS, "archivedAt");
  const skip = (page - 1) * limit;

  const assignment = await prisma.contributorAssignment.findFirst({
    where: { contributorId: session!.id, projectId: id },
  });
  if (!assignment) notFound();

  const permissions = parsePermissions((assignment as any).permissions);

  const category = await prisma.contentCategory.findFirst({
    where: { id: catId, projectId: id },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!category) notFound();

  let matchingIds: string[] | null = null;
  if (search) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "ContentCategoryEntry"
      WHERE "categoryId" = ${catId}
      AND "archivedAt" IS NOT NULL
      AND values::text ILIKE ${'%' + search + '%'}
    `;
    matchingIds = rows.map((r) => r.id);
  }

  const where = {
    categoryId: catId,
    archivedAt: { not: null as null },
    ...(matchingIds !== null ? { id: { in: matchingIds } } : {}),
  };

  const orderBy = sortBy === "archivedAt"
    ? { archivedAt: sortDir } as const
    : { sortIndex: sortDir } as const;

  const [total, entries] = await Promise.all([
    prisma.contentCategoryEntry.count({ where }),
    prisma.contentCategoryEntry.findMany({ where, orderBy, skip, take: limit }),
  ]);

  const fields: Array<{ name: string; type: string }> = Array.isArray(category.fields)
    ? (category.fields as unknown as Array<{ name: string; type: string }>)
    : [];

  const catPath = `/contributor/projects/${id}/categories/${catId}`;
  const archivePath = `${catPath}/archive`;
  const showActions = permissions.canEditEntries || permissions.canDeleteEntries;

  const extraParams: Record<string, string> = { limit: String(limit), sortDir, sortBy };
  if (search) extraParams.search = search;
  const sortExtras: Record<string, string> = { limit: String(limit), ...(search ? { search } : {}) };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={catPath}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft size={14} />
            {category.name}
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Archive size={18} className="text-slate-400" />
            Archive
          </h2>
          <p className="text-slate-500 text-sm">{category.project.name} / {category.name}</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>
              {total} archived {total === 1 ? "entry" : "entries"}
            </CardTitle>
            <SearchInput
              value={search}
              placeholder="Search archived entries…"
              basePath={archivePath}
              extraParams={{ sortDir, sortBy, limit: String(limit) }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {total === 0 && !search ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
              <Archive size={32} className="text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No archived entries</p>
              <p className="text-xs">Archived entries from {category.name} will appear here.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="w-10 px-3 py-2.5 text-left border-r border-slate-200 sticky left-0 bg-slate-50">
                        <SortableHeader label="#" field="sortIndex" sortBy={sortBy} sortDir={sortDir} basePath={archivePath} extraParams={sortExtras} />
                      </th>
                      {fields.map((f) => (
                        <th key={f.name} className="px-4 py-2.5 text-left font-medium text-slate-700 border-r border-slate-200 min-w-[160px] whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span>{f.name}</span>
                            <span className={`text-[10px] font-normal uppercase tracking-wide ${TYPE_COLORS[f.type] ?? "text-slate-400"}`}>{f.type}</span>
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-2.5 text-left font-medium text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <SortableHeader label="Archived On" field="archivedAt" sortBy={sortBy} sortDir={sortDir} basePath={archivePath} extraParams={sortExtras} />
                          <span className="text-[10px] font-normal uppercase tracking-wide text-slate-400">system</span>
                        </div>
                      </th>
                      {showActions && (
                        <th className="px-4 py-2.5 text-left font-medium text-slate-700 whitespace-nowrap sticky right-0 bg-slate-50">
                          <div className="flex flex-col gap-0.5">
                            <span>Actions</span>
                            <span className="text-[10px] font-normal uppercase tracking-wide text-slate-400">system</span>
                          </div>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-8 text-center text-slate-400 text-sm"
                          colSpan={fields.length + (showActions ? 3 : 2)}
                        >
                          No archived entries found for &ldquo;{search}&rdquo;
                        </td>
                      </tr>
                    ) : entries.map((entry, idx) => {
                      const values = entry.values as Record<string, unknown>;
                      return (
                        <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                          <td className="px-3 py-2.5 text-center text-xs text-slate-400 border-r border-slate-100 sticky left-0 bg-white">
                            {skip + idx + 1}
                          </td>
                          {fields.map((f) => {
                            const raw = values[f.name];
                            let display: string | null = null;
                            if (raw !== undefined && raw !== null && raw !== "") {
                              const str = String(raw);
                              display = f.type === "rich_text" ? stripRichText(str) : str;
                            }
                            return (
                              <td key={f.name} className="px-4 py-2.5 border-r border-slate-100 max-w-[240px]">
                                {display
                                  ? <span className="block truncate text-slate-700">{display}</span>
                                  : <span className="text-slate-300">—</span>}
                              </td>
                            );
                          })}
                          <td className={`px-4 py-2.5 whitespace-nowrap ${showActions ? "border-r border-slate-100" : ""}`}>
                            <span className="text-xs text-slate-500">
                              {entry.archivedAt?.toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }) ?? "—"}
                            </span>
                          </td>
                          {showActions && (
                            <td className="px-4 py-2.5 sticky right-0 bg-white">
                              <ArchiveEntryActions
                                entry={entry}
                                categoryId={catId}
                                projectId={id}
                                basePath={BASE}
                                canRestore={permissions.canEditEntries}
                                canDelete={permissions.canDeleteEntries}
                              />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 border-t border-slate-100">
                <Pagination
                  total={total}
                  page={page}
                  limit={limit}
                  basePath={archivePath}
                  extraParams={extraParams}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
