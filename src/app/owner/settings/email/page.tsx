import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailVerificationForm } from "@/components/settings/email-verification-form";

export default async function OwnerEmailPage() {
  const session = await getSession();
  const owner = await prisma.platformOwner.findUnique({
    where: { id: session!.id },
    select: { email: true, emailVerifiedAt: true },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Verification</CardTitle>
      </CardHeader>
      <CardContent>
        <EmailVerificationForm
          email={owner!.email}
          emailVerified={!!owner!.emailVerifiedAt}
        />
      </CardContent>
    </Card>
  );
}
