import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ContributorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "contributor") redirect("/login");

  const [contributor, assignments] = await Promise.all([
    prisma.contributor.findUnique({
      where: { id: session.id },
      select: { walkthroughSeenAt: true, emailVerifiedAt: true, parentClientUsername: true, tenantId: true, lastSeenReleaseId: true },
    }),
    prisma.contributorAssignment.findMany({
      where: { contributorId: session.id },
      select: { projectId: true },
    }),
  ]);

  const projectIds = assignments.map((a) => a.projectId);
  const projectsCount = projectIds.length;

  const [clientContact, archivedEntriesCount, logsCount, latestRelease] = await Promise.all([
    contributor?.parentClientUsername
      ? prisma.clientIdentity.findFirst({ where: { username: contributor.parentClientUsername }, select: { email: true } })
      : Promise.resolve(null),
    projectIds.length > 0
      ? prisma.contentCategoryEntry.count({ where: { archivedAt: { not: null }, category: { projectId: { in: projectIds } } } })
      : Promise.resolve(0),
    prisma.activityLog.count({ where: { actorId: session.id } }),
    prisma.release.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);

  const pendingRelease =
    latestRelease && latestRelease.id !== contributor?.lastSeenReleaseId ? latestRelease : null;

  return (
    <AppShell
      role="contributor"
      displayName={session.displayName}
      username={session.username}
      emailVerified={!!contributor?.emailVerifiedAt}
      navCounts={{ "/contributor/projects": projectsCount, "/contributor/archive": archivedEntriesCount, "/contributor/logs": logsCount }}
      contactEmail={clientContact?.email || undefined}
      walkthroughActive={!contributor?.walkthroughSeenAt}
      pendingRelease={pendingRelease}
    >
      {children}
    </AppShell>
  );
}
