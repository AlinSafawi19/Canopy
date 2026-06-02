import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { SearchInput } from "@/components/ui/search-input";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { ActionFilter } from "@/components/ui/action-filter";
import { Pagination } from "@/components/ui/pagination";
import { ContributorLogFilter } from "./contributor-log-filter";
import { parsePage, parseLimit, parseSearch } from "@/lib/pagination";
import { formatDate } from "@/lib/utils";

const PATH = "/client/logs";

const VALID_ACTIONS = ["created", "updated", "archived", "restored", "deleted"] as const;

function ActionBadge({ action }: { action: string }) {
  const colorMap: Record<string, string> = {
    created: "bg-emerald-50 text-emerald-700 border-emerald-200",
    updated: "bg-indigo-50 text-indigo-700 border-indigo-200",
    archived: "bg-amber-50 text-amber-700 border-amber-200",
    restored: "bg-teal-50 text-teal-700 border-teal-200",
    deleted: "bg-red-50 text-red-700 border-red-200",
  };
  const cls = colorMap[action] ?? "bg-slate-50 text-slate-700 border-slate-200";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${cls}`}>
      {action}
    </span>
  );
}

function ResourceBadge({ resource }: { resource: string }) {
  const colorMap: Record<string, string> = {
    project: "bg-slate-100 text-slate-600",
    category: "bg-purple-50 text-purple-700",
    entry: "bg-blue-50 text-blue-700",
    client: "bg-indigo-100 text-indigo-700",
    contributor: "bg-orange-50 text-orange-700",
  };
  const cls = colorMap[resource] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${cls}`}>
      {resource}
    </span>
  );
}

export default async function ClientLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    page?: string;
    limit?: string;
    startDate?: string;
    endDate?: string;
    contributorId?: string;
    action?: string;
  }>;
}) {
  const session = await getSession();

  const { search: rs, page: rp, limit: rl, startDate, endDate, contributorId, action: ra } = await searchParams;
  const search = parseSearch(rs);
  const page = parsePage(rp);
  const limit = parseLimit(rl);
  const skip = (page - 1) * limit;
  const action = VALID_ACTIONS.includes(ra as typeof VALID_ACTIONS[number]) ? ra! : "";

  const contributorName = contributorId
    ? await prisma.contributor.findFirst({
        where: { id: contributorId, parentClientUsername: session!.username },
        select: { displayName: true },
      }).then((c) => c?.displayName ?? "")
    : "";

  const actorFilter = contributorId
    ? { actorId: contributorId, parentClientUsername: session!.username }
    : {
        OR: [
          { actorId: session!.id },
          { actorRole: "contributor" as const, parentClientUsername: session!.username },
        ],
      };

  const where = {
    ...actorFilter,
    ...(action ? { action } : {}),
    ...(search
      ? {
          AND: [{
            OR: [
              { resourceName: { contains: search, mode: "insensitive" as const } },
              { action: { contains: search, mode: "insensitive" as const } },
              { resource: { contains: search, mode: "insensitive" as const } },
              { actorName: { contains: search, mode: "insensitive" as const } },
            ],
          }],
        }
      : {}),
    ...(startDate || endDate ? {
      createdAt: {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate + "T23:59:59.999Z") } : {}),
      },
    } : {}),
  };

  const [total, logs] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  // Each filter's extraParams carries all other active filters
  const extraParams: Record<string, string> = {
    limit: String(limit),
    ...(search ? { search } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(contributorId ? { contributorId } : {}),
    ...(action ? { action } : {}),
  };
  const extrasForDate: Record<string, string> = {
    limit: String(limit),
    ...(search ? { search } : {}),
    ...(contributorId ? { contributorId } : {}),
    ...(action ? { action } : {}),
  };
  const extrasForAction: Record<string, string> = {
    limit: String(limit),
    ...(search ? { search } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(contributorId ? { contributorId } : {}),
  };
  const extrasForContributor: Record<string, string> = {
    limit: String(limit),
    ...(search ? { search } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(action ? { action } : {}),
  };
  const extrasForSearch: Record<string, string> = {
    limit: String(limit),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(contributorId ? { contributorId } : {}),
    ...(action ? { action } : {}),
  };

  const hasFilters = !!(search || startDate || endDate || contributorId || action);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Activity Log</h2>
        <p className="text-slate-500 text-sm mt-0.5">All actions by you and your contributors</p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>{total} {total === 1 ? "entry" : "entries"}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <ContributorLogFilter
                value={contributorId ?? ""}
                initialLabel={contributorName}
                basePath={PATH}
                extraParams={extrasForContributor}
              />
              <ActionFilter
                value={action}
                basePath={PATH}
                extraParams={extrasForAction}
              />
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                basePath={PATH}
                extraParams={extrasForDate}
              />
              <SearchInput
                value={search}
                placeholder="Search logs…"
                basePath={PATH}
                extraParams={extrasForSearch}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 px-3 text-center">#</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead className="min-w-[180px]">Name</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-slate-400 text-center">
                    {hasFilters ? "No logs found for the selected filters" : "No activity yet"}
                  </TableCell>
                </TableRow>
              )}
              {logs.map((log, idx) => (
                <TableRow key={log.id}>
                  <TableCell className="px-3 text-center text-xs text-slate-400">
                    {skip + idx + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-slate-700">{log.actorName}</span>
                      <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded capitalize">
                        {log.actorRole}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ActionBadge action={log.action} />
                  </TableCell>
                  <TableCell>
                    <ResourceBadge resource={log.resource} />
                  </TableCell>
                  <TableCell className="max-w-[240px]">
                    {log.resourceName ? (
                      <span className="block truncate text-slate-700">{log.resourceName}</span>
                    ) : log.resourceId ? (
                      <span className="text-slate-400 font-mono text-xs">{log.resourceId.slice(0, 8)}…</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="text-xs text-slate-500">{formatDate(log.createdAt)}</span>
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
    </div>
  );
}
