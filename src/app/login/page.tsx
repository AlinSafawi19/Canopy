export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Sign In" };
import { getSession, ROLE_HOME } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { LogoMark } from "@/components/ui/logo-mark";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect(ROLE_HOME[session.role]);
  }

  return (
    <div className="min-h-screen bg-slate-50 mk-grid flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-5 sm:mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-600 shadow-lg mb-3 sm:mb-4">
            <LogoMark size={18} className="text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Canopy</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Sign in to manage your content
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-8">
          <LoginForm />
        </div>

        <p className="text-center text-xs text-slate-400 mt-4 sm:mt-6">
          Multi-role content management platform
        </p>
      </div>
    </div>
  );
}
