import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, Clock, FolderOpen, Lightbulb,
  ExternalLink, PlusCircle, Settings2, Info,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeProjectHealth, type HealthReport } from "@/lib/health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ScoreGauge, ComponentBars, FieldFillChart,
  FreshnessChart, CoverageDonut, SchemaHealthChart,
} from "./charts";

// ── helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 90) return { text: "text-emerald-600", bar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (score >= 75) return { text: "text-sky-600",     bar: "bg-sky-500",     badge: "bg-sky-50 text-sky-700 border-sky-200" };
  if (score >= 60) return { text: "text-amber-600",   bar: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 border-amber-200" };
  if (score >= 45) return { text: "text-orange-600",  bar: "bg-orange-500",  badge: "bg-orange-50 text-orange-700 border-orange-200" };
  return                  { text: "text-rose-600",    bar: "bg-rose-500",    badge: "bg-rose-50 text-rose-700 border-rose-200" };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-4 mb-2">{children}</p>;
}

function CategoryLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-500 hover:text-indigo-700 transition-colors">
      <ExternalLink size={9} />
      {label}
    </Link>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

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

  const report: HealthReport | null = await computeProjectHealth(id);
  const catBase = `/admin/projects/${id}/categories`;

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
            <p className="text-sm text-slate-400 max-w-xs">Add categories and entries to see health scores.</p>
            <Link href={`/admin/projects/${id}`}>
              <Button size="sm" className="gap-1.5 mt-2">
                <PlusCircle size={14} />
                Go to project
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Overall score ─────────────────────────────────────── */}
          <Card>
            <CardContent className="py-6">
              <div className="flex flex-col sm:flex-row gap-6">
                {/* gauge + grade */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  <ScoreGauge score={report.score} />
                  <div className="space-y-1.5">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-base font-bold border ${scoreColor(report.score).badge}`}>
                      Grade {report.grade}
                    </span>
                    <p className="text-sm text-slate-500 max-w-[220px]">{summaryText}</p>
                    <p className="text-xs text-slate-400">
                      {report.freshness.totalEntries} entr{report.freshness.totalEntries === 1 ? "y" : "ies"} · {report.coverage.totalCategories} categor{report.coverage.totalCategories === 1 ? "y" : "ies"}
                      {report.schemaHealth.insufficient && (
                        <span className="ml-1 text-amber-500">· Schema health excluded (needs 2+ entries/category)</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* component score bars */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Component scores</p>
                  <ComponentBars data={[
                    { name: "Completeness", score: report.completeness.score },
                    { name: "Freshness",    score: report.freshness.score },
                    { name: "Coverage",     score: report.coverage.score },
                    { name: "Schema Health", score: report.schemaHealth.score, na: report.schemaHealth.insufficient },
                  ]} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Component grid ────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Completeness */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-semibold text-slate-700">
                  <span className="flex items-center gap-2"><CheckCircle2 size={14} className="text-slate-400" />Completeness</span>
                  <span className={`text-2xl font-black tabular-nums ml-4 ${scoreColor(report.completeness.score).text}`}>
                    {report.completeness.score}<span className="text-sm font-normal text-slate-400">/100</span>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{report.completeness.filledSlots.toLocaleString()}</span> of <span className="font-semibold text-slate-700">{report.completeness.totalSlots.toLocaleString()}</span> field slots filled
                  {report.completeness.totalSlots - report.completeness.filledSlots > 0 && (
                    <span className="text-amber-600 ml-1">({(report.completeness.totalSlots - report.completeness.filledSlots).toLocaleString()} empty)</span>
                  )}
                </p>

                {report.completeness.partialFields.length > 0 ? (
                  <>
                    <SectionLabel>Fields with gaps — fill rates</SectionLabel>
                    <FieldFillChart fields={report.completeness.partialFields} />
                    <SectionLabel>Actions</SectionLabel>
                    <div className="space-y-1.5">
                      {[...new Map(report.completeness.partialFields.map((f) => [f.categoryId, f])).values()].map((f) => (
                        <div key={f.categoryId} className="flex items-center justify-between gap-2 py-1 border-b border-slate-50 last:border-0">
                          <span className="text-xs text-slate-600 truncate">{f.categoryName}</span>
                          <CategoryLink href={`${catBase}/${f.categoryId}`} label="View entries" />
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-emerald-600 font-medium mt-2">All fields fully filled across all entries.</p>
                )}
              </CardContent>
            </Card>

            {/* Freshness */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-semibold text-slate-700">
                  <span className="flex items-center gap-2"><Clock size={14} className="text-slate-400" />Freshness</span>
                  <span className={`text-2xl font-black tabular-nums ml-4 ${scoreColor(report.freshness.score).text}`}>
                    {report.freshness.score}<span className="text-sm font-normal text-slate-400">/100</span>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {report.freshness.totalEntries === 0 ? (
                  <p className="text-xs text-slate-400">No entries to assess.</p>
                ) : (
                  <>
                    <p className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{report.freshness.freshEntries}</span> of <span className="font-semibold text-slate-700">{report.freshness.totalEntries}</span> entries updated in the last 90 days
                      {report.freshness.staleEntries > 0 && (
                        <span className="text-amber-600 ml-1">({report.freshness.staleEntries} stale)</span>
                      )}
                    </p>

                    {report.freshness.staleByCategory.length > 0 ? (
                      <>
                        <SectionLabel>Fresh vs stale by category</SectionLabel>
                        <FreshnessChart data={report.freshness.staleByCategory} />
                        <SectionLabel>Actions — review stale content</SectionLabel>
                        <div className="space-y-1.5">
                          {report.freshness.staleByCategory.map((s) => (
                            <div key={s.categoryId} className="flex items-center justify-between gap-2 py-1 border-b border-slate-50 last:border-0">
                              <div>
                                <span className="text-xs text-slate-700 font-medium">{s.categoryName}</span>
                                <span className="text-[10px] text-amber-600 ml-1.5">{s.staleCount} stale</span>
                              </div>
                              <CategoryLink href={`${catBase}/${s.categoryId}`} label="View entries" />
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-emerald-600 font-medium mt-2">All entries are up to date.</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Coverage */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-semibold text-slate-700">
                  <span className="flex items-center gap-2"><FolderOpen size={14} className="text-slate-400" />Coverage</span>
                  <span className={`text-2xl font-black tabular-nums ml-4 ${scoreColor(report.coverage.score).text}`}>
                    {report.coverage.score}<span className="text-sm font-normal text-slate-400">/100</span>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{report.coverage.coveredCategories}</span> of <span className="font-semibold text-slate-700">{report.coverage.totalCategories}</span> categories have at least one entry
                </p>
                <CoverageDonut covered={report.coverage.coveredCategories} empty={report.coverage.emptyCategories.length} />

                {report.coverage.emptyCategories.length > 0 ? (
                  <>
                    <SectionLabel>Empty categories — add content</SectionLabel>
                    <div className="space-y-1.5">
                      {report.coverage.emptyCategories.map((cat) => (
                        <div key={cat.id} className="flex items-center justify-between gap-2 py-1 border-b border-slate-50 last:border-0">
                          <span className="text-xs text-slate-700">{cat.name}</span>
                          <Link href={`${catBase}/${cat.id}`}>
                            <button className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-500 hover:text-indigo-700 transition-colors">
                              <PlusCircle size={9} />
                              Add entry
                            </button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-emerald-600 font-medium">All categories have content.</p>
                )}
              </CardContent>
            </Card>

            {/* Schema Health */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-semibold text-slate-700">
                  <span className="flex items-center gap-2"><Lightbulb size={14} className="text-slate-400" />Schema Health</span>
                  <span className={`text-2xl font-black tabular-nums ml-4 ${report.schemaHealth.insufficient ? "text-slate-400" : scoreColor(report.schemaHealth.score).text}`}>
                    {report.schemaHealth.score}<span className="text-sm font-normal text-slate-400">/100</span>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {report.schemaHealth.insufficient ? (
                  <>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mt-1">
                      <div className="h-full w-0 rounded-full bg-slate-300" />
                    </div>
                    <div className="flex items-start gap-2 p-3 mt-2 rounded-lg bg-amber-50 border border-amber-200">
                      <Info size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        Schema analysis needs at least <strong>2 entries per category</strong>. Add more entries to detect fields that are consistently skipped.
                      </p>
                    </div>
                    {report.schemaHealth.lowEntriesCategories.length > 0 && (
                      <>
                        <SectionLabel>Add entries to unlock schema analysis</SectionLabel>
                        <div className="space-y-1.5">
                          {report.schemaHealth.lowEntriesCategories.map((cat) => (
                            <div key={cat.id} className="flex items-center justify-between gap-2 py-1 border-b border-slate-50 last:border-0">
                              <div>
                                <span className="text-xs text-slate-700 font-medium">{cat.name}</span>
                                <span className="text-[10px] text-slate-400 ml-1.5">{cat.entryCount} of 2 entries</span>
                              </div>
                              <Link href={`${catBase}/${cat.id}`}>
                                <button className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-500 hover:text-indigo-700 transition-colors">
                                  <PlusCircle size={9} />
                                  Add entry
                                </button>
                              </Link>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{report.schemaHealth.healthyFields}</span> of <span className="font-semibold text-slate-700">{report.schemaHealth.totalFields}</span> fields used in ≥30% of entries
                    </p>

                    {report.schemaHealth.problematicFields.length > 0 ? (
                      <>
                        <SectionLabel>Consistently skipped fields (bad schema signal)</SectionLabel>
                        <SchemaHealthChart fields={report.schemaHealth.problematicFields} />
                        <SectionLabel>Actions — review or remove unused fields</SectionLabel>
                        <div className="space-y-1.5">
                          {[...new Map(report.schemaHealth.problematicFields.map((f) => [f.categoryId, f])).values()].map((f) => (
                            <div key={f.categoryId} className="flex items-center justify-between gap-2 py-1 border-b border-slate-50 last:border-0">
                              <span className="text-xs text-slate-700 truncate">{f.categoryName}</span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <CategoryLink href={`${catBase}/${f.categoryId}`} label="View entries" />
                                <Link href={`${catBase}/${f.categoryId}`}>
                                  <button className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-indigo-600 transition-colors">
                                    <Settings2 size={9} />
                                    Edit schema
                                  </button>
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-emerald-600 font-medium mt-2">All fields are being used consistently.</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

          </div>
        </>
      )}
    </div>
  );
}
