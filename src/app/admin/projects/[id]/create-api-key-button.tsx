"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Check, Copy } from "lucide-react";
import { LIMITS } from "@/lib/limits";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-slate-400 hover:text-slate-300 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
    </button>
  );
}

export function CreateApiKeyButton({ projectId, basePath = "/api/admin/projects" }: { projectId: string; basePath?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`${basePath}/${projectId}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create key"); return; }
      setCreatedKey(data.key);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setName("");
    setError("");
    if (createdKey) {
      setCreatedKey(null);
      router.refresh();
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        New Key
      </Button>
      <Modal open={open} onClose={handleClose} title="Create API Key" size="sm" busy={loading}>
        {createdKey ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <Check size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-700">Key created — copy it now. It won&apos;t be shown again.</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Your new API key</p>
              <div className="flex items-center gap-2 p-3 bg-slate-900 rounded-lg">
                <code className="flex-1 text-xs font-mono text-emerald-400 break-all">{createdKey}</code>
                <CopyButton text={createdKey} />
              </div>
            </div>
            <Button className="w-full" onClick={handleClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Key Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="e.g. Production, Portfolio Site"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
                maxLength={LIMITS.API_KEY_NAME}
              />
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose} disabled={loading}>Cancel</Button>
              <Button onClick={handleCreate} loading={loading}>Create Key</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
