"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Trash2, Copy, Check } from "lucide-react";



interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface Props {
  projectId: string;
  projectSlug: string | null;
  initialKeys: ApiKey[];
  basePath?: string;
}

function CopyButton({ text, title = "Copy" }: { text: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
      title={title}
    >
      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
    </button>
  );
}

function EndpointRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 w-28 flex-shrink-0">{label}</span>
      <code className="flex-1 text-xs font-mono text-slate-700 truncate">{url}</code>
      <CopyButton text={url} title="Copy URL" />
    </div>
  );
}

export function ApiKeysSection({ projectId, projectSlug, initialKeys, basePath = "/api/admin/projects" }: Props) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string>(initialKeys[0]?.id ?? "");

  const slug = projectSlug ?? projectId;
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`${basePath}/${projectId}/api-keys/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Endpoints */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Endpoints</p>
          {initialKeys.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Key:</span>
              <Select
                value={selectedKeyId}
                onChange={setSelectedKeyId}
                options={initialKeys.map((k) => ({ value: k.id, label: k.name }))}
                size="sm"
                autoWidth
              />
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">Create a key to get test URLs</span>
          )}
        </div>
        <EndpointRow label="All projects" url={`${origin}/api/v1/projects`} />
        <EndpointRow label="This project" url={`${origin}/api/v1/${slug}`} />
        <EndpointRow label="Category data" url={`${origin}/api/v1/${slug}/[category-slug]`} />
      </div>

      {/* Keys table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last Used</TableHead>
            <TableHead className="sticky right-0 bg-slate-50"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {initialKeys.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-slate-400">
                No API keys yet
              </TableCell>
            </TableRow>
          )}
          {initialKeys.map((k) => (
            <TableRow key={k.id}>
              <TableCell className="font-medium text-slate-900">{k.name}</TableCell>
              <TableCell>
                <code className="text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                  {k.keyPrefix}••••••••••••••••••••••••••••••••
                </code>
              </TableCell>
              <TableCell className="text-slate-500 text-sm">
                {new Date(k.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-slate-500 text-sm">
                {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : <Badge variant="default">Never</Badge>}
              </TableCell>
              <TableCell className="sticky right-0 bg-white">
                <button
                  onClick={() => setDeleteTarget(k)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Delete key"
                >
                  <Trash2 size={14} />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete API Key"
        message={`Delete "${deleteTarget?.name}"? Any applications using this key will immediately lose access.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </>
  );
}
