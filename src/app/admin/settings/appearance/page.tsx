import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppearanceForm } from "@/components/settings/appearance-form";

export default async function AdminAppearancePage() {
  const session = await getSession();
  const admin = await prisma.adminIdentity.findUnique({
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
          initialTheme={(admin?.theme ?? "auto") as "auto" | "light" | "dark"}
          apiPath="/api/admin/appearance"
        />
      </CardContent>
    </Card>
  );
}
