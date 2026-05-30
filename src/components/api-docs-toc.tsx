"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const TOC_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "authentication", label: "Authentication" },
  { id: "endpoints", label: "Endpoints" },
  { id: "get-projects", label: "GET /projects" },
  { id: "get-project", label: "GET /{projectSlug}" },
  { id: "get-category", label: "GET /…/{categorySlug}" },
  { id: "errors", label: "Error Responses" },
  { id: "examples", label: "Code Examples" },
  { id: "cors", label: "CORS" },
];

export function ApiDocsToc() {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    TOC_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(id);
        },
        { rootMargin: "0px 0px -70% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    const lastId = TOC_ITEMS[TOC_ITEMS.length - 1].id;
    function onScroll() {
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      if (atBottom) setActive(lastId);
    }
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observers.forEach((o) => o.disconnect());
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <nav className="space-y-0.5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2 mb-3">On this page</p>
      {TOC_ITEMS.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            setActive(id);
          }}
          className={cn(
            "block px-2 py-1 text-sm rounded transition-colors truncate",
            id.startsWith("get-") ? "pl-4" : "",
            active === id
              ? "text-indigo-600 font-medium bg-indigo-50"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          )}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
