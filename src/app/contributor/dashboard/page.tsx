import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FolderKanban, FileText, MessageSquare } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default async function ContributorDashboard() {
  const session = await getSession();

  const [contributor, assignments] = await Promise.all([
    prisma.contributor.findUnique({
      where: { id: session!.id },
      select: { parentClientUsername: true },
    }),
    prisma.contributorAssignment.findMany({
      where: { contributorId: session!.id },
      select: { projectId: true },
    }),
  ]);

  const projectIds = assignments.map((a) => a.projectId);

  const [projects, categoryCount, openRequestCount] = await Promise.all([
    projectIds.length > 0
      ? prisma.project.findMany({
          where: { id: { in: projectIds }, archivedAt: null },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true, name: true, slug: true, status: true,
            featured: true, updatedAt: true,
          },
        })
      : [],
    projectIds.length > 0
      ? prisma.contentCategory.count({
          where: { projectId: { in: projectIds }, archivedAt: null },
        })
      : 0,
    projectIds.length > 0
      ? prisma.changeRequest.count({
          where: { projectId: { in: projectIds }, resolvedAt: null },
        })
      : 0,
  ]);

  const statusVariant: Record<string, "success" | "warning" | "danger"> = {
    live: "success",
    in_progress: "warning",
    archived: "danger",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Welcome, {session?.displayName}</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Contributing under @{contributor?.parentClientUsername}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard title="Assigned Projects" value={projects.length} icon={FolderKanban} color="indigo" />
        <StatCard title="Content Categories" value={categoryCount} icon={FileText} color="emerald" />
        <StatCard title="Pending Requests" value={openRequestCount} icon={MessageSquare} color="amber" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Projects</CardTitle>
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
              {projects.length === 0 && (
                <TableRow>
                  <TableCell className="text-slate-400 text-center" colSpan={5}>
                    No projects assigned yet
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
        </CardContent>
      </Card>
    </div>
  );
}
