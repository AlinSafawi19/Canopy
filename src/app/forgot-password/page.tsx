import type { Metadata } from "next";
import { LogoMark } from "@/components/ui/logo-mark";

export const metadata: Metadata = { title: "Forgot Password" };
import { ForgotForm } from "./forgot-form";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-50 mk-grid flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 shadow-lg mb-4">
            <LogoMark size={20} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Canopy</h1>
          <p className="text-slate-500 text-sm mt-1">Reset your password</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-5">Forgot password?</h2>
          <ForgotForm />
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Multi-role content management platform
        </p>
      </div>
    </div>
  );
}
