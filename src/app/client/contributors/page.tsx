import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { CreateContributorButton } from "./create-contributor-button";
import { ContributorActions } from "./contributor-actions";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SortableHeader } from "@/components/ui/sortable-header";
import { parsePage, parseLimit, parseSearch, parseSortDir } from "@/lib/pagination";
import { InviteStatusCell } from "@/components/ui/invite-status-cell";
import { inviteStatus } from "@/lib/invite-tokens";

const BASE = "/client/contributors";
const VALID_SORTS = ["displayName", "updatedAt"] as const;
type SortField = typeof VALID_SORTS[number];

export default async function ClientContributorsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; search?: string; sortBy?: string; sortDir?: string }>;
}) {
  const session = await getSession();
  const { page: rp, limit: rl, search: rs, sortBy: rsb, sortDir: rsd } = await searchParams;
  const page = parsePage(rp);
  const limit = parseLimit(rl);
  const search = parseSearch(rs);
  const sortBy: SortField = VALID_SORTS.includes(rsb as SortField) ? (rsb as SortField) : "displayName";
  const sortDir = parseSortDir(rsd === "desc" ? "desc" : rsd === "asc" ? "asc" : "asc");
  const skip = (page - 1) * limit;

  const orderBy = sortBy === "updatedAt" ? { updatedAt: sortDir } : { displayName: sortDir };

  const where = {
    parentClientUsername: session!.username,
    ...(search ? {
      OR: [
        { displayName: { contains: search, mode: "insensitive" as const } },
        { username: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [total, contributors, rawInviteTokens] = await Promise.all([
    prisma.contributor.count({ where }),
    prisma.contributor.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true, username: true, displayName: true, email: true,
        archivedAt: true, updatedAt: true,
        assignments: { select: { projectId: true } },
      },
    }),
    prisma.inviteToken.findMany({
      where: { targetKind: "contributor" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const allProjectIds = [...new Set(contributors.flatMap((c) => c.assignments.map((a) => a.projectId)))];
  const projects = allProjectIds.length > 0
    ? await prisma.project.findMany({ where: { id: { in: allProjectIds } }, select: { id: true, name: true } })
    : [];
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  const inviteMap = new Map(
    contributors.map((c) => {
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
          <h2 className="text-xl font-bold text-slate-900">Contributors</h2>
          <p className="text-slate-500 text-sm mt-0.5">Team members under your account</p>
        </div>
        <CreateContributorButton />
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
                <TableHead>Email</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invite</TableHead>
                <TableHead><SortableHeader label="Updated" field="updatedAt" sortBy={sortBy} sortDir={sortDir} basePath={BASE} extraParams={sortExtras} /></TableHead>
                <TableHead className="sticky right-0 bg-slate-50">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contributors.length === 0 && (
                <TableRow>
                  <TableCell className="text-slate-400 text-center" colSpan={8}>
                    {search ? `No contributors found for "${search}"` : "No contributors yet"}
                  </TableCell>
                </TableRow>
              )}
              {contributors.map((c) => {
                const projectNames = c.assignments
                  .map((a) => projectMap[a.projectId])
                  .filter(Boolean);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-slate-900">{c.displayName}</TableCell>
                    <TableCell className="text-slate-500">@{c.username}</TableCell>
                    <TableCell className="text-slate-500">{c.email}</TableCell>
                    <TableCell className="text-slate-700">
                      {projectNames.length === 0
                        ? <span className="text-slate-400">—</span>
                        : projectNames.length === 1
                          ? projectNames[0]
                          : <span>{projectNames.length} projects</span>}
                    </TableCell>
                    <TableCell>
                      {c.archivedAt
                        ? <Badge variant="danger">Archived</Badge>
                        : <Badge variant="success">Active</Badge>}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const t = inviteMap.get(c.id) ?? null;
                        const st = t ? inviteStatus(t) : "none";
                        return <InviteStatusCell targetKind="contributor" targetId={c.id} displayName={c.displayName} status={st} token={t?.token} />;
                      })()}
                    </TableCell>
                    <TableCell className="text-slate-500">{formatDate(c.updatedAt)}</TableCell>
                    <TableCell className="sticky right-0 bg-white">
                      <ContributorActions
                        contributor={c}
                        currentProjects={c.assignments.map((a) => ({ id: a.projectId, name: projectMap[a.projectId] ?? "" })).filter((p) => p.name)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
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
