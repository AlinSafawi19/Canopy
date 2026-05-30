import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import Link from "next/link";
import { ArchiveEntryActions } from "@/app/admin/projects/[id]/categories/[catId]/archive-entry-actions";
import { stripRichText } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { parsePage, parseLimit, parseSearch } from "@/lib/pagination";
import { parsePermissions } from "@/lib/contributor-permissions";
import { formatDate } from "@/lib/utils";

const PATH = "/contributor/archive";

function entrySummary(
  fields: Array<{ name: string; type: string }>,
  values: Record<string, unknown>
): string {
  return fields
    .map((f) => {
      const v = values[f.name];
      if (!v && v !== 0) return null;
      const s = String(v);
      return f.type === "rich_text" ? stripRichText(s) : s;
    })
    .filter((s): s is string => !!s)
    .slice(0, 2)
    .join(" · ");
}

export default async function ContributorArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; search?: string }>;
}) {
  const session = await getSession();
  const { page: rawPage, limit: rawLimit, search: rs } = await searchParams;

  const page = parsePage(rawPage);
  const limit = parseLimit(rawLimit);
  const search = parseSearch(rs);
  const skip = (page - 1) * limit;

  const assignments = await prisma.contributorAssignment.findMany({
    where: { contributorId: session!.id },
    select: { projectId: true, permissions: true },
  });
  const permsByProject = new Map(
    assignments.map((a) => [
      a.projectId,
      parsePermissions((a as unknown as { permissions: unknown }).permissions),
    ])
  );
  const projectIds = assignments.map((a) => a.projectId);

  let matchingIds: string[] | null = null;
  if (search && projectIds.length > 0) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT e.id FROM "ContentCategoryEntry" e
      INNER JOIN "ContentCategory" c ON c.id = e."categoryId"
      INNER JOIN "ContributorAssignment" ca ON ca."projectId" = c."projectId"
      WHERE e."archivedAt" IS NOT NULL
      AND ca."contributorId" = ${session!.id}
      AND e.values::text ILIKE ${'%' + search + '%'}
    `;
    matchingIds = rows.map((r) => r.id);
  } else if (search) {
    matchingIds = [];
  }

  const where =
    projectIds.length === 0
      ? { id: "none" }
      : {
          archivedAt: { not: null as null },
          category: { project: { id: { in: projectIds } } },
          ...(matchingIds !== null ? { id: { in: matchingIds } } : {}),
        };

  const [total, entries] = await Promise.all([
    prisma.contentCategoryEntry.count({ where }),
    prisma.contentCategoryEntry.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            fields: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { archivedAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  const anyActions = [...permsByProject.values()].some(
    (p) => p.canEditEntries || p.canDeleteEntries
  );

  const extraParams: Record<string, string> = { limit: String(limit) };
  if (search) extraParams.search = search;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Archive</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          All archived entries across your projects
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>
              {total} archived {total === 1 ? "entry" : "entries"}
            </CardTitle>
            <SearchInput
              value={search}
              placeholder="Search entries…"
              basePath={PATH}
              extraParams={{ limit: String(limit) }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 px-3 text-center">#</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="min-w-[200px]">Entry</TableHead>
                <TableHead>Archived On</TableHead>
                {anyActions && (
                  <TableHead className="sticky right-0 bg-slate-50">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={anyActions ? 6 : 5}
                    className="text-slate-400 text-center"
                  >
                    {search ? `No archived entries found for "${search}"` : "Nothing archived yet"}
                  </TableCell>
                </TableRow>
              )}
              {entries.map((entry, idx) => {
                const fields = Array.isArray(entry.category.fields)
                  ? (entry.category.fields as unknown as Array<{ name: string; type: string }>)
                  : [];
                const values = entry.values as Record<string, unknown>;
                const summary = entrySummary(fields, values);
                const perms = permsByProject.get(entry.category.project.id);
                const canRestore = perms?.canEditEntries ?? false;
                const canDelete = perms?.canDeleteEntries ?? false;
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="px-3 text-center text-xs text-slate-400">
                      {skip + idx + 1}
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <Link
                        href={`/contributor/projects/${entry.category.project.id}`}
                        className="block truncate text-slate-700 hover:text-indigo-600 transition-colors"
                      >
                        {entry.category.project.name}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <Link
                        href={`/contributor/projects/${entry.category.project.id}/categories/${entry.category.id}`}
                        className="block truncate text-slate-700 hover:text-indigo-600 transition-colors"
                      >
                        {entry.category.name}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      {summary ? (
                        <span className="block truncate text-slate-700">{summary}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="text-xs text-slate-500">
                        {formatDate(entry.archivedAt)}
                      </span>
                    </TableCell>
                    {anyActions && (
                      <TableCell className="sticky right-0 bg-white">
                        <ArchiveEntryActions
                          entry={entry}
                          categoryId={entry.category.id}
                          projectId={entry.category.project.id}
                          basePath="/api/contributor/projects"
                          canRestore={canRestore}
                          canDelete={canDelete}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {total > 0 && (
            <div className="px-4 border-t border-slate-100">
              <Pagination
                total={total}
                page={page}
                limit={limit}
                basePath={PATH}
                extraParams={extraParams}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
