import type { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = { title: "Two-Factor Authentication" };
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/ui/logo-mark";
import { verifyToken } from "@/lib/auth";
import { TwoFactorForm } from "./two-factor-form";

export default async function TwoFactorPage() {
  const cookieStore = await cookies();
  const pendingToken = cookieStore.get("cms_2fa_pending")?.value;

  if (!pendingToken) redirect("/login");

  const session = await verifyToken(pendingToken);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50 mk-grid flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-5 sm:mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-600 shadow-lg mb-3 sm:mb-4">
            <LogoMark size={18} className="text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Canopy</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">Two-factor authentication</p>
        </div>

        <TwoFactorForm displayName={session.displayName} />

        <p className="text-center text-xs text-slate-400 mt-4 sm:mt-6">
          Multi-role content management platform
        </p>
      </div>
    </div>
  );
}
