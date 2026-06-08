import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, FolderOpen, Lightbulb, AlertTriangle } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeProjectHealth, type HealthReport } from "@/lib/health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function scoreColor(score: number) {
  if (score >= 90) return { text: "text-emerald-600", bg: "bg-emerald-500", ring: "ring-emerald-100", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (score >= 75) return { text: "text-sky-600",     bg: "bg-sky-500",     ring: "ring-sky-100",     badge: "bg-sky-50 text-sky-700 border-sky-200" };
  if (score >= 60) return { text: "text-amber-600",   bg: "bg-amber-500",   ring: "ring-amber-100",   badge: "bg-amber-50 text-amber-700 border-amber-200" };
  if (score >= 45) return { text: "text-orange-600",  bg: "bg-orange-500",  ring: "ring-orange-100",  badge: "bg-orange-50 text-orange-700 border-orange-200" };
  return                  { text: "text-rose-600",    bg: "bg-rose-500",    ring: "ring-rose-100",    badge: "bg-rose-50 text-rose-700 border-rose-200" };
}

function ScoreBar({ score, colorClass }: { score: number; colorClass: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${score}%` }} />
    </div>
  );
}

function ComponentCard({
  title,
  icon: Icon,
  score,
  primary,
  secondary,
  issues,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  score: number;
  primary: string;
  secondary?: string;
  issues?: React.ReactNode;
}) {
  const c = scoreColor(score);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-semibold text-slate-700">
          <span className="flex items-center gap-2">
            <Icon size={15} className="text-slate-400" />
            {title}
          </span>
          <span className={`text-xl font-bold tabular-nums ${c.text}`}>{score}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScoreBar score={score} colorClass={c.bg} />
        <div>
          <p className="text-sm font-medium text-slate-800">{primary}</p>
          {secondary && <p className="text-xs text-slate-500 mt-0.5">{secondary}</p>}
        </div>
        {issues}
      </CardContent>
    </Card>
  );
}

function IssueList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1 border-t border-slate-100 pt-2 mt-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-1.5 text-xs text-slate-500">
          <AlertTriangle size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default async function ProjectHealthPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const tenantId = session!.tenantId!;

  const project = await prisma.project.findFirst({
    where: { id, adminTenantId: tenantId },
    select: { id: true, name: true },
  });
  if (!project) notFound();

  const report: HealthReport | null = await computeProjectHealth(id);

  const overall = report ? scoreColor(report.score) : null;

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
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold border ${overall!.badge}`}>
                      Grade {report.grade}
                    </span>
                    <span className="text-sm text-slate-500">
                      {report.score >= 90 ? "Excellent — content is healthy and well-maintained." :
                       report.score >= 75 ? "Good — a few areas could use attention." :
                       report.score >= 60 ? "Fair — some improvements recommended." :
                       report.score >= 45 ? "Poor — significant gaps in content quality." :
                       "Critical — content needs immediate attention."}
                    </span>
                  </div>
                  <ScoreBar score={report.score} colorClass={overall!.bg} />
                  <p className="text-xs text-slate-400">
                    Based on {report.freshness.totalEntries} entr{report.freshness.totalEntries === 1 ? "y" : "ies"} across {report.coverage.totalCategories} categor{report.coverage.totalCategories === 1 ? "y" : "ies"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Component grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Completeness */}
            <ComponentCard
              title="Completeness"
              icon={CheckCircle2}
              score={report.completeness.score}
              primary={
                report.completeness.totalSlots === 0
                  ? "No scorable field slots"
                  : `${report.completeness.filledSlots.toLocaleString()} of ${report.completeness.totalSlots.toLocaleString()} field slots filled`
              }
              secondary={
                report.completeness.totalSlots > 0
                  ? `${report.completeness.totalSlots - report.completeness.filledSlots} empty slots across all entries`
                  : undefined
              }
            />

            {/* Freshness */}
            <ComponentCard
              title="Freshness"
              icon={Clock}
              score={report.freshness.score}
              primary={
                report.freshness.totalEntries === 0
                  ? "No entries"
                  : `${report.freshness.freshEntries} of ${report.freshness.totalEntries} entries updated within 90 days`
              }
              secondary={
                report.freshness.staleEntries > 0
                  ? `${report.freshness.staleEntries} entr${report.freshness.staleEntries === 1 ? "y" : "ies"} not touched in 90+ days`
                  : undefined
              }
              issues={
                report.freshness.staleEntries > 0 ? (
                  <IssueList items={[`${report.freshness.staleEntries} stale entr${report.freshness.staleEntries === 1 ? "y needs" : "ies need"} review`]} />
                ) : null
              }
            />

            {/* Coverage */}
            <ComponentCard
              title="Coverage"
              icon={FolderOpen}
              score={report.coverage.score}
              primary={`${report.coverage.coveredCategories} of ${report.coverage.totalCategories} categories have active entries`}
              secondary={
                report.coverage.emptyCategories.length > 0
                  ? `${report.coverage.emptyCategories.length} empty categor${report.coverage.emptyCategories.length === 1 ? "y" : "ies"}`
                  : "All categories have content"
              }
              issues={
                report.coverage.emptyCategories.length > 0 ? (
                  <IssueList items={report.coverage.emptyCategories.map((c) => `"${c.name}" has no entries`)} />
                ) : null
              }
            />

            {/* Schema Health */}
            <ComponentCard
              title="Schema Health"
              icon={Lightbulb}
              score={report.schemaHealth.score}
              primary={
                report.schemaHealth.totalFields === 0
                  ? "Not enough data (need categories with 2+ entries)"
                  : `${report.schemaHealth.healthyFields} of ${report.schemaHealth.totalFields} fields consistently used`
              }
              secondary={
                report.schemaHealth.problematicFields.length > 0
                  ? `${report.schemaHealth.problematicFields.length} field${report.schemaHealth.problematicFields.length === 1 ? "" : "s"} left blank by most entries — consider removing or making optional by design`
                  : report.schemaHealth.totalFields > 0 ? "All fields are being used" : undefined
              }
              issues={
                report.schemaHealth.problematicFields.length > 0 ? (
                  <IssueList
                    items={report.schemaHealth.problematicFields
                      .sort((a, b) => a.fillRate - b.fillRate)
                      .slice(0, 8)
                      .map(
                        (f) =>
                          `"${f.fieldName}" in ${f.categoryName} — ${Math.round(f.fillRate * 100)}% fill rate`
                      )}
                  />
                ) : null
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
