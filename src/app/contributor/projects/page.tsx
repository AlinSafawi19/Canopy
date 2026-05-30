import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SortableHeader } from "@/components/ui/sortable-header";
import { parsePage, parseLimit, parseSearch, parseSortDir } from "@/lib/pagination";

const BASE = "/contributor/projects";
const VALID_SORTS = ["name", "updatedAt"] as const;
type SortField = typeof VALID_SORTS[number];

export default async function ContributorProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; search?: string; sortBy?: string; sortDir?: string }>;
}) {
  const session = await getSession();
  const { page: rp, limit: rl, search: rs, sortBy: rsb, sortDir: rsd } = await searchParams;
  const page = parsePage(rp);
  const limit = parseLimit(rl);
  const search = parseSearch(rs);
  const sortBy: SortField = VALID_SORTS.includes(rsb as SortField) ? (rsb as SortField) : "updatedAt";
  const sortDir = parseSortDir(rsd);
  const skip = (page - 1) * limit;

  const assignments = await prisma.contributorAssignment.findMany({
    where: { contributorId: session!.id },
    select: { projectId: true },
  });
  const projectIds = assignments.map((a) => a.projectId);

  const orderBy = sortBy === "name" ? { name: sortDir } : { updatedAt: sortDir };

  const where = {
    id: { in: projectIds },
    archivedAt: null,
    ...(search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { slug: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [projectsTotal, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true, name: true, slug: true, status: true, featured: true, updatedAt: true,
      },
    }),
  ]);

  const statusVariant: Record<string, "success" | "warning" | "danger"> = {
    live: "success",
    in_progress: "warning",
    archived: "danger",
  };

  const extraParams: Record<string, string> = { limit: String(limit), sortBy, sortDir };
  if (search) extraParams.search = search;
  const sortExtras: Record<string, string> = { limit: String(limit), ...(search ? { search } : {}) };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Projects</h2>
        <p className="text-slate-500 text-sm mt-0.5">All projects assigned to you</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>All Projects ({projectsTotal})</CardTitle>
            <SearchInput
              value={search}
              placeholder="Search projects…"
              basePath={BASE}
              extraParams={{ sortBy, sortDir, limit: String(limit) }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortableHeader label="Project Name" field="name" sortBy={sortBy} sortDir={sortDir} basePath={BASE} extraParams={sortExtras} /></TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead><SortableHeader label="Updated" field="updatedAt" sortBy={sortBy} sortDir={sortDir} basePath={BASE} extraParams={sortExtras} /></TableHead>
                <TableHead className="sticky right-0 bg-slate-50">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length === 0 && (
                <TableRow>
                  <TableCell className="text-slate-400 text-center" colSpan={5}>
                    {search ? `No projects found for "${search}"` : "No projects assigned"}
                  </TableCell>
                </TableRow>
              )}
              {projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link href={`/contributor/projects/${p.id}`} className="font-medium text-slate-900 hover:text-indigo-600 transition-colors">
                        {p.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500">{p.slug || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[p.status] ?? "default"}>{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-slate-500">{formatDate(p.updatedAt)}</TableCell>
                  <TableCell className="sticky right-0 bg-white">
                    <Link href={`/contributor/projects/${p.id}`}>
                      <Button variant="outline" size="sm">Open</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4">
            <Pagination total={projectsTotal} page={page} limit={limit} basePath={BASE} extraParams={extraParams} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
