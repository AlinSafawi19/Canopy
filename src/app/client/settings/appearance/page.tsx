import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppearanceForm } from "@/components/settings/appearance-form";

export default async function ClientAppearancePage() {
  const session = await getSession();
  const client = await prisma.clientIdentity.findUnique({
    where: { id: session!.id },
    select: { theme: true },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
      </CardHeader>
      <CardContent>
        <AppearanceForm
          initialTheme={(client?.theme ?? "auto") as "auto" | "light" | "dark"}
          apiPath="/api/client/appearance"
        />
      </CardContent>
    </Card>
  );
}
