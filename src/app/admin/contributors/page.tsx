import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { ContributorActions } from "./contributor-actions";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SortableHeader } from "@/components/ui/sortable-header";
import { parsePage, parseLimit, parseSearch, parseSortDir } from "@/lib/pagination";

const BASE = "/admin/contributors";
const VALID_SORTS = ["displayName", "updatedAt"] as const;
type SortField = typeof VALID_SORTS[number];

export default async function ContributorsPage({
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
  const sortBy: SortField = VALID_SORTS.includes(rsb as SortField) ? (rsb as SortField) : "updatedAt";
  const sortDir = parseSortDir(rsd);
  const skip = (page - 1) * limit;

  const orderBy = sortBy === "displayName" ? { displayName: sortDir } : { updatedAt: sortDir };

  const where = {
    tenantId,
    ...(search ? {
      OR: [
        { displayName: { contains: search, mode: "insensitive" as const } },
        { username: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
        { parentClientUsername: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [total, contributors] = await Promise.all([
    prisma.contributor.count({ where }),
    prisma.contributor.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true, username: true, displayName: true, email: true,
        parentClientUsername: true, archivedAt: true, updatedAt: true,
        assignments: { select: { projectId: true } },
      },
    }),
  ]);

  const extraParams: Record<string, string> = { limit: String(limit), sortBy, sortDir };
  if (search) extraParams.search = search;
  const sortExtras: Record<string, string> = { limit: String(limit), ...(search ? { search } : {}) };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Contributors</h2>
        <p className="text-slate-500 text-sm mt-0.5">Contributors across all workspace projects</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>All Contributors ({total})</CardTitle>
            <SearchInput
              value={search}
              placeholder="Search contributors…"
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
                <TableHead>Projects</TableHead>
                <TableHead>Parent Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead><SortableHeader label="Updated" field="updatedAt" sortBy={sortBy} sortDir={sortDir} basePath={BASE} extraParams={sortExtras} /></TableHead>
                <TableHead className="sticky right-0 bg-slate-50">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contributors.length === 0 && (
                <TableRow>
                  <TableCell className="text-slate-400 text-center" colSpan={7}>
                    {search ? `No contributors found for "${search}"` : "No contributors yet"}
                  </TableCell>
                </TableRow>
              )}
              {contributors.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-slate-900">{c.displayName}</TableCell>
                  <TableCell className="text-slate-500">@{c.username}</TableCell>
                  <TableCell className="text-slate-700">
                    {c.assignments.length === 0 ? <span className="text-slate-400">—</span> : c.assignments.length}
                  </TableCell>
                  <TableCell className="text-slate-500">@{c.parentClientUsername}</TableCell>
                  <TableCell>
                    {c.archivedAt ? <Badge variant="danger">Archived</Badge> : <Badge variant="success">Active</Badge>}
                  </TableCell>
                  <TableCell className="text-slate-500">{formatDate(c.updatedAt)}</TableCell>
                  <TableCell className="sticky right-0 bg-white"><ContributorActions contributor={c} /></TableCell>
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
