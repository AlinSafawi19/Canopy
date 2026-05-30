import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function ContributorProfilePage() {
  const session = await getSession();
  const contributor = await prisma.contributor.findUnique({
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
          apiPath="/api/contributor/profile"
          displayName={contributor!.displayName}
          email={contributor!.email}
        />
      </CardContent>
    </Card>
  );
}
