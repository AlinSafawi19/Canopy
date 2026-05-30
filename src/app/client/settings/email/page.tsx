import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailVerificationForm } from "@/components/settings/email-verification-form";

export default async function ClientEmailPage() {
  const session = await getSession();
  const client = await prisma.clientIdentity.findUnique({
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
          email={client!.email}
          emailVerified={!!client!.emailVerifiedAt}
        />
      </CardContent>
    </Card>
  );
}
