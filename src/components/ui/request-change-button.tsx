"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { Modal, ModalRef } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChangeRequestThread } from "@/components/ui/change-request-thread";
import { formatDateTime } from "@/lib/utils";

interface ChangeRequest {
  id: string;
  note: string;
  authorName: string;
  authorRole: string;
  resolvedAt: string | null;
  resolvedByName: string | null;
  createdAt: string;
}

interface Props {
  entryId: string;
  projectId: string;
  categoryId: string;
  apiBase: string;
  openCount: number;
}

export function RequestChangeButton({ entryId, projectId, categoryId, apiBase, openCount }: Props) {
  const router = useRouter();
  const modalRef    = useRef<ModalRef>(null);
  const inFlight    = useRef(false);           // ref guard — synchronous, unlike state
  const [open, setOpen]           = useState(false);
  const [requests, setRequests]   = useState<ChangeRequest[]>([]);
  const [fetching, setFetching]   = useState(false);
  const [note, setNote]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState("");

  const baseUrl = `${apiBase}/${projectId}/categories/${categoryId}/entries/${entryId}/change-requests`;

  async function handleOpen() {
    setOpen(true);
    setFetching(true);
    try {
      const res = await apiFetch(baseUrl);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests ?? []);
      }
    } finally {
      setFetching(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;   // drop duplicate submissions
    inFlight.current = true;
    setSubmitting(true);
    setError("");
    const res = await apiFetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setSubmitting(false);
    inFlight.current = false;
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to submit request");
      return;
    }
    setNote("");
    setOpen(false);
    router.refresh();
  }

  const openRequests     = requests.filter((r) => !r.resolvedAt);
  const resolvedRequests = requests.filter((r) => !!r.resolvedAt);

  return (
    <>
      <button
        onClick={handleOpen}
        title="Request a change to this entry"
        className="relative inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 rounded transition-colors"
      >
        <MessageSquarePlus size={12} />
        <span className="hidden sm:inline">Request</span>
        {openCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none">
            {openCount > 9 ? "9+" : openCount}
          </span>
        )}
      </button>

      <Modal
        ref={modalRef}
        open={open}
        onClose={() => { setOpen(false); setNote(""); setError(""); }}
        title="Request Change"
        busy={submitting}
        footer={
          !fetching ? (
            <div className="flex justify-end gap-3">
              <Button variant="outline" type="button" onClick={() => modalRef.current?.attemptClose()}>
                Cancel
              </Button>
              <Button type="submit" form="request-change-form" loading={submitting} disabled={!note.trim()}>
                Submit Request
              </Button>
            </div>
          ) : undefined
        }
      >
        {fetching ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            {openRequests.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Pending
                </p>
                <div className="divide-y divide-slate-100">
                  {openRequests.map((req) => (
                    <div key={req.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-sm text-slate-800 leading-snug">{req.note}</p>
                      <p className="text-xs text-slate-400 mt-1">{formatDateTime(req.createdAt)}</p>
                      <ChangeRequestThread
                        requestId={req.id}
                        initialNote={req.note}
                        initialAuthorName={req.authorName}
                        initialAuthorRole={req.authorRole ?? "client"}
                        initialCreatedAt={req.createdAt}
                        commentsUrl={`${baseUrl}/${req.id}/comments`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resolvedRequests.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Resolved
                </p>
                <div className="divide-y divide-slate-100">
                  {resolvedRequests.map((req) => (
                    <div key={req.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-sm text-slate-400 leading-snug line-through">{req.note}</p>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <CheckCircle2 size={11} className="text-emerald-500 flex-shrink-0" />
                        {req.resolvedByName
                          ? <><span className="text-emerald-600 font-medium">{req.resolvedByName}</span>{" resolved · "}{formatDateTime(req.resolvedAt!)}</>
                          : formatDateTime(req.resolvedAt!)}
                      </p>
                      <ChangeRequestThread
                        requestId={req.id}
                        initialNote={req.note}
                        initialAuthorName={req.authorName}
                        initialAuthorRole={req.authorRole ?? "client"}
                        initialCreatedAt={req.createdAt}
                        commentsUrl={`${baseUrl}/${req.id}/comments`}
                        readOnly
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form id="request-change-form" onSubmit={handleSubmit} className="space-y-3">
              {(openRequests.length > 0 || resolvedRequests.length > 0) && (
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  New Request
                </p>
              )}
              <Textarea
                label="Describe what needs to change"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={1000}
              />
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </form>
          </div>
        )}
      </Modal>
    </>
  );
}
