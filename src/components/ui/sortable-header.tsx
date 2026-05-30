import Link from "next/link";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface Props {
  label: string;
  field: string;
  sortBy: string;
  sortDir: "asc" | "desc";
  basePath: string;
  extraParams?: Record<string, string>;
  sortByParam?: string;
  sortDirParam?: string;
  pageParam?: string;
}

export function SortableHeader({ label, field, sortBy, sortDir, basePath, extraParams, sortByParam = "sortBy", sortDirParam = "sortDir", pageParam = "page" }: Props) {
  const isActive = sortBy === field;
  const nextDir = isActive && sortDir === "asc" ? "desc" : "asc";

  const params = new URLSearchParams(extraParams ?? {});
  params.set(sortByParam, field);
  params.set(sortDirParam, nextDir);
  params.delete(pageParam);

  return (
    <Link
      href={`${basePath}?${params}`}
      className="flex items-center gap-1 group whitespace-nowrap hover:text-slate-900 transition-colors"
    >
      <span>{label}</span>
      {isActive ? (
        sortDir === "asc" ? (
          <ChevronUp size={13} className="text-indigo-500 shrink-0" />
        ) : (
          <ChevronDown size={13} className="text-indigo-500 shrink-0" />
        )
      ) : (
        <ChevronsUpDown size={13} className="text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
      )}
    </Link>
  );
}
