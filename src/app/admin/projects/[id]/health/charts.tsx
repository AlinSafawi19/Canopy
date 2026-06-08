"use client";

import {
  RadialBarChart, RadialBar, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import type { FieldStat, CategoryStaleness, ProblematicField } from "@/lib/health";

// ── palette helpers ──────────────────────────────────────────────────────────

function scoreHex(score: number): string {
  if (score >= 90) return "#10b981"; // emerald-500
  if (score >= 75) return "#0ea5e9"; // sky-500
  if (score >= 60) return "#f59e0b"; // amber-500
  if (score >= 45) return "#f97316"; // orange-500
  return "#f43f5e";                  // rose-500
}

// ── Radial gauge (overall score) ─────────────────────────────────────────────

export function ScoreGauge({ score }: { score: number }) {
  const color = scoreHex(score);
  const data = [{ name: "score", value: score }];
  return (
    <div className="relative w-40 h-40 flex-shrink-0">
      <RadialBarChart
        width={160} height={160}
        innerRadius={52} outerRadius={72}
        data={data}
        startAngle={225} endAngle={-45}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar
          dataKey="value"
          cornerRadius={6}
          background={{ fill: "#e2e8f0" }}
          fill={color}
          angleAxisId={0}
        />
      </RadialBarChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-black tabular-nums" style={{ color }}>{score}</span>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">/ 100</span>
      </div>
    </div>
  );
}

// ── Component score bar chart ────────────────────────────────────────────────

interface ComponentScore { name: string; score: number; na?: boolean }

export function ComponentBars({ data }: { data: ComponentScore[] }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "#f8fafc" }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any, _: any, p: any) =>
            p?.payload?.na ? ["N/A", ""] : [`${v}/100`, ""]
          }
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.na ? "#e2e8f0" : scoreHex(entry.score)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Field fill-rate bar chart (Completeness) ─────────────────────────────────

interface FieldBar { label: string; fillRate: number }

export function FieldFillChart({ fields }: { fields: FieldStat[] }) {
  if (fields.length === 0) return <p className="text-xs text-slate-400 py-2">All fields fully filled.</p>;
  const data: FieldBar[] = fields.slice(0, 12).map((f) => ({
    label: `${f.fieldName} (${f.categoryName})`,
    fillRate: Math.round(f.fillRate * 100),
  }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 36, top: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "#f8fafc" }}
          formatter={(v: unknown) => [`${v}%`, "Fill rate"]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Bar dataKey="fillRate" radius={[0, 4, 4, 0]} maxBarSize={16}>
          {data.map((d) => (
            <Cell key={d.label} fill={scoreHex(d.fillRate)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Freshness stacked bar by category ────────────────────────────────────────

export function FreshnessChart({ data }: { data: CategoryStaleness[] }) {
  if (data.length === 0) return <p className="text-xs text-slate-400 py-2">No stale entries.</p>;
  const chartData = data.map((d) => ({
    name: d.categoryName,
    fresh: d.totalCount - d.staleCount,
    stale: d.staleCount,
  }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(100, chartData.length * 36)}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "#f8fafc" }}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="fresh" stackId="a" fill="#10b981" name="Fresh" radius={[0, 0, 0, 0]} maxBarSize={18} />
        <Bar dataKey="stale" stackId="a" fill="#f59e0b" name="Stale (90+ days)" radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Coverage donut ────────────────────────────────────────────────────────────

export function CoverageDonut({ covered, empty }: { covered: number; empty: number }) {
  const data = [
    { name: "Covered", value: covered, fill: "#10b981" },
    { name: "Empty",   value: empty,   fill: "#e2e8f0" },
  ];
  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={65}
          paddingAngle={2}
          dataKey="value"
          startAngle={90}
          endAngle={-270}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Pie>
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Schema health field bar chart ────────────────────────────────────────────

export function SchemaHealthChart({ fields }: { fields: ProblematicField[] }) {
  if (fields.length === 0) return <p className="text-xs text-slate-400 py-2">All fields used consistently.</p>;
  const data = fields.slice(0, 10).map((f) => ({
    label: `${f.fieldName} (${f.categoryName})`,
    rate: Math.round(f.fillRate * 100),
  }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(100, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 36, top: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "#f8fafc" }}
          formatter={(v: unknown) => [`${v}%`, "Fill rate"]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Bar dataKey="rate" radius={[0, 4, 4, 0]} maxBarSize={16} fill="#f43f5e" />
      </BarChart>
    </ResponsiveContainer>
  );
}
