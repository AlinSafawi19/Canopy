import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: "indigo" | "emerald" | "amber" | "rose" | "sky";
  className?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  color = "indigo",
  className,
}: StatCardProps) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    sky: "bg-sky-50 text-sky-600",
  };

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-start gap-4",
        className
      )}
    >
      <div className={cn("p-3 rounded-xl", colors[color])}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
