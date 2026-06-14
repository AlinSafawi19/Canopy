import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientSettingsForm } from "@/app/client/settings/client-settings-form";

export default async function ClientProfilePage() {
  const session = await getSession();
  const client = await prisma.clientIdentity.findUnique({
    where: { id: session!.id },
    select: { id: true, name: true, email: true, username: true, representativeName: true, representativeDesignation: true },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <ClientSettingsForm client={client!} />
      </CardContent>
    </Card>
  );
}
