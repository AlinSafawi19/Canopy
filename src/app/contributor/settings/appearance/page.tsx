import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppearanceForm } from "@/components/settings/appearance-form";

export default async function ContributorAppearancePage() {
  const session = await getSession();
  const contributor = await prisma.contributor.findUnique({
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
          initialTheme={(contributor?.theme ?? "auto") as "auto" | "light" | "dark"}
          apiPath="/api/contributor/appearance"
        />
      </CardContent>
    </Card>
  );
}
