import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "client") redirect("/login");

  const client = await prisma.clientIdentity.findUnique({
    where: { id: session.id },
    select: { walkthroughSeenAt: true, emailVerifiedAt: true, tenantId: true },
  });

  const clientId = session.id;
  const assignedProjectFilter = { clientAssignments: { some: { clientId, archivedAt: null } } };

  const [
    projectsCount, contributorsCount, adminContact,
    archivedCategoriesCount, archivedEntriesCount,
    logsCount,
  ] = await Promise.all([
    prisma.clientAssignment.count({ where: { clientId, archivedAt: null } }),
    client?.tenantId
      ? prisma.contributor.count({ where: { tenantId: client.tenantId, parentClientUsername: session.username, archivedAt: null } })
      : Promise.resolve(0),
    client?.tenantId
      ? prisma.adminIdentity.findFirst({ where: { tenantId: client.tenantId }, select: { email: true } })
      : Promise.resolve(null),
    prisma.contentCategory.count({ where: { archivedAt: { not: null }, project: assignedProjectFilter } }),
    prisma.contentCategoryEntry.count({ where: { archivedAt: { not: null }, category: { project: assignedProjectFilter } } }),
    prisma.activityLog.count({
      where: { OR: [{ actorId: clientId }, { actorRole: "contributor", parentClientUsername: session.username }] },
    }),
  ]);

  const archiveCount = archivedCategoriesCount + archivedEntriesCount;

  return (
    <AppShell
      role="client"
      displayName={session.displayName}
      username={session.username}
      emailVerified={!!client?.emailVerifiedAt}
      navCounts={{ "/client/projects": projectsCount, "/client/contributors": contributorsCount, "/client/archive": archiveCount, "/client/logs": logsCount }}
      contactEmail={adminContact?.email || undefined}
      walkthroughActive={!client?.walkthroughSeenAt}
    >
      {children}
    </AppShell>
  );
}
