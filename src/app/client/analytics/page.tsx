import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeContributorAnalytics } from "@/lib/contributor-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  Users, GitPullRequest, CheckCircle2, Clock,
  TrendingUp, AlertCircle, Minus,
} from "lucide-react";
import { MonthlyChart, AcceptanceRateChart } from "./charts";
import { formatDateTime } from "@/lib/utils";

// ── helpers ───────────────────────────────────────────────────────────────────

function acceptanceBadge(rate: number) {
  if (rate >= 75) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (rate >= 50) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-black tabular-nums mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-slate-50">
            <Icon size={18} className="text-slate-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function ContributorAnalyticsPage() {
  const session = await getSession();

  // Resolve client tenantId (stored in ClientIdentity, not session directly)
  const client = await prisma.clientIdentity.findUnique({
    where: { id: session!.id },
    select: { tenantId: true },
  });

  const report = client?.tenantId
    ? await computeContributorAnalytics(client.tenantId, session!.username)
    : null;

  const noData = !report || report.totalRequests === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Contributor Analytics</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Change requests, acceptance rates, and resolution times for your contributors
        </p>
      </div>

      {/* ── Summary cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Contributors"
          value={report?.totalContributors ?? 0}
          sub={
            report && report.activeContributors !== report.totalContributors
              ? `${report.activeContributors} with requests`
              : "all listed"
          }
          icon={Users}
          color="text-slate-800"
        />
        <StatCard
          label="Total Requests"
          value={report?.totalRequests ?? 0}
          sub={`${report?.pendingRequests ?? 0} pending`}
          icon={GitPullRequest}
          color="text-indigo-600"
        />
        <StatCard
          label="Acceptance Rate"
          value={`${report?.overallAcceptanceRate ?? 0}%`}
          sub={`${report?.resolvedRequests ?? 0} resolved`}
          icon={CheckCircle2}
          color={
            (report?.overallAcceptanceRate ?? 0) >= 75 ? "text-emerald-600"
            : (report?.overallAcceptanceRate ?? 0) >= 50 ? "text-amber-600"
            : "text-rose-600"
          }
        />
        <StatCard
          label="Avg Resolution"
          value={report?.avgResolutionDays != null ? `${report.avgResolutionDays}d` : "—"}
          sub="days from submit to resolve"
          icon={Clock}
          color="text-sky-600"
        />
      </div>

      {noData ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <GitPullRequest size={36} className="text-slate-300" />
            <p className="text-slate-500 font-medium">
              {!report || report.totalContributors === 0
                ? "No contributors yet"
                : "No change requests yet"}
            </p>
            <p className="text-sm text-slate-400 max-w-xs">
              {!report || report.totalContributors === 0
                ? "Add contributors to your projects to see analytics here."
                : "Analytics will appear once contributors start submitting change requests."}
            </p>
            {(!report || report.totalContributors === 0) && (
              <Link href="/client/contributors" className="text-sm text-indigo-600 hover:underline mt-1">
                Manage contributors
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Charts ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <TrendingUp size={14} className="text-slate-400" />
                  Monthly Activity
                  <span className="text-xs font-normal text-slate-400 ml-1">last 6 months</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MonthlyChart data={report.requestsByMonth} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CheckCircle2 size={14} className="text-slate-400" />
                  Acceptance Rate by Contributor
                  {report.contributors.length > 10 && (
                    <span className="text-xs font-normal text-slate-400 ml-1">top 10</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AcceptanceRateChart contributors={report.contributors} />
              </CardContent>
            </Card>
          </div>

          {/* ── Contributor table ──────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Users size={14} className="text-slate-400" />
                All Contributors
                <span className="ml-auto text-xs font-normal text-slate-400">
                  {report.contributors.length} contributor{report.contributors.length !== 1 ? "s" : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3">Contributor</th>
                      <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3">Projects</th>
                      <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3">Submitted</th>
                      <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3">Resolved</th>
                      <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3">Pending</th>
                      <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3">Acceptance</th>
                      <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3">Avg Resolution</th>
                      <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3">Last Request</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {report.contributors.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Contributor */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-indigo-700 text-[10px] font-bold uppercase">
                                {c.name.charAt(0)}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800 truncate">{c.name}</p>
                              <p className="text-xs text-slate-400 truncate">@{c.username}</p>
                            </div>
                          </div>
                        </td>

                        {/* Projects */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {c.projects.length === 0 ? (
                              <span className="text-xs text-slate-400">—</span>
                            ) : (
                              <>
                                {c.projects.slice(0, 2).map((p) => (
                                  <Link key={p.id} href={`/client/projects/${p.id}`}>
                                    <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors truncate max-w-[80px]">
                                      {p.name}
                                    </span>
                                  </Link>
                                ))}
                                {c.projects.length > 2 && (
                                  <span className="text-[10px] text-slate-400">
                                    +{c.projects.length - 2}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </td>

                        {/* Submitted */}
                        <td className="px-4 py-3.5 text-right">
                          <span className="font-semibold text-slate-700 tabular-nums">{c.totalRequests}</span>
                        </td>

                        {/* Resolved */}
                        <td className="px-4 py-3.5 text-right">
                          <span className="text-emerald-600 font-medium tabular-nums">{c.resolvedRequests}</span>
                        </td>

                        {/* Pending */}
                        <td className="px-4 py-3.5 text-right">
                          {c.pendingRequests > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-medium tabular-nums">
                              <AlertCircle size={11} />
                              {c.pendingRequests}
                            </span>
                          ) : (
                            <span className="text-slate-400 tabular-nums">0</span>
                          )}
                        </td>

                        {/* Acceptance rate */}
                        <td className="px-4 py-3.5 text-right">
                          {c.totalRequests === 0 ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border tabular-nums ${acceptanceBadge(c.acceptanceRate)}`}>
                              {c.acceptanceRate}%
                            </span>
                          )}
                        </td>

                        {/* Avg resolution */}
                        <td className="px-4 py-3.5 text-right">
                          {c.avgResolutionDays !== null ? (
                            <span className="text-sky-600 font-medium tabular-nums">{c.avgResolutionDays}d</span>
                          ) : (
                            <Minus size={12} className="text-slate-300 ml-auto" />
                          )}
                        </td>

                        {/* Last request */}
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-xs text-slate-400">
                            {c.lastActivityAt ? formatDateTime(c.lastActivityAt.toISOString()) : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
