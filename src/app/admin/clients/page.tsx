import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { CreateClientButton } from "./create-client-button";
import { ClientActions } from "./client-actions";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SortableHeader } from "@/components/ui/sortable-header";
import { parsePage, parseLimit, parseSearch, parseSortDir } from "@/lib/pagination";
import { InviteStatusCell } from "@/components/ui/invite-status-cell";
import { inviteStatus } from "@/lib/invite-tokens";

const BASE = "/admin/clients";
const VALID_SORTS = ["displayName", "updatedAt"] as const;
type SortField = typeof VALID_SORTS[number];

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; search?: string; sortBy?: string; sortDir?: string }>;
}) {
  const session = await getSession();
  const tenantId = session!.tenantId!;
  const { page: rp, limit: rl, search: rs, sortBy: rsb, sortDir: rsd } = await searchParams;
  const page = parsePage(rp);
  const limit = parseLimit(rl);
  const search = parseSearch(rs);
  const sortBy: SortField = VALID_SORTS.includes(rsb as SortField) ? (rsb as SortField) : "displayName";
  const sortDir = parseSortDir(rsd === "desc" ? "desc" : rsd === "asc" ? "asc" : "asc");
  const skip = (page - 1) * limit;

  const orderBy = sortBy === "updatedAt" ? { updatedAt: sortDir } : { displayName: sortDir };

  const where = {
    tenantId,
    ...(search ? {
      OR: [
        { displayName: { contains: search, mode: "insensitive" as const } },
        { username: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [total, clients, assignments, rawInviteTokens] = await Promise.all([
    prisma.clientIdentity.count({ where }),
    prisma.clientIdentity.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: { id: true, username: true, displayName: true, email: true, slug: true, archivedAt: true, updatedAt: true },
    }),
    prisma.clientAssignment.findMany({
      where: { tenantId },
      select: { projectId: true, clientId: true },
    }),
    prisma.inviteToken.findMany({
      where: { targetKind: "client" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const assignedProjectIds = [...new Set(assignments.map((a) => a.projectId))];
  const assignedProjectsList = assignedProjectIds.length > 0
    ? await prisma.project.findMany({ where: { id: { in: assignedProjectIds } }, select: { id: true, name: true } })
    : [];
  const projectById = new Map(assignedProjectsList.map((p) => [p.id, p]));

  const clientProjectsMap = new Map<string, { id: string; name: string }[]>();
  for (const a of assignments) {
    const project = projectById.get(a.projectId);
    if (project) {
      const list = clientProjectsMap.get(a.clientId) ?? [];
      list.push(project);
      clientProjectsMap.set(a.clientId, list);
    }
  }

  const inviteMap = new Map(
    clients.map((c) => {
      const token = rawInviteTokens.find((t) => t.targetId === c.id) ?? null;
      return [c.id, token];
    })
  );

  const extraParams: Record<string, string> = { limit: String(limit), sortBy, sortDir };
  if (search) extraParams.search = search;
  const sortExtras: Record<string, string> = { limit: String(limit), ...(search ? { search } : {}) };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-y-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Clients</h2>
          <p className="text-slate-500 text-sm mt-0.5">Manage client accounts</p>
        </div>
        <CreateClientButton tenantId={tenantId} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>All Clients ({total})</CardTitle>
            <SearchInput
              value={search}
              placeholder="Search clients…"
              basePath={BASE}
              extraParams={{ sortBy, sortDir, limit: String(limit) }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortableHeader label="Name" field="displayName" sortBy={sortBy} sortDir={sortDir} basePath={BASE} extraParams={sortExtras} /></TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invite</TableHead>
                <TableHead><SortableHeader label="Updated" field="updatedAt" sortBy={sortBy} sortDir={sortDir} basePath={BASE} extraParams={sortExtras} /></TableHead>
                <TableHead className="sticky right-0 bg-slate-50">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 && (
                <TableRow>
                  <TableCell className="text-slate-400 text-center" colSpan={8}>
                    {search ? `No clients found for "${search}"` : "No clients yet"}
                  </TableCell>
                </TableRow>
              )}
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium text-slate-900">{client.displayName}</TableCell>
                  <TableCell className="text-slate-500">@{client.username}</TableCell>
                  <TableCell className="text-slate-500">{client.email}</TableCell>
                  <TableCell className="text-slate-700">
                    {(clientProjectsMap.get(client.id)?.length ?? 0) || <span className="text-slate-400">—</span>}
                  </TableCell>
                  <TableCell>
                    {client.archivedAt ? <Badge variant="danger">Archived</Badge> : <Badge variant="success">Active</Badge>}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const t = inviteMap.get(client.id) ?? null;
                      const st = t ? inviteStatus(t) : "none";
                      return <InviteStatusCell targetKind="client" targetId={client.id} displayName={client.displayName} status={st} token={t?.token} />;
                    })()}
                  </TableCell>
                  <TableCell className="text-slate-500">{formatDate(client.updatedAt)}</TableCell>
                  <TableCell className="sticky right-0 bg-white">
                    <ClientActions
                      client={client}
                      assignedProjects={clientProjectsMap.get(client.id) ?? []}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4">
            <Pagination total={total} page={page} limit={limit} basePath={BASE} extraParams={extraParams} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
