import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { AdminActions } from "./admin-actions";
import { CreateAdminButton } from "./create-admin-button";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SortableHeader } from "@/components/ui/sortable-header";
import { parsePage, parseLimit, parseSearch, parseSortDir } from "@/lib/pagination";
import { InviteStatusCell } from "@/components/ui/invite-status-cell";
import { inviteStatus } from "@/lib/invite-tokens";

const BASE = "/owner/admins";
const VALID_SORTS = ["displayName", "username", "updatedAt"] as const;
type SortField = typeof VALID_SORTS[number];

export default async function AdminsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; search?: string; sortBy?: string; sortDir?: string }>;
}) {
  const { page: rp, limit: rl, search: rs, sortBy: rsb, sortDir: rsd } = await searchParams;
  const page = parsePage(rp);
  const limit = parseLimit(rl);
  const search = parseSearch(rs);
  const sortBy: SortField = VALID_SORTS.includes(rsb as SortField) ? (rsb as SortField) : "updatedAt";
  const sortDir = parseSortDir(rsd);
  const skip = (page - 1) * limit;

  const orderBy =
    sortBy === "displayName" ? { displayName: sortDir } :
    sortBy === "username" ? { username: sortDir } :
    { updatedAt: sortDir };

  const where = search ? {
    OR: [
      { displayName: { contains: search, mode: "insensitive" as const } },
      { username: { contains: search, mode: "insensitive" as const } },
      { email: { contains: search, mode: "insensitive" as const } },
    ],
  } : {};

  const [total, admins] = await Promise.all([
    prisma.adminIdentity.count({ where }),
    prisma.adminIdentity.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true, username: true, displayName: true, email: true,
        tenantId: true, archivedAt: true, updatedAt: true,
      },
    }),
  ]);

  // Fetch latest invite token for each admin
  const inviteTokens = await prisma.inviteToken.findMany({
    where: { targetKind: "admin", targetId: { in: admins.map((a) => a.id) } },
    orderBy: { createdAt: "desc" },
  });
  const inviteMap = new Map(
    admins.map((a) => {
      const token = inviteTokens.find((t) => t.targetId === a.id) ?? null;
      return [a.id, token];
    })
  );

  const extraParams: Record<string, string> = { limit: String(limit), sortBy, sortDir };
  if (search) extraParams.search = search;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-y-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Admin Accounts</h2>
          <p className="text-slate-500 text-sm mt-0.5">Manage CMS admin workspaces</p>
        </div>
        <CreateAdminButton />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>All Admins ({total})</CardTitle>
            <SearchInput
              value={search}
              placeholder="Search admins…"
              basePath={BASE}
              extraParams={{ sortBy, sortDir, limit: String(limit) }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortableHeader label="Name" field="displayName" sortBy={sortBy} sortDir={sortDir} basePath={BASE} extraParams={{ limit: String(limit), ...(search ? { search } : {}) }} /></TableHead>
                <TableHead><SortableHeader label="Username" field="username" sortBy={sortBy} sortDir={sortDir} basePath={BASE} extraParams={{ limit: String(limit), ...(search ? { search } : {}) }} /></TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invite</TableHead>
                <TableHead><SortableHeader label="Updated" field="updatedAt" sortBy={sortBy} sortDir={sortDir} basePath={BASE} extraParams={{ limit: String(limit), ...(search ? { search } : {}) }} /></TableHead>
                <TableHead className="sticky right-0 bg-slate-50">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.length === 0 && (
                <TableRow>
                  <TableCell className="text-slate-400 text-center" colSpan={8}>
                    {search ? `No admins found for "${search}"` : "No admins yet"}
                  </TableCell>
                </TableRow>
              )}
              {admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium text-slate-900">{admin.displayName}</TableCell>
                  <TableCell className="text-slate-500">@{admin.username}</TableCell>
                  <TableCell className="text-slate-500">{admin.email || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{admin.tenantId || "unset"}</Badge></TableCell>
                  <TableCell>
                    {admin.archivedAt ? <Badge variant="danger">Archived</Badge> : <Badge variant="success">Active</Badge>}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const t = inviteMap.get(admin.id) ?? null;
                      const st = t ? inviteStatus(t) : "none";
                      return <InviteStatusCell targetKind="admin" targetId={admin.id} displayName={admin.displayName} status={st} token={t?.token} />;
                    })()}
                  </TableCell>
                  <TableCell className="text-slate-500">{formatDate(admin.updatedAt)}</TableCell>
                  <TableCell className="sticky right-0 bg-white"><AdminActions admin={admin} /></TableCell>
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
