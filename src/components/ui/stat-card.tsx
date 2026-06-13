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
        "bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6 flex items-start gap-3 sm:gap-4",
        className
      )}
    >
      <div className={cn("p-2 sm:p-3 rounded-xl shrink-0", colors[color])}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-xs sm:text-sm text-slate-500 truncate">{title}</p>
        <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
