import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserCog, FolderKanban, Users, Layers } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { CreateAdminButton } from "../admins/create-admin-button";
import { PublishReleaseButton } from "../settings/releases/publish-release-button";

export default async function OwnerDashboard() {
  const session = await getSession();

  const [adminCount, projectCount, clientCount, contributorCount, recentAdmins] =
    await Promise.all([
      prisma.adminIdentity.count(),
      prisma.project.count({ where: { archivedAt: null } }),
      prisma.clientIdentity.count({ where: { archivedAt: null } }),
      prisma.contributor.count({ where: { archivedAt: null } }),
      prisma.adminIdentity.findMany({
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          tenantId: true,
          archivedAt: true,
          updatedAt: true,
        },
      }),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Welcome back, {session?.displayName}
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Platform overview — all workspaces
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-wt="stat-cards">
        <StatCard title="Total Admins" value={adminCount} icon={UserCog} color="indigo" />
        <StatCard title="Total Projects" value={projectCount} icon={FolderKanban} color="emerald" />
        <StatCard title="Total Clients" value={clientCount} icon={Users} color="sky" />
        <StatCard title="Total Contributors" value={contributorCount} icon={Layers} color="rose" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <CreateAdminButton />
            <PublishReleaseButton />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Admin Workspaces</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentAdmins.length === 0 && (
                <TableRow>
                  <TableCell className="text-slate-400 text-center" colSpan={6}>
                    No admins yet
                  </TableCell>
                </TableRow>
              )}
              {recentAdmins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium text-slate-900">{admin.displayName}</TableCell>
                  <TableCell className="text-slate-500">@{admin.username}</TableCell>
                  <TableCell className="text-slate-500">{admin.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{admin.tenantId || "unset"}</Badge>
                  </TableCell>
                  <TableCell>
                    {admin.archivedAt ? (
                      <Badge variant="danger">Archived</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-500">{formatDate(admin.updatedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
