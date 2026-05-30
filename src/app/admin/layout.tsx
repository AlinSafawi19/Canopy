import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");

  const admin = await prisma.adminIdentity.findUnique({
    where: { id: session.id },
    select: { walkthroughSeenAt: true, emailVerifiedAt: true, tenantId: true },
  });

  const tenantId = admin?.tenantId ?? "";

  const [
    projectsCount, clientsCount, owner,
    archivedProjectsCount, archivedCategoriesCount, archivedEntriesCount,
    logsCount,
  ] = await Promise.all([
    prisma.project.count({ where: { adminTenantId: tenantId, archivedAt: null } }),
    prisma.clientIdentity.count({ where: { tenantId, archivedAt: null } }),
    prisma.platformOwner.findFirst({ select: { email: true } }),
    prisma.project.count({ where: { adminTenantId: tenantId, archivedAt: { not: null } } }),
    prisma.contentCategory.count({ where: { archivedAt: { not: null }, project: { adminTenantId: tenantId } } }),
    prisma.contentCategoryEntry.count({ where: { archivedAt: { not: null }, category: { project: { adminTenantId: tenantId } } } }),
    prisma.activityLog.count({ where: { adminTenantId: tenantId, actorId: session.id } }),
  ]);

  const archiveCount = archivedProjectsCount + archivedCategoriesCount + archivedEntriesCount;

  return (
    <AppShell
      role="admin"
      displayName={session.displayName}
      username={session.username}
      emailVerified={!!admin?.emailVerifiedAt}
      navCounts={{ "/admin/projects": projectsCount, "/admin/clients": clientsCount, "/admin/archive": archiveCount, "/admin/logs": logsCount }}
      contactEmail={owner?.email || undefined}
      walkthroughActive={!admin?.walkthroughSeenAt}
    >
      {children}
    </AppShell>
  );
}
