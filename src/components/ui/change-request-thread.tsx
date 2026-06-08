"use client";

import { useEffect, useRef, useState } from "react";
import { Send, MessageSquare } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { formatDateTime } from "@/lib/utils";

interface Comment {
  id: string;
  authorRole: string;
  authorName: string;
  body: string;
  createdAt: string;
}

interface Props {
  requestId: string;
  initialNote: string;
  initialAuthorName: string;
  initialAuthorRole: string;
  initialCreatedAt: string;
  commentsUrl: string;
  readOnly?: boolean;
}

function Bubble({ msg, isClient }: { msg: Comment; isClient: boolean }) {
  return (
    <div className={`flex ${isClient ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-snug ${
          isClient
            ? "bg-amber-50 border border-amber-100 text-amber-900 rounded-tl-sm"
            : "bg-indigo-50 border border-indigo-100 text-indigo-900 rounded-tr-sm"
        }`}
      >
        <p className="break-words whitespace-pre-wrap">{msg.body}</p>
        <p className={`mt-1 text-[9px] ${isClient ? "text-amber-400" : "text-indigo-400"}`}>
          {msg.authorName} · {formatDateTime(msg.createdAt)}
        </p>
      </div>
    </div>
  );
}

export function ChangeRequestThread({
  requestId,
  initialNote,
  initialAuthorName,
  initialAuthorRole,
  initialCreatedAt,
  commentsUrl,
  readOnly = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch(commentsUrl);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments ?? []);
        setLoaded(true);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!expanded) {
      setExpanded(true);
      if (!loaded) load();
    } else {
      setExpanded(false);
    }
  }

  useEffect(() => {
    if (expanded) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    }
  }, [expanded, comments.length]);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const text = body.trim();
    if (!text || posting) return;
    setPosting(true);
    setPostError("");
    const res = await apiFetch(commentsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    setPosting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setPostError(data.error ?? "Failed to post");
      return;
    }
    const data = await res.json();
    setComments((prev) => [...prev, data.comment]);
    setBody("");
    inputRef.current?.focus();
  }

  const initialMsg: Comment = {
    id: `__initial__${requestId}`,
    authorRole: initialAuthorRole,
    authorName: initialAuthorName,
    body: initialNote,
    createdAt: initialCreatedAt,
  };

  const allMessages = [initialMsg, ...comments];
  const replyCount = comments.length;

  return (
    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={handleToggle}
        className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-indigo-500 transition-colors"
      >
        <MessageSquare size={10} />
        {expanded
          ? "Hide thread"
          : loaded
          ? `Thread (${replyCount} repl${replyCount === 1 ? "y" : "ies"})`
          : "Thread"}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {loading ? (
            <div className="flex justify-center py-3">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
            </div>
          ) : (
            <>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                {allMessages.map((msg) => (
                  <Bubble key={msg.id} msg={msg} isClient={msg.authorRole === "client"} />
                ))}
                <div ref={bottomRef} />
              </div>

              {!readOnly && (
                <form
                  onSubmit={handlePost}
                  className="flex gap-1.5"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Reply…"
                    maxLength={2000}
                    disabled={posting}
                    className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300 placeholder-slate-300 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!body.trim() || posting}
                    className="flex-shrink-0 p-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send size={11} />
                  </button>
                </form>
              )}

              {postError && (
                <p className="text-[10px] text-red-500">{postError}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
