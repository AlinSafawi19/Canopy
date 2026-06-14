"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalRef } from "@/components/ui/modal";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { TechStackInput, TechStackItem, parseTechStack } from "@/components/ui/tech-stack-input";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { MediaInput } from "@/components/ui/media-input";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { LIMITS } from "@/lib/limits";

function extractHighlights(html: string): string[] {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const items = Array.from(doc.querySelectorAll("li")).map((li) => li.textContent?.trim() ?? "").filter(Boolean);
  if (items.length) return items;
  return Array.from(doc.querySelectorAll("p")).map((p) => p.textContent?.trim() ?? "").filter(Boolean);
}

const STEPS = [
  { label: "Basic" },
  { label: "Details" },
  { label: "Links & Media" },
  { label: "Content" },
  { label: "Story" },
];

interface Project {
  id: string;
  name: string;
  slug: string | null;
  overview: string;
  tagline: string | null;
  industry: string | null;
  status: string;
  role: string | null;
  teamSize: string | null;
  featured: boolean;
  domain: string | null;
  host: string | null;
  liveUrl: string | null;
  githubUrl: string | null;
  thumbnail_image: string | null;
  thumbnail_video: string | null;
  thumbnail_type: string | null;
  thumbnail_alt: string | null;
  challenge: string | null;
  approach: string | null;
  outcome: string | null;
  testimonial: string | null;
  techStack: unknown[];
  highlights: string[];
  startDate: string | null;
  endDate: string | null;
}

interface EditProjectButtonProps {
  project: Project;
  open?: boolean;
  onClose?: () => void;
}

function deleteGcsUrl(url: string) {
  if (!url.startsWith("https://storage.googleapis.com/")) return;
  apiFetch("/api/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  }).catch(() => {});
}

export function EditProjectButton({ project, open: controlledOpen, onClose: controlledOnClose }: EditProjectButtonProps) {
  const router = useRouter();
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const modalRef = useRef<ModalRef>(null);
  const [form, setForm] = useState({
    name: project.name,
    slug: project.slug ?? "",
    overview: project.overview,
    tagline: project.tagline ?? "",
    industry: project.industry ?? "",
    status: project.status,
    role: project.role ?? "",
    teamSize: project.teamSize ?? "",
    featured: project.featured ? "true" : "false",
    domain: project.domain ?? "",
    host: project.host ?? "",
    liveUrl: project.liveUrl ?? "",
    githubUrl: project.githubUrl ?? "",
    thumbnail_image: project.thumbnail_image ?? "",
    thumbnail_video: project.thumbnail_video ?? "",
    thumbnail_type: project.thumbnail_type ?? (project.thumbnail_video ? "video" : "image"),
    thumbnail_alt: project.thumbnail_alt ?? "",
    challenge: project.challenge ?? "",
    approach: project.approach ?? "",
    outcome: project.outcome ?? "",
    testimonial: project.testimonial ?? "",
    startDate: project.startDate ? project.startDate.slice(0, 10) : "",
    endDate: project.endDate ? project.endDate.slice(0, 10) : "",
  });
  const [techStack, setTechStack] = useState<TechStackItem[]>(() => parseTechStack(project.techStack));
  const [highlights, setHighlights] = useState(() =>
    project.highlights.length
      ? "<ul>" + project.highlights.map((h) => `<li>${h}</li>`).join("") + "</ul>"
      : ""
  );

  const originalGcsUrls = useMemo(() => new Set(
    [project.thumbnail_image ?? "", project.thumbnail_video ?? "", ...parseTechStack(project.techStack).map(t => t.icon)]
      .filter(u => u.startsWith("https://storage.googleapis.com/"))
  ), [project.thumbnail_image, project.thumbnail_video, project.techStack]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setTouched(true);
    setError("");
  }

  function cancelClose() {
    // Delete GCS files uploaded during this session that aren't in the original project
    [form.thumbnail_image, form.thumbnail_video, ...techStack.map(t => t.icon)]
      .filter(u => u.startsWith("https://storage.googleapis.com/") && !originalGcsUrls.has(u))
      .forEach(deleteGcsUrl);
    setOwnOpen(false);
    controlledOnClose?.();
    setStep(0);
    setTouched(false);
    setError("");
  }

  function successClose() {
    setOwnOpen(false);
    controlledOnClose?.();
    setStep(0);
    setTouched(false);
    setError("");
  }

  function next() {
    if (step === 0 && !form.name.trim()) { setError("Project name is required"); return; }
    if (step === 0 && !form.overview.replace(/<[^>]*>/g, "").trim()) { setError("Overview is required"); return; }
    setError("");
    setStep((s) => s + 1);
  }

  function back() {
    setError("");
    setStep((s) => s - 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          featured: form.featured === "true",
          techStack,
          highlights: extractHighlights(highlights),
          startDate: form.startDate || null,
          endDate: form.endDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
      successClose();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {controlledOpen === undefined && (
        <Button variant="outline" onClick={() => setOwnOpen(true)} className="gap-1.5">
          <Pencil size={14} />
          Edit
        </Button>
      )}
      <Modal ref={modalRef} open={open} onClose={cancelClose} title="Edit Project" size="lg" isDirty={touched} busy={loading}
        footer={
          <div className="flex justify-between gap-3">
            <Button variant="outline" type="button" onClick={() => modalRef.current?.attemptClose()}>Cancel</Button>
            <div className="flex gap-3">
              {step > 0 && <Button variant="outline" type="button" onClick={back}>Back</Button>}
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={next}>Next</Button>
              ) : (
                <Button type="button" onClick={handleSubmit} loading={loading}>Save Changes</Button>
              )}
            </div>
          </div>
        }
      >
        {/* Stepper */}
        <div className="flex items-center mb-6">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                  i < step
                    ? "bg-indigo-600 text-white"
                    : i === step
                    ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                    : "bg-slate-100 text-slate-400"
                )}>
                  {i < step ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : i + 1}
                </div>
                <span className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  i <= step ? "text-indigo-600" : "text-slate-400"
                )}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("h-px flex-1 mx-2 mb-4 transition-colors", i < step ? "bg-indigo-600" : "bg-slate-200")} />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          {/* Step 0 — Basic */}
          {step === 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Project Name" value={form.name} onChange={(e) => set("name", e.target.value)} required autoFocus maxLength={LIMITS.PROJECT_NAME} />
                <Input label="Slug" value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="my-project" maxLength={LIMITS.PROJECT_SLUG} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Overview <span className="text-red-500">*</span></label>
                <RichTextEditor value={form.overview} onChange={(v) => { set("overview", v); }} placeholder="Describe this project…" minHeight="120px" />
              </div>
              <Input label="Tagline" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="Short tagline for cards" maxLength={LIMITS.PROJECT_TAGLINE} />
            </>
          )}

          {/* Step 1 — Details */}
          {step === 1 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Industry" value={form.industry} onChange={(e) => set("industry", e.target.value)} maxLength={LIMITS.PROJECT_INDUSTRY} />
                <Select
                  label="Status"
                  value={form.status}
                  onChange={(v) => { set("status", v); setTouched(true); }}
                  options={[
                    { value: "live", label: "Live" },
                    { value: "in_progress", label: "In Progress" },
                    { value: "archived", label: "Archived" },
                  ]}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Role" value={form.role} onChange={(e) => set("role", e.target.value)} placeholder="e.g. Lead Developer" maxLength={LIMITS.PROJECT_ROLE} />
                <Input label="Team Size" value={form.teamSize} onChange={(e) => set("teamSize", e.target.value)} placeholder="e.g. 5" maxLength={LIMITS.PROJECT_TEAM_SIZE} />
              </div>
              <DateRangePicker
                label="Project Timeline"
                startDate={form.startDate || null}
                endDate={form.endDate || null}
                onChange={(start, end) => { setForm((f) => ({ ...f, startDate: start ?? "", endDate: end ?? "" })); setTouched(true); }}
              />
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={form.featured === "true"}
                  onChange={(e) => set("featured", e.target.checked ? "true" : "false")}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-700">Featured</span>
              </label>
            </>
          )}

          {/* Step 2 — Links & Media */}
          {step === 2 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Domain" value={form.domain} onChange={(e) => set("domain", e.target.value)} placeholder="example.com" maxLength={LIMITS.PROJECT_DOMAIN} />
                <Input label="Host" value={form.host} onChange={(e) => set("host", e.target.value)} placeholder="e.g. Vercel" maxLength={LIMITS.PROJECT_HOST} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Live URL" value={form.liveUrl} onChange={(e) => set("liveUrl", e.target.value)} placeholder="https://app.example.com" maxLength={LIMITS.PROJECT_LIVE_URL} />
                <Input label="GitHub URL" value={form.githubUrl} onChange={(e) => set("githubUrl", e.target.value)} placeholder="https://github.com/..." maxLength={LIMITS.PROJECT_GITHUB_URL} />
              </div>
              <Select
                label="Thumbnail Type"
                value={form.thumbnail_type}
                onChange={(v) => { set("thumbnail_type", v); setTouched(true); }}
                options={[
                  { value: "image", label: "Image" },
                  { value: "video", label: "Video" },
                ]}
              />
              {form.thumbnail_type === "video" ? (
                <MediaInput label="Thumbnail Video" value={form.thumbnail_video} onChange={(v) => set("thumbnail_video", v)} accept="video/*" placeholder="https://..." maxLength={LIMITS.PROJECT_THUMBNAIL_VIDEO} />
              ) : (
                <MediaInput label="Thumbnail Image" value={form.thumbnail_image} onChange={(v) => set("thumbnail_image", v)} accept="image/*" placeholder="https://..." maxLength={LIMITS.PROJECT_THUMBNAIL_IMAGE} />
              )}
              <Input label="Thumbnail Alt" value={form.thumbnail_alt} onChange={(e) => set("thumbnail_alt", e.target.value)} placeholder="Descriptive alt text" maxLength={LIMITS.PROJECT_THUMBNAIL_ALT} />
            </>
          )}

          {/* Step 3 — Content */}
          {step === 3 && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tech Stack</label>
                <TechStackInput value={techStack} onChange={(v) => { setTechStack(v); setTouched(true); }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Highlights</label>
                <RichTextEditor
                  value={highlights}
                  onChange={(v) => { setHighlights(v); setTouched(true); }}
                  placeholder="Add highlights as a bullet list…"
                  minHeight="120px"
                />
              </div>
            </>
          )}

          {/* Step 4 — Story */}
          {step === 4 && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Challenge</label>
                <RichTextEditor value={form.challenge} onChange={(v) => { set("challenge", v); }} placeholder="What problem did this project solve?" minHeight="100px" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Approach</label>
                <RichTextEditor value={form.approach} onChange={(v) => { set("approach", v); }} placeholder="How did you tackle it?" minHeight="100px" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Outcome</label>
                <RichTextEditor value={form.outcome} onChange={(v) => { set("outcome", v); }} placeholder="What was the result?" minHeight="100px" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Testimonial</label>
                <RichTextEditor value={form.testimonial} onChange={(v) => { set("testimonial", v); }} placeholder="Client quote or feedback…" minHeight="80px" />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </form>
      </Modal>
    </>
  );
}
