"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts";
import type { MonthBucket, ContributorStat } from "@/lib/contributor-analytics";

// ── Monthly activity chart ─────────────────────────────────────────────────────

export function MonthlyChart({ data }: { data: MonthBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: -8, right: 8, top: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "#f8fafc" }}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Bar dataKey="submitted" name="Submitted" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="resolved"  name="Resolved"  fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Acceptance rate chart (horizontal bars per contributor) ───────────────────

export function AcceptanceRateChart({ contributors }: { contributors: ContributorStat[] }) {
  const data = contributors.slice(0, 10).map((c) => ({
    name: c.name,
    rate: c.acceptanceRate,
    total: c.totalRequests,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 36, top: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke="#f1f5f9" />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "#f8fafc" }}
          formatter={(v: unknown, _: unknown, p: { payload?: { total: number } }) =>
            [`${v}% (${p?.payload?.total ?? 0} requests)`, "Acceptance rate"]
          }
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Bar dataKey="rate" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((d) => (
            <Cell
              key={d.name}
              fill={
                d.rate >= 75 ? "#10b981"
                : d.rate >= 50 ? "#f59e0b"
                : "#f43f5e"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
