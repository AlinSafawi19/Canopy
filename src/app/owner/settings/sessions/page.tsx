import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { hashToken } from "@/lib/session-management";
import { SessionList } from "@/components/settings/session-list";

export default async function OwnerSessionsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const cookieStore = await cookies();
  const token = cookieStore.get("cms_session")?.value;
  const currentTokenHash = token ? hashToken(token) : null;

  const currentDbSession = currentTokenHash
    ? await prisma.session.findFirst({
        where: { tokenHash: currentTokenHash, targetId: session.id, revokedAt: null },
        select: { id: true },
      })
    : null;

  const sessions = await prisma.session.findMany({
    where: { targetId: session.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, ipAddress: true, userAgent: true, createdAt: true, lastActivityAt: true },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Sessions</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600 mb-4">
          Manage all devices and locations where you&apos;re signed in. Revoke any sessions you don&apos;t recognize.
        </p>
        <SessionList sessions={sessions} currentSessionId={currentDbSession?.id ?? ""} />
      </CardContent>
    </Card>
  );
}
