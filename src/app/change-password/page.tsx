import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/ui/logo-mark";

export const metadata: Metadata = { title: "Change Password" };
import { getSession, ROLE_HOME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id, role } = session!;
  if (!role || !(role in ROLE_HOME)) redirect("/login");

  let emailVerified = true;

  if (role === "owner") {
    const u = await prisma.platformOwner.findUnique({ where: { id }, select: { emailVerifiedAt: true } });
    emailVerified = !!u?.emailVerifiedAt;
  } else if (role === "admin") {
    const u = await prisma.adminIdentity.findUnique({ where: { id }, select: { emailVerifiedAt: true } });
    emailVerified = !!u?.emailVerifiedAt;
  } else if (role === "client") {
    const u = await prisma.clientIdentity.findUnique({ where: { id }, select: { emailVerifiedAt: true } });
    emailVerified = !!u?.emailVerifiedAt;
  } else if (role === "contributor") {
    const u = await prisma.contributor.findUnique({ where: { id }, select: { emailVerifiedAt: true } });
    emailVerified = !!u?.emailVerifiedAt;
  }

  const nextHref = emailVerified ? (ROLE_HOME[role] ?? "/") : "/verify-email-notice";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 shadow-lg mb-4">
            <LogoMark size={20} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Canopy</h1>
          <p className="text-slate-500 text-sm mt-1">Set your password</p>
        </div>

        <ChangePasswordForm nextHref={nextHref} />

        <p className="text-center text-xs text-slate-400 mt-6">
          Multi-role content management platform
        </p>
      </div>
    </div>
  );
}
