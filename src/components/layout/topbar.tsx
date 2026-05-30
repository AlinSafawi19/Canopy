"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { LogoMark } from "@/components/ui/logo-mark";

interface TopbarProps {
  title?: string;
  onMenuClick?: () => void;
}

export function Topbar({ title, onMenuClick }: TopbarProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 h-14 flex items-center justify-between px-4 sm:px-6 relative">
        <div className="flex items-center gap-3">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          )}
          {title && (
            <h1 className="text-base font-semibold text-slate-900 hidden lg:block">{title}</h1>
          )}
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 lg:hidden">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <LogoMark size={13} className="text-white" />
          </div>
          <span className="text-sm font-semibold tracking-wide text-slate-900">Canopy</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)} className="gap-2">
          <LogOut size={15} />
          Sign out
        </Button>
      </header>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleLogout}
        title="Sign out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign out"
        variant="danger"
        loading={loading}
      />
    </>
  );
}
