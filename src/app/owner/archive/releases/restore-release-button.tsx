"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";

export function RestoreReleaseButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRestore() {
    setLoading(true);
    await apiFetch(`/api/owner/releases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
    }).catch(() => {});
    setLoading(false);
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" loading={loading} onClick={handleRestore}>
      Restore
    </Button>
  );
}
