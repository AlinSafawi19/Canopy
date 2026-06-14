import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CreateProjectButton } from "./create-project-button";
import { ProjectActions } from "./project-actions";
import { ExternalLink } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SortableHeader } from "@/components/ui/sortable-header";
import { parsePage, parseLimit, parseSearch, parseSortDir } from "@/lib/pagination";

const BASE = "/admin/projects";
const VALID_SORTS = ["name", "updatedAt"] as const;
type SortField = typeof VALID_SORTS[number];

export default async function ProjectsPage({
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

  const orderBy = sortBy === "name" ? { name: sortDir } : { updatedAt: sortDir };

  const where = {
    adminTenantId: tenantId,
    archivedAt: null,
    ...(search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { slug: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [total, projects, assignments] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true, name: true, slug: true, status: true, featured: true,
        overview: true, tagline: true, industry: true,
        domain: true, host: true, liveUrl: true, githubUrl: true,
        thumbnail_image: true, thumbnail_video: true, thumbnail_type: true, thumbnail_alt: true,
        role: true, teamSize: true, techStack: true, highlights: true,
        challenge: true, approach: true, outcome: true, testimonial: true,
        startDate: true, endDate: true, archivedAt: true, updatedAt: true,
        _count: { select: { contentCategories: true } },
      },
    }),
    prisma.clientAssignment.findMany({
      where: { tenantId },
      select: {
        projectId: true,
        client: { select: { id: true, name: true, username: true, email: true } },
      },
    }),
  ]);

  const assignedClientByProject = new Map(assignments.map((a) => [a.projectId, a.client]));

  const statusVariant: Record<string, "success" | "warning" | "danger"> = {
    live: "success", in_progress: "warning", archived: "danger",
  };

  const extraParams: Record<string, string> = { limit: String(limit), sortBy, sortDir };
  if (search) extraParams.search = search;
  const sortExtras: Record<string, string> = { limit: String(limit), ...(search ? { search } : {}) };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-y-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Projects</h2>
          <p className="text-slate-500 text-sm mt-0.5">Manage your workspace projects</p>
        </div>
        <CreateProjectButton />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>All Projects ({total})</CardTitle>
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
                <TableHead><SortableHeader label="Name" field="name" sortBy={sortBy} sortDir={sortDir} basePath={BASE} extraParams={sortExtras} /></TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead><SortableHeader label="Updated" field="updatedAt" sortBy={sortBy} sortDir={sortDir} basePath={BASE} extraParams={sortExtras} /></TableHead>
                <TableHead className="sticky right-0 bg-slate-50">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length === 0 && (
                <TableRow>
                  <TableCell className="text-slate-400 text-center" colSpan={7}>
                    {search ? `No projects found for "${search}"` : "No projects yet"}
                  </TableCell>
                </TableRow>
              )}
              {projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/projects/${p.id}`} className="font-medium text-slate-900 hover:text-indigo-600 transition-colors">
                        {p.name}
                      </Link>
                      {p.featured && <Badge variant="info">Featured</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500">{p.slug || "—"}</TableCell>
                  <TableCell><Badge variant={statusVariant[p.status] ?? "default"}>{p.status}</Badge></TableCell>
                  <TableCell className="text-slate-700">{p._count.contentCategories}</TableCell>
                  <TableCell>
                    {p.domain ? (
                      <span className="flex items-center gap-1 text-slate-500 text-xs"><ExternalLink size={12} />{p.domain}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-500">{formatDate(p.updatedAt)}</TableCell>
                  <TableCell className="sticky right-0 bg-white">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/projects/${p.id}`}><Button variant="outline" size="sm">Open</Button></Link>
                      <ProjectActions
                        project={{
                          ...p,
                          techStack: Array.isArray(p.techStack) ? (p.techStack as string[]) : [],
                          highlights: Array.isArray(p.highlights) ? (p.highlights as string[]) : [],
                          startDate: p.startDate ? p.startDate.toISOString() : null,
                          endDate: p.endDate ? p.endDate.toISOString() : null,
                        }}
                        assignedClient={assignedClientByProject.get(p.id) ?? null}
                      />
                    </div>
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
