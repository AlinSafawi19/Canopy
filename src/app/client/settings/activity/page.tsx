import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ActivityLog } from "@/components/settings/activity-log";

export default async function ClientActivityPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const events = await prisma.auditLog.findMany({
    where: { actorId: session.id },
    orderBy: { createdAt: "desc" },
    take: 50,
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
    <Card>
      <CardHeader>
        <CardTitle>Security Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600 mb-4">
          Recent security events on your account. Review to ensure all activity is authorized.
        </p>
        <ActivityLog events={events} />
      </CardContent>
    </Card>
  );
}
