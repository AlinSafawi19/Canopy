import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.role !== "owner") redirect("/login");

  const [owner, adminsCount, archivedAdminsCount, archivedReleasesCount, latestRelease] = await Promise.all([
    prisma.platformOwner.findUnique({
      where: { id: session.id },
      select: { walkthroughSeenAt: true, emailVerifiedAt: true, lastSeenReleaseId: true },
    }),
    prisma.adminIdentity.count({ where: { archivedAt: null } }),
    prisma.adminIdentity.count({ where: { archivedAt: { not: null } } }),
    prisma.release.count({ where: { status: "archived" } }),
    prisma.release.findFirst({ where: { status: "published" }, orderBy: { publishedAt: "desc" } }),
  ]);

  const pendingRelease =
    latestRelease && latestRelease.id !== owner?.lastSeenReleaseId ? latestRelease : null;

  return (
    <AppShell
      role="owner"
      displayName={session.displayName}
      username={session.username}
      emailVerified={!!owner?.emailVerifiedAt}
      navCounts={{ "/owner/admins": adminsCount, "/owner/archive": archivedAdminsCount + archivedReleasesCount }}
      walkthroughActive={!owner?.walkthroughSeenAt}
      pendingRelease={pendingRelease}
    >
      {children}
    </AppShell>
  );
}
