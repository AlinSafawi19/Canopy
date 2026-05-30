import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function OwnerProfilePage() {
  const session = await getSession();
  const owner = await prisma.platformOwner.findUnique({
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
          apiPath="/api/owner/profile"
          displayName={owner!.displayName}
          email={owner!.email}
        />
      </CardContent>
    </Card>
  );
}
