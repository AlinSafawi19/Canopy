import { redirect } from "next/navigation";
import { LogoMark } from "@/components/ui/logo-mark";
import { getSession, ROLE_HOME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VerifyNoticeClient } from "./verify-notice-client";

export default async function VerifyEmailNoticePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id, role } = session;
  let email = "";
  let alreadyVerified = false;
  let walkthroughSeen = false;

  if (role === "owner") {
    const u = await prisma.platformOwner.findUnique({
      where: { id },
      select: { email: true, emailVerifiedAt: true, walkthroughSeenAt: true },
    });
    alreadyVerified = !!u?.emailVerifiedAt;
    walkthroughSeen = !!u?.walkthroughSeenAt;
    email = u?.email ?? "";
  } else if (role === "admin") {
    const u = await prisma.adminIdentity.findUnique({
      where: { id },
      select: { email: true, emailVerifiedAt: true, walkthroughSeenAt: true },
    });
    alreadyVerified = !!u?.emailVerifiedAt;
    walkthroughSeen = !!u?.walkthroughSeenAt;
    email = u?.email ?? "";
  } else if (role === "client") {
    const u = await prisma.clientIdentity.findUnique({
      where: { id },
      select: { email: true, emailVerifiedAt: true, walkthroughSeenAt: true },
    });
    alreadyVerified = !!u?.emailVerifiedAt;
    walkthroughSeen = !!u?.walkthroughSeenAt;
    email = u?.email ?? "";
  } else if (role === "contributor") {
    const u = await prisma.contributor.findUnique({
      where: { id },
      select: { email: true, emailVerifiedAt: true, walkthroughSeenAt: true },
    });
    alreadyVerified = !!u?.emailVerifiedAt;
    walkthroughSeen = !!u?.walkthroughSeenAt;
    email = u?.email ?? "";
  }

  const nextHref = !walkthroughSeen ? "/walkthrough" : ROLE_HOME[role];

  if (alreadyVerified) redirect(nextHref);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 shadow-lg mb-4">
            <LogoMark size={20} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Canopy</h1>
          <p className="text-slate-500 text-sm mt-1">Email verification</p>
        </div>

        <VerifyNoticeClient email={email} nextHref={nextHref} />

        <p className="text-center text-xs text-slate-400 mt-6">
          Multi-role content management platform
        </p>
      </div>
    </div>
  );
}
