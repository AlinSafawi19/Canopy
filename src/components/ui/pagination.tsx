import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PerPageSelector } from "./per-page-selector";
import { cn } from "@/lib/utils";

interface Props {
  total: number;
  page: number;
  limit: number;
  basePath: string;
  extraParams?: Record<string, string>;
  pageParam?: string;
  limitParam?: string;
  className?: string;
}

function pageHref(basePath: string, p: number, limit: number, extra?: Record<string, string>, pageParam = "page", limitParam = "limit") {
  const params = new URLSearchParams(extra ?? {});
  params.set(pageParam, String(p));
  params.set(limitParam, String(limit));
  return `${basePath}?${params}`;
}

function getPages(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const delta = 2;
  const range: (number | null)[] = [];
  let last = 0;
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= delta) {
      if (last && i - last > 1) range.push(null);
      range.push(i);
      last = i;
    }
  }
  return range;
}

const btnBase =
  "inline-flex items-center justify-center w-8 h-8 rounded-md text-sm border transition-colors";

export function Pagination({ total, page, limit, basePath, extraParams, pageParam = "page", limitParam = "limit", className }: Props) {
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = Math.min((page - 1) * limit + 1, total);
  const to = Math.min(page * limit, total);
  const pages = getPages(page, totalPages);

  return (
    <div className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 py-2 sm:py-3", className)}>
      {/* Left: rows per page + total */}
      <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 order-2 sm:order-1">
        <span>Rows per page:</span>
        <PerPageSelector limit={limit} basePath={basePath} extraParams={extraParams} pageParam={pageParam} limitParam={limitParam} />
        <span className="text-slate-300 select-none">·</span>
        <span className="font-medium text-slate-700">{total.toLocaleString()}</span>
        <span>total</span>
      </div>

      {/* Right: showing range + page nav */}
      <div className="flex items-center gap-2 sm:gap-3 order-1 sm:order-2">
        <span className="text-xs sm:text-sm text-slate-500">
          {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
        </span>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            {page > 1 ? (
              <Link
                href={pageHref(basePath, page - 1, limit, extraParams, pageParam, limitParam)}
                className={`${btnBase} border-slate-200 text-slate-600 hover:bg-slate-50`}
              >
                <ChevronLeft size={15} />
              </Link>
            ) : (
              <span className={`${btnBase} border-slate-200 text-slate-300 cursor-not-allowed`}>
                <ChevronLeft size={15} />
              </span>
            )}

            {pages.map((p, i) =>
              p === null ? (
                <span
                  key={`ell-${i}`}
                  className="inline-flex items-center justify-center w-8 h-8 text-slate-400 text-sm"
                >
                  …
                </span>
              ) : p === page ? (
                <span
                  key={p}
                  className={`${btnBase} border-indigo-600 bg-indigo-600 text-white font-medium`}
                >
                  {p}
                </span>
              ) : (
                <Link
                  key={p}
                  href={pageHref(basePath, p, limit, extraParams, pageParam, limitParam)}
                  className={`${btnBase} border-slate-200 text-slate-700 hover:bg-slate-50`}
                >
                  {p}
                </Link>
              )
            )}

            {page < totalPages ? (
              <Link
                href={pageHref(basePath, page + 1, limit, extraParams, pageParam, limitParam)}
                className={`${btnBase} border-slate-200 text-slate-600 hover:bg-slate-50`}
              >
                <ChevronRight size={15} />
              </Link>
            ) : (
              <span className={`${btnBase} border-slate-200 text-slate-300 cursor-not-allowed`}>
                <ChevronRight size={15} />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
