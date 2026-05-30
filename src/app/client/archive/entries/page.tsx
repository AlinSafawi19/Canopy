import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { SearchInput } from "@/components/ui/search-input";
import { Pagination } from "@/components/ui/pagination";
import { ArchiveEntryActions } from "@/app/admin/projects/[id]/categories/[catId]/archive-entry-actions";
import Link from "next/link";
import { parsePage, parseLimit, parseSearch } from "@/lib/pagination";
import { formatDate, stripRichText } from "@/lib/utils";

const PATH = "/client/archive/entries";

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

export default async function ClientArchiveEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; limit?: string }>;
}) {
  const session = await getSession();
  const clientId = session!.id;

  const { search: rs, page: rp, limit: rl } = await searchParams;
  const search = parseSearch(rs);
  const page = parsePage(rp);
  const limit = parseLimit(rl);
  const skip = (page - 1) * limit;

  const extraParams: Record<string, string> = {
    limit: String(limit),
    ...(search ? { search } : {}),
  };

  const clientFilter = {
    project: {
      clientAssignment: { clientId, archivedAt: null },
    },
  };

  let matchIds: string[] | null = null;
  if (search) {
    const res = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT e.id FROM "ContentCategoryEntry" e
      INNER JOIN "ContentCategory" c ON c.id = e."categoryId"
      INNER JOIN "ClientAssignment" ca ON ca."projectId" = c."projectId"
      WHERE e."archivedAt" IS NOT NULL
      AND ca."clientId" = ${clientId} AND ca."archivedAt" IS NULL
      AND e.values::text ILIKE ${'%' + search + '%'}
    `;
    matchIds = res.map((r) => r.id);
  }

  const where = {
    archivedAt: { not: null as null },
    category: clientFilter,
    ...(matchIds !== null ? { id: { in: matchIds } } : {}),
  };

  const [total, entries] = await Promise.all([
    prisma.contentCategoryEntry.count({ where }),
    prisma.contentCategoryEntry.findMany({
      where,
      orderBy: { archivedAt: "desc" },
      skip,
      take: limit,
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
    }),
  ]);

  return (
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
              <TableHead className="sticky right-0 bg-slate-50">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-slate-400 text-center">
                  {search ? `No archived entries found for "${search}"` : "Nothing archived yet"}
                </TableCell>
              </TableRow>
            )}
            {entries.map((entry, idx) => {
              const fields = Array.isArray(entry.category.fields)
                ? (entry.category.fields as unknown as Array<{ name: string; type: string }>)
                : [];
              const summary = entrySummary(fields, entry.values as Record<string, unknown>);
              return (
                <TableRow key={entry.id}>
                  <TableCell className="px-3 text-center text-xs text-slate-400">
                    {skip + idx + 1}
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    <Link
                      href={`/client/projects/${entry.category.project.id}`}
                      className="block truncate text-slate-700 hover:text-indigo-600 transition-colors"
                    >
                      {entry.category.project.name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    <Link
                      href={`/client/projects/${entry.category.project.id}/categories/${entry.category.id}`}
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
                  <TableCell className="sticky right-0 bg-white">
                    <ArchiveEntryActions
                      entry={entry}
                      categoryId={entry.category.id}
                      projectId={entry.category.project.id}
                      basePath="/api/client/projects"
                    />
                  </TableCell>
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
  );
}
