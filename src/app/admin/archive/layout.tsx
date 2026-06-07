import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TabShell } from "@/components/layout/tab-shell";

export default async function AdminArchiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const tenantId = session!.tenantId!;

  const [projectsCount, categoriesCount, entriesCount, clientsCount, contributorsCount] = await Promise.all([
    prisma.project.count({
      where: { archivedAt: { not: null }, adminTenantId: tenantId },
    }),
    prisma.contentCategory.count({
      where: {
        archivedAt: { not: null },
        project: { adminTenantId: tenantId },
      },
    }),
    prisma.contentCategoryEntry.count({
      where: {
        archivedAt: { not: null },
        category: { project: { adminTenantId: tenantId } },
      },
    }),
    prisma.clientIdentity.count({
      where: { archivedAt: { not: null }, tenantId },
    }),
    prisma.contributor.count({
      where: { archivedAt: { not: null }, tenantId },
    }),
  ]);

  const navItems = [
    { label: "Projects", segment: "projects", icon: "Folder", count: projectsCount },
    { label: "Categories", segment: "categories", icon: "Layers", count: categoriesCount },
    { label: "Entries", segment: "entries", icon: "FileText", count: entriesCount },
    { label: "Clients", segment: "clients", icon: "Users", count: clientsCount },
    { label: "Contributors", segment: "contributors", icon: "UserCheck", count: contributorsCount },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Archive</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          All archived items across your projects
        </p>
      </div>
      <TabShell basePath="/admin/archive" navItems={navItems}>
        {children}
      </TabShell>
    </div>
  );
}
