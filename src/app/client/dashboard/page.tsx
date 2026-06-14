import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FolderKanban, Users, Layers } from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CreateContributorButton } from "../contributors/create-contributor-button";

export default async function ClientDashboard() {
  const session = await getSession();

  const assignments = await prisma.clientAssignment.findMany({
    where: { clientId: session!.id, archivedAt: null },
    include: {
      client: { select: { id: true } },
    },
  });

  const projectIds = assignments.map((a) => a.projectId);

  const [projects, contributorCount, categoryCount] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: projectIds }, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, slug: true, status: true, overview: true, updatedAt: true },
    }),
    prisma.contributor.count({
      where: { parentClientUsername: session!.username, archivedAt: null },
    }),
    prisma.contentCategory.count({
      where: { projectId: { in: projectIds }, archivedAt: null },
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
        <h2 className="text-xl font-bold text-slate-900">Welcome, {session?.displayName}</h2>
        <p className="text-slate-500 text-sm mt-0.5">Your assigned projects</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard title="Assigned Projects" value={projects.length} icon={FolderKanban} color="indigo" />
        <StatCard title="Contributors" value={contributorCount} icon={Users} color="sky" />
        <StatCard title="Content Categories" value={categoryCount} icon={Layers} color="emerald" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <CreateContributorButton />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Your Projects</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="sticky right-0 bg-slate-50">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length === 0 && (
                <TableRow>
                  <TableCell className="text-slate-400 text-center" colSpan={4}>No projects assigned</TableCell>
                </TableRow>
              )}
              {projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{p.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[p.status] ?? "default"}>{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-slate-500">{formatDate(p.updatedAt)}</TableCell>
                  <TableCell className="sticky right-0 bg-white">
                    <Link href={`/client/projects/${p.id}`}>
                      <Button variant="outline" size="sm">View</Button>
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
