import { redirect } from "next/navigation";
import { ShieldCheck, KeyRound, Smartphone } from "lucide-react";
import { LogoMark } from "@/components/ui/logo-mark";
import { getSession, ROLE_HOME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReminderActions } from "./reminder-actions";

const SECURITY_URL: Record<string, string> = {
  owner: "/owner/settings/security",
  admin: "/admin/settings/security",
  client: "/client/settings/security",
  contributor: "/contributor/settings/security",
};

export default async function TwoFactorReminderPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id, role } = session;
  let mustChangePassword = false;
  let emailVerified = true;
  let walkthroughSeen = false;

  if (role === "owner") {
    const u = await prisma.platformOwner.findUnique({ where: { id }, select: { mustChangePassword: true, emailVerifiedAt: true, walkthroughSeenAt: true } });
    mustChangePassword = !!u?.mustChangePassword;
    emailVerified = !!u?.emailVerifiedAt;
    walkthroughSeen = !!u?.walkthroughSeenAt;
  } else if (role === "admin") {
    const u = await prisma.adminIdentity.findUnique({ where: { id }, select: { mustChangePassword: true, emailVerifiedAt: true, walkthroughSeenAt: true } });
    mustChangePassword = !!u?.mustChangePassword;
    emailVerified = !!u?.emailVerifiedAt;
    walkthroughSeen = !!u?.walkthroughSeenAt;
  } else if (role === "client") {
    const u = await prisma.clientIdentity.findUnique({ where: { id }, select: { mustChangePassword: true, emailVerifiedAt: true, walkthroughSeenAt: true } });
    mustChangePassword = !!u?.mustChangePassword;
    emailVerified = !!u?.emailVerifiedAt;
    walkthroughSeen = !!u?.walkthroughSeenAt;
  } else if (role === "contributor") {
    const u = await prisma.contributor.findUnique({ where: { id }, select: { mustChangePassword: true, emailVerifiedAt: true, walkthroughSeenAt: true } });
    mustChangePassword = !!u?.mustChangePassword;
    emailVerified = !!u?.emailVerifiedAt;
    walkthroughSeen = !!u?.walkthroughSeenAt;
  }

  const nextHref = mustChangePassword
    ? "/change-password"
    : !emailVerified
    ? "/verify-email-notice"
    : !walkthroughSeen
    ? "/walkthrough"
    : ROLE_HOME[role];

  const securityHref = SECURITY_URL[role];

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 shadow-lg mb-4">
            <LogoMark size={20} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Canopy</h1>
          <p className="text-slate-500 text-sm mt-1">Account security</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
              <ShieldCheck size={32} className="text-amber-500" />
            </div>
          </div>

          <h2 className="text-xl font-semibold text-slate-900 text-center mb-2">
            Your account needs one more layer
          </h2>
          <p className="text-slate-500 text-sm text-center mb-1">
            Two-factor authentication (2FA) means every login requires both your password <em>and</em> a short code from your phone.
          </p>
          <p className="text-slate-400 text-xs text-center mb-6">
            Most account breaches happen because of stolen or reused passwords. 2FA makes a stolen password useless on its own.
          </p>

          <div className="space-y-3 mb-6 bg-slate-50 border border-slate-100 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <KeyRound size={13} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">Stops stolen passwords cold</p>
                <p className="text-xs text-slate-500">Even if an attacker has your password, they still can&apos;t log in without your device.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Smartphone size={13} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">Takes less than a minute to set up</p>
                <p className="text-xs text-slate-500">Open Google Authenticator, Authy, or 1Password, scan a QR code, and you&apos;re done.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <ShieldCheck size={13} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">Never locked out permanently</p>
                <p className="text-xs text-slate-500">You get 10 one-time backup codes to keep somewhere safe in case you lose your phone.</p>
              </div>
            </div>
          </div>

          <ReminderActions nextHref={nextHref} securityHref={securityHref} />
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Multi-role content management platform
        </p>
      </div>
    </div>
  );
}
