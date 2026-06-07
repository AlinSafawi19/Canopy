"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Plus, X, ChevronRight, ChevronDown, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CategoryInfo { name: string; slug: string }
interface ProjectInfo  { id: string; name: string; slug: string; categories: CategoryInfo[] }

interface Props {
  projects: ProjectInfo[];
}

interface KV { id: number; on: boolean; key: string; value: string }

interface ResponseData {
  status: number;
  statusText: string;
  time: number;
  size: number;
  body: string;
  headers: [string, string][];
}

type RequestTab  = "params" | "headers" | "auth" | "curl";
type ResponseTab = "body" | "headers";

// ── helpers ────────────────────────────────────────────────
let _id = 0;
const nextId = () => ++_id;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function prettyJson(raw: string): { text: string; ok: boolean } {
  try { return { text: JSON.stringify(JSON.parse(raw), null, 2), ok: true }; }
  catch { return { text: raw, ok: false }; }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Token-colour a pretty-printed JSON string into safe HTML. */
function highlightJson(raw: string): string {
  const { text, ok } = prettyJson(raw);
  const escaped = escapeHtml(text);
  if (!ok) return escaped;
  return escaped.replace(
    /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false)\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      let cls = "text-emerald-300";                       // number
      if (/^"/.test(m)) cls = /:$/.test(m) ? "text-sky-300" : "text-amber-300"; // key : string
      else if (/^(true|false)$/.test(m)) cls = "text-fuchsia-300";
      else if (m === "null") cls = "text-slate-500";
      return `<span class="${cls}">${m}</span>`;
    }
  );
}

function buildQuery(params: KV[]): string {
  const usp = new URLSearchParams();
  for (const p of params) if (p.on && p.key.trim()) usp.append(p.key.trim(), p.value);
  return usp.toString();
}

// ── component ──────────────────────────────────────────────
export function ApiPlayground({ projects }: Props) {
  const firstProject  = projects[0];
  const firstCategory = firstProject?.categories[0];

  const [path, setPath] = useState<string>(
    firstProject && firstCategory
      ? `/api/v1/${firstProject.slug}/${firstCategory.slug}`
      : firstProject
      ? `/api/v1/${firstProject.slug}`
      : `/api/v1/projects`
  );
  const [params, setParams] = useState<KV[]>(
    firstCategory || !firstProject
      ? [
          { id: nextId(), on: true, key: "page",  value: "1" },
          { id: nextId(), on: true, key: "limit", value: "20" },
        ]
      : []
  );
  const [headers, setHeaders] = useState<KV[]>([]);
  const [apiKey, setApiKey]   = useState("");
  const [showKey, setShowKey] = useState(false);

  const [reqTab, setReqTab]   = useState<RequestTab>("params");
  const [resTab, setResTab]   = useState<ResponseTab>("body");

  const [origin, setOrigin]   = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<ResponseData | null>(null);
  const [error, setError]     = useState("");

  // collection dropdown
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [dropLeft, setDropLeft] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const collectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setOrigin(window.location.origin); }, []);

  useEffect(() => {
    if (!collectionOpen) return;
    function handler(e: MouseEvent) {
      if (!collectionRef.current?.contains(e.target as Node)) setCollectionOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [collectionOpen]);

  const query    = buildQuery(params);
  const fullPath = query ? `${path}?${query}` : path;
  const fullUrl  = origin + fullPath;

  // Parse a pasted/edited URL back into path + param rows
  function onUrlEdit(value: string) {
    let rest = value.trim();
    if (origin && rest.startsWith(origin)) rest = rest.slice(origin.length);
    rest = rest.replace(/^https?:\/\/[^/]+/i, ""); // strip any other origin
    const [p, qs = ""] = rest.split("?");
    setPath(p || "/");
    if (qs) {
      const usp = new URLSearchParams(qs);
      const rows: KV[] = [];
      usp.forEach((v, k) => rows.push({ id: nextId(), on: true, key: k, value: v }));
      setParams(rows);
    } else {
      setParams([]);
    }
  }

  const enabledHeaders = useMemo(
    () => headers.filter((h) => h.on && h.key.trim()),
    [headers]
  );

  const curl = useMemo(() => {
    const lines = [`curl '${fullUrl || fullPath}'`];
    if (apiKey.trim()) lines.push(`  -H 'Authorization: Bearer ${apiKey.trim()}'`);
    for (const h of enabledHeaders) lines.push(`  -H '${h.key.trim()}: ${h.value}'`);
    return lines.join(" \\\n");
  }, [fullUrl, fullPath, apiKey, enabledHeaders]);

  async function send() {
    setError("");
    if (!apiKey.trim()) { setError("An API key is required. Add it in the Authorization tab."); setReqTab("auth"); return; }

    setLoading(true);
    setResult(null);
    const started = performance.now();
    try {
      const h: Record<string, string> = { Authorization: `Bearer ${apiKey.trim()}` };
      for (const eh of enabledHeaders) h[eh.key.trim()] = eh.value;

      const res  = await fetch(fullPath, { headers: h });
      const text = await res.text();
      const elapsed = Math.round(performance.now() - started);

      setResult({
        status: res.status,
        statusText: res.statusText || "",
        time: elapsed,
        size: new Blob([text]).size,
        body: text,
        headers: [...res.headers.entries()],
      });
      setResTab("body");
    } catch {
      setError("Network error — could not reach the API.");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); send(); }
  }

  // scaffold helpers
  function loadEndpoint(p: string, withPaging: boolean) {
    setPath(p);
    setParams(withPaging
      ? [
          { id: nextId(), on: true, key: "page",  value: "1" },
          { id: nextId(), on: true, key: "limit", value: "20" },
        ]
      : []);
    setCollectionOpen(false);
  }

  const statusClass = !result ? ""
    : result.status < 300 ? "bg-emerald-50 border-emerald-200 text-emerald-700"
    : result.status < 400 ? "bg-sky-50 border-sky-200 text-sky-700"
    : result.status < 500 ? "bg-amber-50 border-amber-200 text-amber-700"
    : "bg-red-50 border-red-200 text-red-700";

  const enabledParamCount = params.filter((p) => p.on && p.key.trim()).length;

  return (
    <Card className="overflow-visible">
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>API Playground</CardTitle>
            <p className="text-sm text-slate-500 mt-0.5">
              Compose and send live requests to your Content API. Press{" "}
              <kbd className="px-1 py-0.5 text-[11px] bg-slate-100 border border-slate-200 rounded font-mono">⌘↵</kbd> to send.
            </p>
          </div>

          {/* Collection / endpoint browser */}
          <div className="relative" ref={collectionRef}>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                if (!collectionOpen && collectionRef.current) {
                  const rect = collectionRef.current.getBoundingClientRect();
                  setDropLeft(rect.right + 288 > window.innerWidth);
                }
                setCollectionOpen((v) => !v);
              }}>
              <FolderTree size={14} />
              Endpoints
              <ChevronDown size={13} className={collectionOpen ? "rotate-180 transition-transform" : "transition-transform"} />
            </Button>

            {collectionOpen && (
              <div className={`absolute ${dropLeft ? "right-0" : "left-0"} top-full mt-1 w-72 max-h-96 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-1.5`}>
                <button
                  onClick={() => loadEndpoint("/api/v1/projects", true)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="text-[10px] font-bold text-emerald-600 w-7">GET</span>
                  <code className="text-xs font-mono text-slate-700">/projects</code>
                </button>

                {projects.length === 0 && (
                  <p className="px-2.5 py-3 text-xs text-slate-400 text-center">No projects with a slug yet</p>
                )}

                {projects.map((proj) => {
                  const isOpen = expanded[proj.id] ?? false;
                  return (
                    <div key={proj.id}>
                      <div className="flex items-center">
                        <button
                          onClick={() => setExpanded((e) => ({ ...e, [proj.id]: !isOpen }))}
                          className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                        <button
                          onClick={() => loadEndpoint(`/api/v1/${proj.slug}`, false)}
                          className="flex-1 flex items-center gap-2 px-1.5 py-1.5 rounded-lg text-left hover:bg-slate-50 transition-colors min-w-0"
                          title={`GET /${proj.slug}`}
                        >
                          <span className="text-[10px] font-bold text-emerald-600 w-7 flex-shrink-0">GET</span>
                          <span className="text-xs font-medium text-slate-700 truncate">{proj.name}</span>
                        </button>
                      </div>
                      {isOpen && (
                        <div className="ml-5 border-l border-slate-100 pl-1">
                          {proj.categories.length === 0 ? (
                            <p className="px-2.5 py-1.5 text-[11px] text-slate-400">No categories with a slug</p>
                          ) : proj.categories.map((cat) => (
                            <button
                              key={cat.slug}
                              onClick={() => loadEndpoint(`/api/v1/${proj.slug}/${cat.slug}`, true)}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-slate-50 transition-colors min-w-0"
                              title={`GET /${proj.slug}/${cat.slug}`}
                            >
                              <span className="text-[10px] font-bold text-emerald-600 w-7 flex-shrink-0">GET</span>
                              <code className="text-xs font-mono text-slate-600 truncate">/{cat.slug}</code>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div onKeyDown={onKeyDown}>
          {/* ── Request bar ── */}
          <div className="flex items-stretch gap-2 px-4 sm:px-6 pb-4">
            <div className="flex flex-1 items-stretch rounded-lg border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent">
              <span className="flex items-center px-3 bg-slate-50 border-r border-slate-300 text-xs font-bold text-emerald-600 select-none">
                GET
              </span>
              <input
                value={fullUrl}
                onChange={(e) => onUrlEdit(e.target.value)}
                spellCheck={false}
                placeholder={`${origin}/api/v1/...`}
                className="flex-1 min-w-0 px-3 py-2 text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              <div className="flex items-center pr-1">
                <CopyButton text={fullUrl} />
              </div>
            </div>
            <Button onClick={send} loading={loading} disabled={loading} className="gap-1.5 px-5">
              <Send size={14} />
              Send
            </Button>
          </div>

          {/* ── Request config tabs ── */}
          <div className="border-t border-slate-100">
            <div className="flex items-center gap-0 px-4 sm:px-6 border-b border-slate-100">
              {([
                ["params",  "Params",  enabledParamCount],
                ["headers", "Headers", enabledHeaders.length],
                ["auth",    "Auth",    apiKey.trim() ? "•" : 0],
                ["curl",    "cURL",    0],
              ] as [RequestTab, string, number | string][]).map(([tab, label, count]) => (
                <button
                  key={tab}
                  onClick={() => setReqTab(tab)}
                  className={`relative px-3 py-2.5 text-sm font-medium transition-colors ${
                    reqTab === tab ? "text-indigo-600" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {label}
                    {count !== 0 && count !== "0" && (
                      <span className="text-[10px] font-bold px-1.5 py-px rounded-full bg-slate-100 text-slate-500 leading-none">
                        {count}
                      </span>
                    )}
                  </span>
                  {reqTab === tab && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                </button>
              ))}
            </div>

            <div className="px-4 sm:px-6 py-4 min-h-[140px]">
              {reqTab === "params" && (
                <KeyValueEditor rows={params} setRows={setParams} keyPlaceholder="parameter" addLabel="Add query parameter" />
              )}
              {reqTab === "headers" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <span className="font-mono text-slate-400">Authorization: Bearer •••</span>
                    <span>is added automatically from the Auth tab.</span>
                  </div>
                  <KeyValueEditor rows={headers} setRows={setHeaders} keyPlaceholder="header" addLabel="Add header" />
                </div>
              )}
              {reqTab === "auth" && (
                <div className="max-w-md space-y-2">
                  <label className="text-sm font-medium text-slate-700">Bearer Token</label>
                  <div className="flex items-center rounded-lg border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent">
                    <span className="px-3 py-2 text-xs font-mono text-slate-400 bg-slate-50 border-r border-slate-300 select-none">Bearer</span>
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      spellCheck={false}
                      placeholder="cms_xxxxxxxxxxxx"
                      className="flex-1 min-w-0 px-3 py-2 text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((s) => !s)}
                      className="px-3 text-xs font-medium text-slate-400 hover:text-slate-600"
                    >
                      {showKey ? "Hide" : "Show"}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    Create keys in each project&apos;s <span className="font-medium text-slate-500">Public API</span> section. Sent as <code className="font-mono">Authorization: Bearer &lt;token&gt;</code>.
                  </p>
                </div>
              )}
              {reqTab === "curl" && (
                <div className="relative group">
                  <pre className="bg-slate-900 rounded-lg p-4 pr-14 overflow-x-auto text-xs font-mono leading-relaxed text-slate-100 whitespace-pre">
                    {curl}
                  </pre>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <CopyButton text={curl} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="px-4 sm:px-6 pb-4">
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            </div>
          )}

          {/* ── Response ── */}
          {(loading || result) && (
            <div className="border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Response</span>
                  {result && (
                    <>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusClass}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {result.status}{result.statusText ? ` ${result.statusText}` : ""}
                      </span>
                      <span className="text-xs text-slate-400">{result.time} ms</span>
                      <span className="text-xs text-slate-400">{formatBytes(result.size)}</span>
                    </>
                  )}
                </div>

                {result && (
                  <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
                    {(["body", "headers"] as ResponseTab[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setResTab(t)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                          resTab === t ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {t}{t === "headers" ? ` (${result.headers.length})` : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-4 sm:px-6 pb-5">
                {loading ? (
                  <div className="flex items-center justify-center py-12 bg-slate-900 rounded-lg">
                    <div className="w-5 h-5 rounded-full border-2 border-slate-700 border-t-indigo-400 animate-spin" />
                  </div>
                ) : result && resTab === "body" ? (
                  <div className="relative group">
                    <pre className="bg-slate-900 rounded-lg p-4 overflow-auto max-h-[28rem] text-xs font-mono leading-relaxed text-slate-100">
                      <code dangerouslySetInnerHTML={{ __html: highlightJson(result.body) }} />
                    </pre>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <CopyButton text={result.body} />
                    </div>
                  </div>
                ) : result ? (
                  <div className="rounded-lg border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
                    {result.headers.map(([k, v]) => (
                      <div key={k} className="flex items-start gap-3 px-3 py-2">
                        <code className="text-xs font-mono text-indigo-700 w-48 flex-shrink-0 break-all">{k}</code>
                        <code className="text-xs font-mono text-slate-600 break-all">{v}</code>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── reusable key/value editor ──────────────────────────────
function KeyValueEditor({
  rows, setRows, keyPlaceholder, addLabel,
}: {
  rows: KV[];
  setRows: React.Dispatch<React.SetStateAction<KV[]>>;
  keyPlaceholder: string;
  addLabel: string;
}) {
  function update(id: number, patch: Partial<KV>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function remove(id: number) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }
  function add() {
    setRows((rs) => [...rs, { id: nextId(), on: true, key: "", value: "" }]);
  }

  return (
    <div className="space-y-1.5">
      {rows.length > 0 && (
        <div className="flex items-center gap-2 px-1 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
          <span className="w-4" />
          <span className="flex-1">Key</span>
          <span className="flex-1">Value</span>
          <span className="w-7" />
        </div>
      )}

      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={row.on}
            onChange={(e) => update(row.id, { on: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-slate-300 accent-indigo-600 cursor-pointer flex-shrink-0"
          />
          <input
            value={row.key}
            onChange={(e) => update(row.id, { key: e.target.value })}
            spellCheck={false}
            placeholder={keyPlaceholder}
            className={`flex-1 min-w-0 px-2.5 py-1.5 text-sm font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${row.on ? "text-slate-800" : "text-slate-400"}`}
          />
          <input
            value={row.value}
            onChange={(e) => update(row.id, { value: e.target.value })}
            spellCheck={false}
            placeholder="value"
            className={`flex-1 min-w-0 px-2.5 py-1.5 text-sm font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${row.on ? "text-slate-800" : "text-slate-400"}`}
          />
          <button
            onClick={() => remove(row.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
            title="Remove"
          >
            <X size={14} />
          </button>
        </div>
      ))}

      {rows.length === 0 && (
        <p className="text-xs text-slate-400 py-3">No {keyPlaceholder}s yet.</p>
      )}

      <button
        onClick={add}
        className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
      >
        <Plus size={13} />
        {addLabel}
      </button>
    </div>
  );
}
