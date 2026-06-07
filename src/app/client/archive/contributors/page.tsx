import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { SearchInput } from "@/components/ui/search-input";
import { Pagination } from "@/components/ui/pagination";
import { ContributorActions } from "@/app/client/contributors/contributor-actions";
import { formatDate } from "@/lib/utils";
import { parsePage, parseLimit, parseSearch } from "@/lib/pagination";

const PATH = "/client/archive/contributors";

export default async function ClientArchiveContributorsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; limit?: string }>;
}) {
  const session = await getSession();

  const { search: rs, page: rp, limit: rl } = await searchParams;
  const search = parseSearch(rs);
  const page = parsePage(rp);
  const limit = parseLimit(rl);
  const skip = (page - 1) * limit;

  const where = {
    parentClientUsername: session!.username,
    archivedAt: { not: null as null },
    ...(search ? {
      OR: [
        { displayName: { contains: search, mode: "insensitive" as const } },
        { username: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [total, contributors] = await Promise.all([
    prisma.contributor.count({ where }),
    prisma.contributor.findMany({
      where,
      orderBy: { archivedAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true, username: true, displayName: true, email: true, archivedAt: true,
        assignments: { select: { projectId: true } },
      },
    }),
  ]);

  const allProjectIds = [...new Set(contributors.flatMap((c) => c.assignments.map((a) => a.projectId)))];
  const projects = allProjectIds.length > 0
    ? await prisma.project.findMany({ where: { id: { in: allProjectIds } }, select: { id: true, name: true } })
    : [];
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  const extraParams: Record<string, string> = {
    limit: String(limit),
    ...(search ? { search } : {}),
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-slate-100 pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle>
            {total} archived {total === 1 ? "contributor" : "contributors"}
          </CardTitle>
          <SearchInput
            value={search}
            placeholder="Search contributors…"
            basePath={PATH}
            extraParams={{ limit: String(limit) }}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Archived On</TableHead>
              <TableHead className="sticky right-0 bg-slate-50">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contributors.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-slate-400 text-center">
                  {search ? `No archived contributors found for "${search}"` : "Nothing archived yet"}
                </TableCell>
              </TableRow>
            )}
            {contributors.map((contributor) => (
              <TableRow key={contributor.id}>
                <TableCell className="font-medium text-slate-900">{contributor.displayName}</TableCell>
                <TableCell className="text-slate-500">@{contributor.username}</TableCell>
                <TableCell className="text-slate-500">{contributor.email || "—"}</TableCell>
                <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                  {formatDate(contributor.archivedAt)}
                </TableCell>
                <TableCell className="sticky right-0 bg-white">
                  <ContributorActions
                    contributor={contributor}
                    currentProjects={contributor.assignments
                      .map((a) => ({ id: a.projectId, name: projectMap[a.projectId] ?? "" }))
                      .filter((p) => p.name)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {total > 0 && (
          <div className="px-4 border-t border-slate-100">
            <Pagination total={total} page={page} limit={limit} basePath={PATH} extraParams={extraParams} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
