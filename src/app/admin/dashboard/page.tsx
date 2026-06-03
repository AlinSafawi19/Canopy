import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FolderKanban, Users, FileText, UserCog } from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CreateProjectButton } from "../projects/create-project-button";
import { CreateClientButton } from "../clients/create-client-button";

export default async function AdminDashboard() {
  const session = await getSession();
  const tenantId = session!.tenantId!;

  const [projectCount, clientCount, categoryCount, contributorCount, recentProjects] =
    await Promise.all([
      prisma.project.count({ where: { adminTenantId: tenantId, archivedAt: null } }),
      prisma.clientAssignment.count({
        where: { tenantId, archivedAt: null },
      }),
      prisma.contentCategory.count({
        where: { project: { adminTenantId: tenantId }, archivedAt: null },
      }),
      prisma.contributor.count({ where: { tenantId, archivedAt: null } }),
      prisma.project.findMany({
        where: { adminTenantId: tenantId, archivedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 6,
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Welcome back, {session?.displayName}
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Workspace: <span className="font-medium text-indigo-600">{tenantId}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Projects" value={projectCount} icon={FolderKanban} color="indigo" />
        <StatCard title="Clients" value={clientCount} icon={Users} color="sky" />
        <StatCard title="Categories" value={categoryCount} icon={FileText} color="emerald" />
        <StatCard title="Contributors" value={contributorCount} icon={UserCog} color="amber" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <CreateProjectButton />
            <CreateClientButton tenantId={tenantId} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Projects</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="sticky right-0 bg-slate-50">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentProjects.length === 0 && (
                <TableRow>
                  <TableCell className="text-slate-400 text-center" colSpan={5}>
                    No projects yet
                  </TableCell>
                </TableRow>
              )}
              {recentProjects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/projects/${p.id}`} className="font-medium text-slate-900 hover:text-indigo-600 transition-colors">
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
                    <Link href={`/admin/projects/${p.id}`}>
                      <Button variant="outline" size="sm">Open</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
