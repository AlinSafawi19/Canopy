import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SecurityForm } from "@/components/settings/security-form";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function OwnerSecurityPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.platformOwner.findUnique({
    where: { id: session.id },
    select: { twoFactorEnabled: true },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security</CardTitle>
      </CardHeader>
      <CardContent>
        <SecurityForm apiPath="/api/owner/profile" twoFactorEnabled={user?.twoFactorEnabled ?? false} />
      </CardContent>
    </Card>
  );
}
