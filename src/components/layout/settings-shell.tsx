"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { User, Lock, Mail, Palette } from "lucide-react";

const SETTINGS_NAV = [
  { label: "Profile", segment: "profile", icon: User },
  { label: "Security", segment: "security", icon: Lock },
  { label: "Email", segment: "email", icon: Mail },
  { label: "Appearance", segment: "appearance", icon: Palette },
] as const;

interface SettingsShellProps {
  children: React.ReactNode;
  basePath: string;
  emailVerified?: boolean;
}

export function SettingsShell({ children, basePath, emailVerified }: SettingsShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col md:flex-row gap-6 md:gap-8 md:items-start">
      <aside className="w-full md:w-44 flex-shrink-0 md:self-stretch">
        <nav data-wt="settings-nav" className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible bg-white rounded-xl border border-slate-200 shadow-sm p-2 md:h-full">
          {SETTINGS_NAV.map(({ label, segment, icon: Icon }) => {
            const href = `${basePath}/${segment}`;
            const isActive = pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
            const showBadge = segment === "email" && emailVerified !== undefined;
            return (
              <Link
                key={segment}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex-shrink-0",
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                )}
              >
                <Icon
                  size={16}
                  className={cn(
                    "flex-shrink-0",
                    isActive ? "text-indigo-600" : "text-slate-400"
                  )}
                />
                <span className="flex-1">{label}</span>
                {showBadge && (
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none",
                      emailVerified
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {emailVerified ? "Verified" : "Unverified"}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
