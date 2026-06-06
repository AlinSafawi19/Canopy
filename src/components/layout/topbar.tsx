"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Menu, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { LogoMark } from "@/components/ui/logo-mark";
import { timeAgo } from "@/lib/utils";
import type { SessionRole } from "@/lib/auth";

interface PendingRequest {
  id: string;
  note: string;
  authorName: string;
  createdAt: string;
  projectId: string;
  projectName: string;
  categoryId: string;
  categoryName: string;
}

function RequestsButton({ count, role }: { count: number; role: SessionRole }) {
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [total, setTotal] = useState(count);
  const [fetching, setFetching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (requests.length > 0) return;
    setFetching(true);
    try {
      const res = await apiFetch("/api/change-requests");
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setFetching(false);
    }
  }

  const base =
    role === "admin" ? "/admin"
    : role === "contributor" ? "/contributor"
    : "/client";

  const title = role === "client" ? "My Requests" : "Pending Requests";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        title={title}
        className="relative p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
      >
        <MessageSquare size={18} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-0.5 items-center justify-center rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            {total > 0 && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                {total} open
              </span>
            )}
          </div>

          {fetching ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-400">No pending requests</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {requests.map((req) => (
                <Link
                  key={req.id}
                  href={`${base}/projects/${req.projectId}/categories/${req.categoryId}`}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <p className="text-sm text-slate-800 leading-snug line-clamp-2">{req.note}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {req.projectName} · {req.categoryName}
                    {role !== "client" && <> · {req.authorName}</>}
                    {" · "}{timeAgo(req.createdAt)}
                  </p>
                </Link>
              ))}
            </div>
          )}

          {total > 10 && !fetching && (
            <div className="px-4 py-2.5 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400">{total - 10} more not shown</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TopbarProps {
  title?: string;
  onMenuClick?: () => void;
  pendingRequestsCount?: number;
  role?: SessionRole;
}

export function Topbar({ title, onMenuClick, pendingRequestsCount = 0, role }: TopbarProps) {
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
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <LogoMark size={13} className="text-white" />
            </div>
            <span className="text-sm font-semibold tracking-wide text-slate-900">Canopy</span>
          </div>
          {title && (
            <h1 className="text-base font-semibold text-slate-900 hidden lg:block">{title}</h1>
          )}
        </div>

        <div className="flex items-center gap-1">
          {role && (role === "admin" || role === "client" || role === "contributor") && (
            <RequestsButton count={pendingRequestsCount} role={role} />
          )}
          <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)} className="gap-2">
            <LogOut size={16} />
            Sign out
          </Button>
        </div>
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
