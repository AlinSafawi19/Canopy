"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

interface Props {
  value: string;
  placeholder?: string;
  basePath: string;
  extraParams?: Record<string, string>;
  searchParam?: string;
  pageParam?: string;
}

export function SearchInput({ value, placeholder = "Search…", basePath, extraParams, searchParam = "search", pageParam = "page" }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  function navigate(q: string) {
    const params = new URLSearchParams(extraParams ?? {});
    if (q) params.set(searchParam, q);
    else params.delete(searchParam);
    params.set(pageParam, "1");
    router.replace(`${basePath}?${params}`, { scroll: false });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => navigate(q), 300);
  }

  function handleClear() {
    setQuery("");
    navigate("");
  }

  return (
    <div className="relative">
      <Search
        size={14}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none sm:left-3 sm:size-4"
      />
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        className="h-8 sm:h-9 w-full sm:w-64 rounded-lg border border-slate-200 bg-white pl-8 sm:pl-9 pr-7 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
