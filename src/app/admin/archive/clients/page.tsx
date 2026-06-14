import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { SearchInput } from "@/components/ui/search-input";
import { Pagination } from "@/components/ui/pagination";
import { ClientActions } from "@/app/admin/clients/client-actions";
import { formatDate } from "@/lib/utils";
import { parsePage, parseLimit, parseSearch } from "@/lib/pagination";

const PATH = "/admin/archive/clients";

export default async function AdminArchiveClientsPage({
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

  const where = {
    tenantId,
    archivedAt: { not: null as null },
    ...(search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { username: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [total, clients, assignments] = await Promise.all([
    prisma.clientIdentity.count({ where }),
    prisma.clientIdentity.findMany({
      where,
      orderBy: { archivedAt: "desc" },
      skip,
      take: limit,
      select: { id: true, username: true, name: true, email: true, archivedAt: true },
    }),
    prisma.clientAssignment.findMany({
      where: { tenantId },
      select: { projectId: true, clientId: true },
    }),
  ]);

  const assignmentsByClient = assignments.reduce<Record<string, string[]>>((acc, a) => {
    if (!acc[a.clientId]) acc[a.clientId] = [];
    acc[a.clientId].push(a.projectId);
    return acc;
  }, {});

  const projectIds = [...new Set(assignments.map((a) => a.projectId))];
  const projects = projectIds.length > 0
    ? await prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, name: true },
      })
    : [];
  const projectsById = Object.fromEntries(projects.map((p) => [p.id, p]));

  const extraParams: Record<string, string> = {
    limit: String(limit),
    ...(search ? { search } : {}),
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-slate-100 pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle>
            {total} archived {total === 1 ? "client" : "clients"}
          </CardTitle>
          <SearchInput
            value={search}
            placeholder="Search clients…"
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
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-slate-400 text-center">
                  {search ? `No archived clients found for "${search}"` : "Nothing archived yet"}
                </TableCell>
              </TableRow>
            )}
            {clients.map((client) => {
              const assignedProjects = (assignmentsByClient[client.id] ?? [])
                .map((pid) => projectsById[pid])
                .filter(Boolean) as Array<{ id: string; name: string }>;
              return (
                <TableRow key={client.id}>
                  <TableCell className="font-medium text-slate-900">{client.name}</TableCell>
                  <TableCell className="text-slate-500">@{client.username}</TableCell>
                  <TableCell className="text-slate-500">{client.email || "—"}</TableCell>
                  <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(client.archivedAt)}
                  </TableCell>
                  <TableCell className="sticky right-0 bg-white">
                    <ClientActions client={client} assignedProjects={assignedProjects} />
                  </TableCell>
                </TableRow>
              );
            })}
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
