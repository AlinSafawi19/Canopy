import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function AdminProfilePage() {
  const session = await getSession();
  const admin = await prisma.adminIdentity.findUnique({
    where: { id: session!.id },
    select: { displayName: true, email: true, tenantId: true },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <ProfileForm
          apiPath="/api/admin/profile"
          displayName={admin!.displayName}
          email={admin!.email}
          tenantId={admin!.tenantId}
        />
      </CardContent>
    </Card>
  );
}
