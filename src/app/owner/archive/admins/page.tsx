import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchInput } from "@/components/ui/search-input";
import { Pagination } from "@/components/ui/pagination";
import { AdminActions } from "@/app/owner/admins/admin-actions";
import { formatDate } from "@/lib/utils";
import { parsePage, parseLimit, parseSearch } from "@/lib/pagination";

const PATH = "/owner/archive/admins";

export default async function OwnerArchiveAdminsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; limit?: string }>;
}) {
  const { search: rs, page: rp, limit: rl } = await searchParams;
  const search = parseSearch(rs);
  const page = parsePage(rp);
  const limit = parseLimit(rl);
  const skip = (page - 1) * limit;

  const where = {
    archivedAt: { not: null as null },
    ...(search ? {
      OR: [
        { displayName: { contains: search, mode: "insensitive" as const } },
        { username:    { contains: search, mode: "insensitive" as const } },
        { email:       { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [total, admins] = await Promise.all([
    prisma.adminIdentity.count({ where }),
    prisma.adminIdentity.findMany({
      where,
      orderBy: { archivedAt: "desc" },
      skip,
      take: limit,
      select: { id: true, username: true, displayName: true, email: true, tenantId: true, mustChangePassword: true, archivedAt: true, updatedAt: true },
    }),
  ]);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{total} archived {total === 1 ? "admin" : "admins"}</CardTitle>
        <SearchInput value={search} placeholder="Search admins…" basePath={PATH} extraParams={{ limit: String(limit) }} />
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
            {admins.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-slate-400 text-center">
                  {search ? `No archived admins found for "${search}"` : "Nothing archived yet"}
                </TableCell>
              </TableRow>
            )}
            {admins.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell className="font-medium text-slate-900">{admin.displayName}</TableCell>
                <TableCell className="text-slate-500">@{admin.username}</TableCell>
                <TableCell className="text-slate-500">{admin.email || "—"}</TableCell>
                <TableCell className="text-xs text-slate-500 whitespace-nowrap">{formatDate(admin.archivedAt)}</TableCell>
                <TableCell className="sticky right-0 bg-white"><AdminActions admin={admin} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {total > 0 && (
          <div className="px-4 border-t border-slate-100">
            <Pagination total={total} page={page} limit={limit} basePath={PATH} extraParams={{ limit: String(limit), ...(search ? { search } : {}) }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
