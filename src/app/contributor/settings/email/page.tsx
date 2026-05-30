import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailVerificationForm } from "@/components/settings/email-verification-form";

export default async function ContributorEmailPage() {
  const session = await getSession();
  const contributor = await prisma.contributor.findUnique({
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
          email={contributor!.email}
          emailVerified={!!contributor!.emailVerifiedAt}
        />
      </CardContent>
    </Card>
  );
}
