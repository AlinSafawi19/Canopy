"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  Users,
  Layers,
  Shield,
  Building2,
  LayoutDashboard,
  FolderKanban,
  UserCog,
  Settings,
  ChevronRight,
  LogOut,
  Code2,
  Archive,
  ScrollText,
  Mail,
} from "lucide-react";
import { LogoMark } from "@/components/ui/logo-mark";
import { type SessionRole } from "@/lib/auth";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: Record<SessionRole, NavItem[]> = {
  owner: [
    { label: "Dashboard", href: "/owner/dashboard", icon: LayoutDashboard },
    { label: "Admins", href: "/owner/admins", icon: UserCog },
  ],
  admin: [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Projects", href: "/admin/projects", icon: FolderKanban },
    { label: "Clients", href: "/admin/clients", icon: Users },
    { label: "Archive", href: "/admin/archive", icon: Archive },
    { label: "Logs", href: "/admin/logs", icon: ScrollText },
    { label: "API Integration", href: "/admin/api-integration", icon: Code2 },
  ],
  client: [
    { label: "Dashboard", href: "/client/dashboard", icon: LayoutDashboard },
    { label: "Projects", href: "/client/projects", icon: FolderKanban },
    { label: "Contributors", href: "/client/contributors", icon: Users },
    { label: "Archive", href: "/client/archive", icon: Archive },
    { label: "Logs", href: "/client/logs", icon: ScrollText },
    { label: "API Integration", href: "/client/api-integration", icon: Code2 },
  ],
  contributor: [
    { label: "Dashboard", href: "/contributor/dashboard", icon: LayoutDashboard },
    { label: "Projects", href: "/contributor/projects", icon: FolderKanban },
    { label: "Archive", href: "/contributor/archive", icon: Archive },
    { label: "Logs", href: "/contributor/logs", icon: ScrollText },
  ],
};

const ROLE_LABELS: Record<SessionRole, string> = {
  owner: "Platform Owner",
  admin: "Admin",
  client: "Client",
  contributor: "Contributor",
};

const ROLE_ICONS: Record<SessionRole, React.ElementType> = {
  owner: Shield,
  admin: Building2,
  client: Users,
  contributor: Layers,
};

const CONTACT_LINES: Partial<Record<SessionRole, string>> = {
  admin: "Issue? Contact the platform owner",
  client: "Issue? Contact your admin",
  contributor: "Issue? Contact your client",
};

interface SidebarProps {
  role: SessionRole;
  displayName: string;
  username: string;
  emailVerified?: boolean;
  navCounts?: Record<string, number>;
  contactEmail?: string;
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ role, displayName, username, emailVerified, navCounts, contactEmail, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navItems = NAV_ITEMS[role];
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  const RoleIcon = ROLE_ICONS[role];
  const settingsActive = pathname?.startsWith(`/${role}/settings`) ?? false;

  return (
    <>
    <aside data-sidebar="main" className={cn(
      "fixed inset-y-0 left-0 z-30 w-64 flex flex-col bg-slate-900 border-r border-slate-800 transition-transform duration-200",
      open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
    )}>
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <LogoMark size={15} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm tracking-wide truncate">Canopy</p>
          <p className="text-slate-400 text-xs truncate">{ROLE_LABELS[role]}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || (pathname?.startsWith(item.href + "/") ?? false);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                isActive
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              )}
            >
              <Icon
                size={18}
                className={cn(
                  "flex-shrink-0",
                  isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"
                )}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {navCounts?.[item.href] !== undefined && (
                <span className={cn(
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none tabular-nums flex-shrink-0",
                  isActive ? "bg-indigo-500 text-indigo-100" : "bg-slate-800 text-slate-400"
                )}>
                  {navCounts[item.href]}
                </span>
              )}
              {isActive && (
                <ChevronRight size={14} className="text-indigo-300 flex-shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User info + settings */}
      <div className="px-3 py-4 border-t border-slate-800 space-y-0.5">
        <Link
          href={`/${role}/settings`}
          onClick={onClose}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
            settingsActive
              ? "bg-indigo-600 text-white"
              : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          )}
        >
          <Settings
            size={18}
            className={cn(
              "flex-shrink-0",
              settingsActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"
            )}
          />
          <span className="flex-1">Settings</span>
          {emailVerified === false && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none bg-amber-100 text-amber-700 flex-shrink-0">
              Email Unverified
            </span>
          )}
          {settingsActive && (
            <ChevronRight size={14} className="text-indigo-300 flex-shrink-0" />
          )}
        </Link>

        <button
          onClick={() => { setConfirmOpen(true); onClose?.(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all duration-150 group"
        >
          <LogOut size={18} className="flex-shrink-0 text-slate-500 group-hover:text-slate-300" />
          <span>Sign out</span>
        </button>

        <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <RoleIcon size={13} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-medium truncate">{displayName}</p>
            <p className="text-slate-500 text-xs truncate">@{username}</p>
          </div>
        </div>
      </div>

      {contactEmail && CONTACT_LINES[role] && (
        <div className="px-4 py-3 border-t border-slate-800">
          <p className="text-[10px] text-slate-600 mb-1">{CONTACT_LINES[role]}</p>
          <a
            href={`mailto:${contactEmail}`}
            className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Mail size={11} className="flex-shrink-0" />
            <span className="truncate">{contactEmail}</span>
          </a>
        </div>
      )}

    </aside>

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
