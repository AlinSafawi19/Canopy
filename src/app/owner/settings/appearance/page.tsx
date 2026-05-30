import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppearanceForm } from "@/components/settings/appearance-form";

export default async function OwnerAppearancePage() {
  const session = await getSession();
  const owner = await prisma.platformOwner.findUnique({
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
          initialTheme={(owner?.theme ?? "auto") as "auto" | "light" | "dark"}
          apiPath="/api/owner/appearance"
        />
      </CardContent>
    </Card>
  );
}
