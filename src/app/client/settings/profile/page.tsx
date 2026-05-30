import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function ClientProfilePage() {
  const session = await getSession();
  const client = await prisma.clientIdentity.findUnique({
    where: { id: session!.id },
    select: { displayName: true, email: true },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <ProfileForm
          apiPath="/api/client/profile"
          displayName={client!.displayName}
          email={client!.email}
        />
      </CardContent>
    </Card>
  );
}
