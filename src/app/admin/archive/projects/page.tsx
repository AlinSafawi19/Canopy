import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { SearchInput } from "@/components/ui/search-input";
import { Pagination } from "@/components/ui/pagination";
import { ArchiveProjectActions } from "@/app/admin/projects/[id]/categories/[catId]/archive-entry-actions";
import Link from "next/link";
import { parsePage, parseLimit, parseSearch } from "@/lib/pagination";
import { formatDate } from "@/lib/utils";

const PATH = "/admin/archive/projects";

export default async function AdminArchiveProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; limit?: string }>;
}) {
  const session = await getSession();
  const tenantId = session!.tenantId!;

  const { search: rs, page: rp, limit: rl } = await searchParams;
  const search = parseSearch(rs);
  const page = parsePage(rp);
  const limit = parseLimit(rl);
  const skip = (page - 1) * limit;

  const extraParams: Record<string, string> = {
    limit: String(limit),
    ...(search ? { search } : {}),
  };

  let matchIds: string[] | null = null;
  if (search) {
    const res = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Project"
      WHERE "archivedAt" IS NOT NULL AND "adminTenantId" = ${tenantId}
      AND name ILIKE ${'%' + search + '%'}
    `;
    matchIds = res.map((r) => r.id);
  }

  const where = {
    archivedAt: { not: null as null },
    adminTenantId: tenantId,
    ...(matchIds !== null ? { id: { in: matchIds } } : {}),
  };

  const [total, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: { archivedAt: "desc" },
      skip,
      take: limit,
      select: { id: true, name: true, archivedAt: true },
    }),
  ]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-slate-100 pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle>
            {total} archived {total === 1 ? "project" : "projects"}
          </CardTitle>
          <SearchInput
            value={search}
            placeholder="Search projects…"
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
              <TableHead>Name</TableHead>
              <TableHead>Archived On</TableHead>
              <TableHead className="sticky right-0 bg-slate-50">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-slate-400 text-center">
                  {search ? `No archived projects found for "${search}"` : "Nothing archived yet"}
                </TableCell>
              </TableRow>
            )}
            {projects.map((project, idx) => (
              <TableRow key={project.id}>
                <TableCell className="px-3 text-center text-xs text-slate-400">
                  {skip + idx + 1}
                </TableCell>
                <TableCell className="max-w-[320px]">
                  <Link
                    href={`/admin/projects/${project.id}`}
                    className="block truncate text-slate-700 hover:text-indigo-600 transition-colors font-medium"
                  >
                    {project.name}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className="text-xs text-slate-500">
                    {formatDate(project.archivedAt)}
                  </span>
                </TableCell>
                <TableCell className="sticky right-0 bg-white">
                  <ArchiveProjectActions project={project} />
                </TableCell>
              </TableRow>
            ))}
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
