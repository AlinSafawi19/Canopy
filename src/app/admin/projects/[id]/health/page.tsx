import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, FolderOpen, Lightbulb, AlertTriangle, Info } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeProjectHealth, type HealthReport } from "@/lib/health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ── helpers ────────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 90) return { text: "text-emerald-600", bar: "bg-emerald-500", ring: "ring-emerald-200", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (score >= 75) return { text: "text-sky-600",     bar: "bg-sky-500",     ring: "ring-sky-200",     badge: "bg-sky-50 text-sky-700 border-sky-200" };
  if (score >= 60) return { text: "text-amber-600",   bar: "bg-amber-500",   ring: "ring-amber-200",   badge: "bg-amber-50 text-amber-700 border-amber-200" };
  if (score >= 45) return { text: "text-orange-600",  bar: "bg-orange-500",  ring: "ring-orange-200",  badge: "bg-orange-50 text-orange-700 border-orange-200" };
  return                  { text: "text-rose-600",    bar: "bg-rose-500",    ring: "ring-rose-200",    badge: "bg-rose-50 text-rose-700 border-rose-200" };
}

function ScoreBar({ score, barClass }: { score: number; barClass: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full ${barClass}`} style={{ width: `${score}%` }} />
    </div>
  );
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

// ── sub-components ─────────────────────────────────────────────────────────────

function DetailRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500 truncate flex-1">{label}</span>
      <div className="text-right flex-shrink-0">
        <span className="text-xs font-semibold text-slate-700">{value}</span>
        {sub && <span className="text-[10px] text-slate-400 ml-1">{sub}</span>}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-3 mb-1">{children}</p>;
}

// ── component cards ────────────────────────────────────────────────────────────

function CompletenessCard({ data }: { data: HealthReport["completeness"] }) {
  const c = scoreColor(data.score);
  const emptySlots = data.totalSlots - data.filledSlots;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-semibold text-slate-700">
          <span className="flex items-center gap-2"><CheckCircle2 size={14} className="text-slate-400" />Completeness</span>
          <span className={`text-2xl font-black tabular-nums ${c.text}`}>{data.score}<span className="text-sm font-normal text-slate-400">/100</span></span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScoreBar score={data.score} barClass={c.bar} />
        <DetailRow
          label="Field slots filled"
          value={`${data.filledSlots.toLocaleString()} / ${data.totalSlots.toLocaleString()}`}
          sub={emptySlots > 0 ? `${emptySlots} empty` : "all filled"}
        />
        {data.partialFields.length > 0 && (
          <>
            <SectionLabel>Fields with gaps</SectionLabel>
            <div className="space-y-0">
              {data.partialFields.slice(0, 8).map((f) => (
                <div key={`${f.categoryName}|${f.fieldName}`} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-slate-700 font-medium truncate block">{f.fieldName}</span>
                    <span className="text-[10px] text-slate-400">{f.categoryName}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-400" style={{ width: pct(f.fillRate) }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-600 w-8 text-right">{pct(f.fillRate)}</span>
                  </div>
                </div>
              ))}
              {data.partialFields.length > 8 && (
                <p className="text-[10px] text-slate-400 pt-1">+{data.partialFields.length - 8} more fields</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FreshnessCard({ data }: { data: HealthReport["freshness"] }) {
  const c = scoreColor(data.score);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-semibold text-slate-700">
          <span className="flex items-center gap-2"><Clock size={14} className="text-slate-400" />Freshness</span>
          <span className={`text-2xl font-black tabular-nums ${c.text}`}>{data.score}<span className="text-sm font-normal text-slate-400">/100</span></span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScoreBar score={data.score} barClass={c.bar} />
        {data.totalEntries === 0 ? (
          <p className="text-xs text-slate-400">No entries</p>
        ) : (
          <>
            <DetailRow label="Updated within 90 days" value={`${data.freshEntries} / ${data.totalEntries}`} sub={data.staleEntries > 0 ? `${data.staleEntries} stale` : undefined} />
            {data.staleByCategory.length > 0 && (
              <>
                <SectionLabel>Stale entries by category</SectionLabel>
                <div>
                  {data.staleByCategory.map((s) => (
                    <div key={s.categoryName} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                      <span className="text-xs text-slate-600 truncate flex-1">{s.categoryName}</span>
                      <span className="text-xs font-semibold text-amber-600 flex-shrink-0">
                        {s.staleCount} of {s.totalCount}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CoverageCard({ data }: { data: HealthReport["coverage"] }) {
  const c = scoreColor(data.score);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-semibold text-slate-700">
          <span className="flex items-center gap-2"><FolderOpen size={14} className="text-slate-400" />Coverage</span>
          <span className={`text-2xl font-black tabular-nums ${c.text}`}>{data.score}<span className="text-sm font-normal text-slate-400">/100</span></span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScoreBar score={data.score} barClass={c.bar} />
        <DetailRow
          label="Categories with entries"
          value={`${data.coveredCategories} / ${data.totalCategories}`}
          sub={data.emptyCategories.length > 0 ? `${data.emptyCategories.length} empty` : "all covered"}
        />
        {data.emptyCategories.length > 0 && (
          <>
            <SectionLabel>Empty categories</SectionLabel>
            <div>
              {data.emptyCategories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-1.5 py-1.5 border-b border-slate-50 last:border-0">
                  <AlertTriangle size={10} className="text-amber-400 flex-shrink-0" />
                  <span className="text-xs text-slate-600">{cat.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SchemaHealthCard({ data }: { data: HealthReport["schemaHealth"] }) {
  const c = data.insufficient ? null : scoreColor(data.score);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-semibold text-slate-700">
          <span className="flex items-center gap-2"><Lightbulb size={14} className="text-slate-400" />Schema Health</span>
          {data.insufficient
            ? <span className="text-sm font-semibold text-slate-400">N/A</span>
            : <span className={`text-2xl font-black tabular-nums ${c!.text}`}>{data.score}<span className="text-sm font-normal text-slate-400">/100</span></span>
          }
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.insufficient ? (
          <>
            <div className="h-1.5 w-full rounded-full bg-slate-100" />
            <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <Info size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500">
                Schema health requires at least 2 entries per category. Add more entries to see which fields are being consistently skipped.
              </p>
            </div>
          </>
        ) : (
          <>
            <ScoreBar score={data.score} barClass={c!.bar} />
            <DetailRow
              label="Fields used consistently (≥30%)"
              value={`${data.healthyFields} / ${data.totalFields}`}
            />
            {data.problematicFields.length > 0 && (
              <>
                <SectionLabel>Consistently skipped fields</SectionLabel>
                <div>
                  {data.problematicFields.slice(0, 8).map((f) => (
                    <div key={`${f.categoryName}|${f.fieldName}`} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-slate-700 font-medium truncate block">{f.fieldName}</span>
                        <span className="text-[10px] text-slate-400">{f.categoryName}</span>
                      </div>
                      <span className="text-xs font-semibold text-rose-500 flex-shrink-0">{pct(f.fillRate)} filled</span>
                    </div>
                  ))}
                  {data.problematicFields.length > 8 && (
                    <p className="text-[10px] text-slate-400 pt-1">+{data.problematicFields.length - 8} more fields</p>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── page ───────────────────────────────────────────────────────────────────────

export default async function ProjectHealthPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  const project = await prisma.project.findFirst({
    where: { id, adminTenantId: session!.tenantId! },
    select: { id: true, name: true },
  });
  if (!project) notFound();

  const report = await computeProjectHealth(id);
  const overall = report ? scoreColor(report.score) : null;

  const summaryText = !report ? "" :
    report.score >= 90 ? "Excellent — content is healthy and well-maintained." :
    report.score >= 75 ? "Good — a few areas could use attention." :
    report.score >= 60 ? "Fair — some improvements recommended." :
    report.score >= 45 ? "Poor — significant gaps in content quality." :
                         "Critical — content needs immediate attention.";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/admin/projects/${id}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft size={14} />
            {project.name}
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-slate-900">Content Health</h2>
          <p className="text-sm text-slate-500 mt-0.5">Quality signal across all categories and entries</p>
        </div>
      </div>

      {!report ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <FolderOpen size={36} className="text-slate-300" />
            <p className="text-slate-500 font-medium">No content to assess</p>
            <p className="text-sm text-slate-400 max-w-xs">
              Add categories and entries to this project to see a health score.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overall score */}
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center gap-6">
                <div className={`flex-shrink-0 w-20 h-20 rounded-2xl ring-4 ${overall!.ring} bg-white flex flex-col items-center justify-center shadow-sm`}>
                  <span className={`text-3xl font-black tabular-nums ${overall!.text}`}>{report.score}</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">/ 100</span>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold border ${overall!.badge}`}>
                      Grade {report.grade}
                    </span>
                    <span className="text-sm text-slate-500">{summaryText}</span>
                  </div>
                  <ScoreBar score={report.score} barClass={overall!.bar} />
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>{report.freshness.totalEntries} entr{report.freshness.totalEntries === 1 ? "y" : "ies"}</span>
                    <span>·</span>
                    <span>{report.coverage.totalCategories} categor{report.coverage.totalCategories === 1 ? "y" : "ies"}</span>
                    {report.schemaHealth.insufficient && (
                      <>
                        <span>·</span>
                        <span className="text-amber-500">Schema health excluded (not enough data)</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Component grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CompletenessCard data={report.completeness} />
            <FreshnessCard    data={report.freshness} />
            <CoverageCard     data={report.coverage} />
            <SchemaHealthCard data={report.schemaHealth} />
          </div>
        </>
      )}
    </div>
  );
}
