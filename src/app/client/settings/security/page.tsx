import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SecurityForm } from "@/components/settings/security-form";
import { ActivityLog } from "@/components/settings/activity-log";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function ClientSecurityPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.clientIdentity.findUnique({
    where: { id: session.id },
    select: { twoFactorEnabled: true },
  });

  const recentEvents = await prisma.auditLog.findMany({
    where: { actorId: session.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      action: true,
      resource: true,
      severity: true,
      ipAddress: true,
      userAgent: true,
      details: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Password & Two-Factor Authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <SecurityForm apiPath="/api/client/profile" twoFactorEnabled={user?.twoFactorEnabled ?? false} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Security Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityLog events={recentEvents} />
        </CardContent>
      </Card>
    </div>
  );
}
