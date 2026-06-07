"use client";

import { useState } from "react";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { NavigationLoader } from "./navigation-loader";
import { type SessionRole } from "@/lib/auth";
import { WalkthroughOverlay } from "@/components/walkthrough/walkthrough-overlay";
import { ReleasePopup } from "@/components/layout/release-popup";

interface PendingRelease {
  id: string;
  version: string;
  title: string;
  notes: string;
}

interface AppShellProps {
  children: React.ReactNode;
  role: SessionRole;
  displayName: string;
  username: string;
  pageTitle?: string;
  emailVerified?: boolean;
  navCounts?: Record<string, number>;
  contactEmail?: string;
  walkthroughActive?: boolean;
  pendingRelease?: PendingRelease | null;
  pendingRequestsCount?: number;
}

export function AppShell({
  children,
  role,
  displayName,
  username,
  pageTitle,
  emailVerified,
  navCounts,
  contactEmail,
  walkthroughActive,
  pendingRelease,
  pendingRequestsCount = 0,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  useScrollLock(mobileOpen);

  return (
    <div className="min-h-screen bg-slate-50">
      <NavigationLoader />

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile unless open */}
      <Sidebar role={role} displayName={displayName} username={username} emailVerified={emailVerified} navCounts={navCounts} contactEmail={contactEmail} open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main area */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <Topbar
          title={pageTitle}
          onMenuClick={() => setMobileOpen((v) => !v)}
          pendingRequestsCount={pendingRequestsCount}
          role={role}
        />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>

      {/* Walkthrough overlay — mounted inside the shell so it sits over the real app */}
      {walkthroughActive && <WalkthroughOverlay role={role} />}

      {/* Release popup — shown once per release until acknowledged */}
      {!walkthroughActive && pendingRelease && <ReleasePopup release={pendingRelease} />}
    </div>
  );
}
