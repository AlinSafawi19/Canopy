"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Folder, Layers, FileText, type LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = { Folder, Layers, FileText };

export interface TabShellNavItem {
  label: string;
  segment: string;
  icon: string;
  count?: number;
}

interface TabShellProps {
  children: React.ReactNode;
  basePath: string;
  navItems: TabShellNavItem[];
}

export function TabShell({ children, basePath, navItems }: TabShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col md:flex-row gap-6 md:gap-8 md:items-start">
      <aside className="w-full md:w-44 flex-shrink-0 md:self-stretch">
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible bg-white rounded-xl border border-slate-200 shadow-sm p-2 md:h-full">
          {navItems.map(({ label, segment, icon, count }) => {
            const Icon = ICON_MAP[icon] ?? Folder;
            const href = `${basePath}/${segment}`;
            const isActive = pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
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
                {count !== undefined && (
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none",
                      isActive
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {count}
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
