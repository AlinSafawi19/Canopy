"use client";

import { useState, useEffect } from "react";
import { Terminal, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CopyButton } from "@/components/ui/copy-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CategoryInfo { name: string; slug: string }
interface ProjectInfo  { id: string; name: string; slug: string; categories: CategoryInfo[] }

interface Props {
  projects: ProjectInfo[];
}

type EndpointType = "projects" | "project" | "category";

interface Result { status: number; time: number; body: string }

function prettyPrint(text: string): string {
  try { return JSON.stringify(JSON.parse(text), null, 2); }
  catch { return text; }
}

const ENDPOINTS: { value: EndpointType; label: string; desc: string }[] = [
  { value: "projects", label: "List Projects", desc: "/api/v1/projects" },
  { value: "project",  label: "Get Project",   desc: "/api/v1/{slug}" },
  { value: "category", label: "Get Category",  desc: "/api/v1/{slug}/{cat}" },
];

export function ApiPlayground({ projects }: Props) {
  const [endpoint,    setEndpoint]    = useState<EndpointType>("category");
  const [projectIdx,  setProjectIdx]  = useState(0);
  const [categoryIdx, setCategoryIdx] = useState(0);
  const [apiKey,      setApiKey]      = useState("");
  const [page,        setPage]        = useState("1");
  const [limit,       setLimit]       = useState("20");
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState<Result | null>(null);
  const [sendError,   setSendError]   = useState("");
  const [origin,      setOrigin]      = useState("");

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const selectedProject  = projects[projectIdx]  ?? null;
  const selectedCategory = selectedProject?.categories[categoryIdx] ?? null;

  function buildUrl(): string {
    if (!origin) return "";
    const base = `${origin}/api/v1`;
    const qs   = `page=${page || "1"}&limit=${limit || "20"}`;

    if (endpoint === "projects") return `${base}/projects?${qs}`;
    if (endpoint === "project")  return selectedProject  ? `${base}/${selectedProject.slug}`                                   : "";
    if (endpoint === "category") return selectedCategory ? `${base}/${selectedProject!.slug}/${selectedCategory.slug}?${qs}`   : "";
    return "";
  }

  const url = buildUrl();
  const hasPagination      = endpoint === "projects" || endpoint === "category";
  const hasProjectSelector = endpoint === "project"  || endpoint === "category";
  const hasCategorySelector = endpoint === "category";

  async function send() {
    setSendError("");
    if (!apiKey.trim()) { setSendError("API key is required"); return; }
    if (!url)           { setSendError("Select a project and category to build the URL"); return; }

    setLoading(true);
    setResult(null);
    const start = performance.now();
    try {
      const res  = await fetch(url, { headers: { Authorization: `Bearer ${apiKey.trim()}` } });
      const elapsed = Math.round(performance.now() - start);
      const text = await res.text();
      setResult({ status: res.status, time: elapsed, body: text });
    } catch {
      setSendError("Network error — could not reach the API");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send();
  }

  const statusColor = !result ? ""
    : result.status < 300 ? "bg-emerald-50 border-emerald-200 text-emerald-700"
    : result.status < 500 ? "bg-amber-50 border-amber-200 text-amber-700"
    : "bg-red-50 border-red-200 text-red-700";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-slate-400" />
          <CardTitle>API Playground</CardTitle>
        </div>
        <p className="text-sm text-slate-500 mt-0.5">
          Test your API live — no Postman required. Press <kbd className="px-1 py-0.5 text-xs bg-slate-100 border border-slate-200 rounded font-mono">⌘ Enter</kbd> to send.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <div onKeyDown={handleKeyDown} className="space-y-5">

        {/* Endpoint tabs */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Endpoint</p>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden w-fit">
            {ENDPOINTS.map((ep, i) => (
              <button
                key={ep.value}
                type="button"
                onClick={() => { setEndpoint(ep.value); setResult(null); setSendError(""); }}
                className={[
                  "px-3 py-1.5 text-sm font-medium transition-colors",
                  i < ENDPOINTS.length - 1 ? "border-r border-slate-200" : "",
                  endpoint === ep.value
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50",
                ].join(" ")}
              >
                {ep.label}
              </button>
            ))}
          </div>
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap gap-3 items-end">
          {hasProjectSelector && (
            <div className="w-44">
              <Select
                label="Project"
                value={String(projectIdx)}
                onChange={(v) => { setProjectIdx(Number(v)); setCategoryIdx(0); setResult(null); }}
                options={
                  projects.length
                    ? projects.map((p, i) => ({ value: String(i), label: p.name }))
                    : [{ value: "0", label: "No projects with slug" }]
                }
                disabled={!projects.length}
              />
            </div>
          )}

          {hasCategorySelector && (
            <div className="w-44">
              <Select
                label="Category"
                value={String(categoryIdx)}
                onChange={(v) => { setCategoryIdx(Number(v)); setResult(null); }}
                options={
                  selectedProject?.categories.length
                    ? selectedProject.categories.map((c, i) => ({ value: String(i), label: c.name }))
                    : [{ value: "0", label: "No categories with slug" }]
                }
                disabled={!selectedProject?.categories.length}
              />
            </div>
          )}

          <div className="flex-1 min-w-52">
            <Input
              label="API Key"
              type="password"
              showToggle
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="cms_..."
            />
          </div>

          {hasPagination && (
            <>
              <div className="w-20">
                <Input label="Page"  type="number" value={page}  onChange={(e) => setPage(e.target.value)}  />
              </div>
              <div className="w-20">
                <Input label="Limit" type="number" value={limit} onChange={(e) => setLimit(e.target.value)} />
              </div>
            </>
          )}
        </div>

        {/* URL preview + Send button */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2.5 min-w-0 overflow-hidden">
            <span className="text-xs font-bold text-emerald-400 shrink-0">GET</span>
            <code className="text-xs font-mono truncate flex-1 text-slate-200">
              {url || <span className="text-slate-500 not-italic">select a project and category first</span>}
            </code>
            {url && <CopyButton text={url} />}
          </div>
          <Button
            onClick={send}
            loading={loading}
            disabled={!url || !apiKey.trim() || loading}
            className="gap-1.5 shrink-0"
          >
            <Send size={13} />
            Send
          </Button>
        </div>

        {/* Validation / network error */}
        {sendError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {sendError}
          </p>
        )}

        {/* Response */}
        {result && (
          <div className="space-y-2.5 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusColor}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {result.status}
              </div>
              <span className="text-xs text-slate-400">{result.time}ms</span>
            </div>
            <div className="relative group">
              <pre className="bg-slate-900 rounded-lg p-4 overflow-auto max-h-96 text-xs font-mono leading-relaxed text-slate-100 whitespace-pre-wrap break-words">
                {prettyPrint(result.body)}
              </pre>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <CopyButton text={result.body} />
              </div>
            </div>
          </div>
        )}

        </div>
      </CardContent>
    </Card>
  );
}
