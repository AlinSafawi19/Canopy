"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ReminderActions({
  nextHref,
  securityHref,
}: {
  nextHref: string;
  securityHref: string;
}) {
  const router = useRouter();
  const [neverLoading, setNeverLoading] = useState(false);

  async function handleNeverShow() {
    setNeverLoading(true);
    await apiFetch("/api/auth/2fa-reminder/dismiss", { method: "POST" });
    router.push(nextHref);
  }

  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={() => router.push(securityHref)}>
        Enable 2FA now
      </Button>
      <Button variant="outline" className="w-full" onClick={() => router.push(nextHref)}>
        Skip for now
      </Button>
      <button
        onClick={handleNeverShow}
        disabled={neverLoading}
        className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50 py-1"
      >
        {neverLoading ? "Saving..." : "Don't show this again"}
      </button>
    </div>
  );
}
