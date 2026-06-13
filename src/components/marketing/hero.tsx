"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard, FolderKanban, Users, Archive, ScrollText, Code2,
  Settings, LogOut, Building2, ChevronRight, ChevronLeft, ChevronDown,
  ChevronsUpDown, ExternalLink, Search, ArrowLeft, MessageSquare, Activity, Pencil,
  Webhook, Download, Upload, Columns, Columns3, Menu,
  User, Key, Globe, Server, GitBranch, UserPlus, Copy, Trash2, Mail,
  Gift, CreditCard, ShieldCheck, Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ── Scaled-down static replicas ───────────────────────────────────────────────

function MockSearch({ placeholder }: { placeholder: string }) {
  return (
    <div className="relative pointer-events-none select-none flex-shrink-0">
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <div className="h-8 w-52 rounded-lg border border-slate-200 bg-white pl-8 pr-6 text-xs text-slate-400 flex items-center">
        {placeholder}
      </div>
    </div>
  );
}

function SortHead({ label, active }: { label: string; active?: boolean }) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      {label}
      {active
        ? <ChevronDown size={11} className="text-indigo-500 shrink-0" />
        : <ChevronsUpDown size={11} className="text-slate-300 shrink-0" />}
    </span>
  );
}

const pbtn = "inline-flex items-center justify-center w-7 h-7 rounded-md text-xs border";

function MockPagination({ total, limit, multiPage }: { total: number; limit: number; multiPage?: boolean }) {
  if (total === 0) return null;
  const to = Math.min(limit, total);
  return (
    <div className="flex items-center justify-between gap-3 py-2 pointer-events-none select-none">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <span>Rows per page:</span>
        <span className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-900">
          {limit}<ChevronDown size={10} className="text-slate-400 shrink-0" />
        </span>
        <span className="text-slate-300">·</span>
        <span className="font-medium text-slate-700">{total}</span>
        <span>total</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">1–{to} of {total}</span>
        {multiPage && (
          <div className="flex items-center gap-0.5">
            <span className={`${pbtn} border-slate-200 text-slate-300 cursor-not-allowed`}><ChevronLeft size={13} /></span>
            <span className={`${pbtn} border-indigo-600 bg-indigo-600 text-white font-medium`}>1</span>
            <span className={`${pbtn} border-slate-200 text-slate-700`}>2</span>
            <span className={`${pbtn} border-slate-200 text-slate-600`}><ChevronRight size={13} /></span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Data ─────────────────────────────────────────────────────────────────────

const PROJECTS = [
  { name: "Canopy Website", slug: "canopy-website", status: "live",        variant: "success" as const, cats: 4, domain: "canopy.app",      updated: "Jun 2025" },
  { name: "Mobile App",     slug: "mobile-app",     status: "live", variant: "success" as const, cats: 2, domain: null,               updated: "Jun 2025" },
  { name: "API Docs",       slug: "api-docs",       status: "live",        variant: "success" as const, cats: 1, domain: "docs.canopy.app",  updated: "May 2025" },
];

const ENTRIES = [
  { slug: "introducing-canopy-2-0",  title: "Introducing Canopy 2.0",  date: "Jun 3, 2025",  content: "We're excited to announce the release of Canopy 2.0 with major new features…" },
  { slug: "building-with-the-api",   title: "Building with the API",   date: "Jun 1, 2025",  content: "Learn how to integrate Canopy into your existing workflow using our REST API…" },
  { slug: "team-collaboration-tips", title: "Team collaboration tips", date: "May 28, 2025", content: "Discover the best practices for managing a team of writers and editors…" },
];

const CATEGORIES = [
  { name: "Blog Posts",   slug: "blog-posts",   entries: ENTRIES.length },
  { name: "Case Studies", slug: "case-studies", entries: 5  },
  { name: "Team Members", slug: "team-members", entries: 8  },
  { name: "Features",     slug: "features",     entries: 4  },
];

type AppScreen = "projects" | "project-detail" | "entries";

// ── Component ─────────────────────────────────────────────────────────────────

export function HeroSection() {
  const heroRef          = useRef<HTMLElement>(null);
  const mockupRef        = useRef<HTMLDivElement>(null);
  const tableScrollRef         = useRef<HTMLDivElement>(null);
  const contentScrollRef       = useRef<HTMLDivElement>(null);
  const mobileContentScrollRef = useRef<HTMLDivElement>(null);

  const [screen,         setScreen]         = useState<AppScreen>("projects");
  const [fading,         setFading]         = useState(false);
  const [clickRow,       setClickRow]       = useState<number | null>(null);
  const [cursorPos,      setCursorPos]      = useState<{ x: number; y: number } | null>(null);
  const [cursorClicking, setCursorClicking] = useState(false);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const orbs = hero.querySelectorAll<HTMLElement>("[data-orb]");
    const onMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx, dy = (e.clientY - cy) / cy;
      orbs.forEach((orb) => {
        const s = parseFloat(orb.dataset.orb ?? "1");
        orb.style.transform = `translate(${dx * s * 16}px, ${dy * s * 16}px)`;
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    const CYCLE = 13500;
    let timers: ReturnType<typeof setTimeout>[] = [];

    function moveTo(target: string) {
      const container = mockupRef.current;
      if (!container) return;
      const el = container.querySelector<HTMLElement>(`[data-cursor="${target}"]`);
      if (!el) return;
      const cr = container.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      setCursorPos({ x: er.left - cr.left + er.width / 2, y: er.top - cr.top + er.height / 2 });
    }

    function startCycle() {
      if (tableScrollRef.current)         tableScrollRef.current.scrollLeft = 0;
      if (contentScrollRef.current)       contentScrollRef.current.scrollTop = 0;
      if (mobileContentScrollRef.current) mobileContentScrollRef.current.scrollTop = 0;
      const container = mockupRef.current;
      if (container) {
        const cr = container.getBoundingClientRect();
        setCursorPos({ x: cr.width * 0.52, y: cr.height * 0.52 });
      }
      timers = [
        setTimeout(() => moveTo("projects-open-0"),                                                      2000),
        setTimeout(() => { setCursorClicking(true);  setClickRow(0); },                                 2700),
        setTimeout(() => { setCursorClicking(false); setFading(true); },                                 3100),
        setTimeout(() => { setScreen("project-detail"); setClickRow(null); setFading(false); },          3500),

        // Scroll project-detail page all the way down (categories at bottom = cursor target still visible)
        setTimeout(() => contentScrollRef.current?.scrollTo({ top: 9999, behavior: "smooth" }),          4200),
        setTimeout(() => mobileContentScrollRef.current?.scrollTo({ top: 9999, behavior: "smooth" }),    4200),

        setTimeout(() => moveTo("detail-manage-0"),                                                      6500),
        setTimeout(() => { setCursorClicking(true);  setClickRow(0); },                                 7100),
        setTimeout(() => { setCursorClicking(false); setFading(true); },                                 7500),
        setTimeout(() => { setScreen("entries"); setClickRow(null); setFading(false); },                7900),

        // Scroll the entries table right, then back
        setTimeout(() => tableScrollRef.current?.scrollTo({ left: 260, behavior: "smooth" }),           9000),
        setTimeout(() => tableScrollRef.current?.scrollTo({ left: 0,   behavior: "smooth" }),          10800),

        setTimeout(() => setFading(true),                                                               11900),
        setTimeout(() => { setScreen("projects"); setClickRow(null); setFading(false); },              12300),
      ];
    }

    startCycle();
    const interval = setInterval(() => {
      timers.forEach(clearTimeout);
      setScreen("projects"); setClickRow(null); setFading(false); setCursorClicking(false);
      startCycle();
    }, CYCLE);

    return () => { timers.forEach(clearTimeout); clearInterval(interval); };
  }, []);

  const urlPath: Record<AppScreen, string> = {
    projects:         "/admin/projects",
    "project-detail": "/admin/projects/canopy-website",
    entries:          "/admin/projects/canopy-website/blog-posts",
  };

  return (
    <section
      ref={heroRef}
      id="hero"
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-white to-slate-50 pt-20 sm:pt-32"
      aria-labelledby="hero-heading"
    >
      <div className="absolute inset-0 mk-grid pointer-events-none" aria-hidden="true" />
      <div data-orb="1.4" aria-hidden="true" className="absolute top-[0%] left-[-5%] w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(99,102,241,0.07) 0%, rgba(139,92,246,0.04) 50%, transparent 70%)", filter: "blur(72px)", transition: "transform 0.3s ease" }} />
      <div data-orb="0.9" aria-hidden="true" className="absolute bottom-[5%] right-[-5%] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(124,58,237,0.06) 0%, rgba(99,102,241,0.03) 50%, transparent 70%)", filter: "blur(72px)", transition: "transform 0.3s ease" }} />

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full flex flex-col items-center">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">

          <h1 id="hero-heading" className="text-5xl sm:text-6xl lg:text-[4.5rem] font-extrabold text-slate-900 tracking-tight leading-[1.08] mb-7" style={{ animation: "mk-fade-up 0.55s 0.08s ease both" }}>
            Where teams{" "}<span className="mk-gradient-text">create,</span>
            <br className="hidden sm:block" />{" "}collaborate,<br />and{" "}<span className="mk-gradient-text">publish.</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mb-6 sm:mb-10" style={{ animation: "mk-fade-up 0.55s 0.16s ease both" }}>
            Canopy gives every member of your team a structured workspace with role‑based
            access, real‑time collaboration, and approval workflows. From first draft to final publish.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5" style={{ animation: "mk-fade-up 0.55s 0.24s ease both" }}>
            <Link href="/signup" className="inline-flex items-center justify-center gap-2 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              Start for free
            </Link>
            <Link href="/login" className="inline-flex items-center justify-center w-full sm:w-auto border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-medium px-5 py-2.5 rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400">
              Sign in
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-8 text-slate-400 text-xs" style={{ animation: "mk-fade-up 0.55s 0.32s ease both" }}>
            {([
              { label: "Completely free",         Icon: Gift        },
              { label: "No credit card required", Icon: CreditCard  },
              { label: "No hidden fees",          Icon: ShieldCheck },
              { label: "Setup in 2 minutes",      Icon: Zap         },
            ] as const).map(({ label, Icon }) => (
              <span key={label} className="flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Mobile phone mockup ── shown below sm ───────────────────── */}
        <div className="sm:hidden flex justify-center pb-4" style={{ animation: "mk-fade-up 0.8s 0.4s ease both" }}>
          <div className="relative" style={{ width: 290 }}>
            {/* Volume / power buttons */}
            <div className="absolute -left-[5px] top-[68px]  w-[5px] h-6  bg-slate-700 rounded-l-md" />
            <div className="absolute -left-[5px] top-[104px] w-[5px] h-10 bg-slate-700 rounded-l-md" />
            <div className="absolute -left-[5px] top-[152px] w-[5px] h-10 bg-slate-700 rounded-l-md" />
            <div className="absolute -right-[5px] top-[100px] w-[5px] h-14 bg-slate-700 rounded-r-md" />

            {/* Phone body */}
            <div className="bg-slate-900 rounded-[44px] p-[10px] shadow-2xl ring-1 ring-white/10">
              {/* Screen */}
              <div className="bg-white rounded-[36px] overflow-hidden flex flex-col pointer-events-none select-none" style={{ height: 590 }}>

                {/* Status bar + Dynamic Island */}
                <div className="bg-black flex items-center px-5 pt-3 pb-1.5 flex-shrink-0 relative z-10">
                  <span className="text-white text-[12px] font-semibold leading-none">9:41</span>
                  <div className="absolute left-1/2 top-2 -translate-x-1/2 w-[100px] h-[32px] bg-black rounded-full" />
                  <div className="ml-auto flex items-center gap-[5px]">
                    <svg width="17" height="12" viewBox="0 0 17 12" fill="white" aria-hidden="true">
                      <rect x="0"   y="8"   width="3" height="4"  rx="0.8"/>
                      <rect x="4.5" y="5.5" width="3" height="6.5" rx="0.8"/>
                      <rect x="9"   y="3"   width="3" height="9"  rx="0.8"/>
                      <rect x="13.5" y="0"  width="3" height="12" rx="0.8" opacity="0.3"/>
                    </svg>
                    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true">
                      <circle cx="8" cy="10.5" r="1.3" fill="white"/>
                      <path d="M4.8 7.2 Q8 4.5 11.2 7.2"  stroke="white" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
                      <path d="M2.2 4.5 Q8 -0.2 13.8 4.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
                    </svg>
                    <div className="flex items-center gap-0.5">
                      <div className="w-[23px] h-[11px] rounded-[2.5px] border border-white/60 p-[1.5px]">
                        <div className="h-full w-[80%] bg-white rounded-[1px]" />
                      </div>
                      <div className="w-[2px] h-[5px] bg-white/50 rounded-r-sm" />
                    </div>
                  </div>
                </div>

                {/* Safari address bar */}
                <div className="bg-[#f2f2f7] px-3 pt-2 pb-2 flex-shrink-0">
                  <div className="bg-white rounded-[10px] px-3 py-[7px] flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-3 h-3 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <span className="flex-1 text-center text-[11px] text-slate-800 truncate leading-none">
                      canopy-production-7f21.up.railway.app<span className="transition-all duration-300">{urlPath[screen]}</span>
                    </span>
                    <svg viewBox="0 0 24 24" className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/>
                    </svg>
                  </div>
                </div>

                {/* App shell */}
                <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 min-h-0">
                  {/* App header */}
                  <header className="bg-white border-b border-slate-200 h-10 flex items-center justify-between px-3 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <Menu size={15} className="text-slate-500" />
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-md bg-indigo-600 flex items-center justify-center flex-shrink-0">
                          <svg viewBox="0 0 32 32" className="w-2.5 h-2.5" fill="none" aria-hidden="true">
                            <path d="M5 22 Q16 8 27 22" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                            <path d="M9 27 Q16 17 23 27" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                          </svg>
                        </div>
                        <span className="text-xs font-semibold tracking-wide text-slate-900">Canopy</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <div className="relative p-1.5 text-slate-500">
                        <MessageSquare size={12} />
                        <span className="absolute -top-0.5 -right-0.5 flex h-3 min-w-3 px-0.5 items-center justify-center rounded-full bg-amber-500 text-white text-[7px] font-bold leading-none">2</span>
                      </div>
                      <div className="inline-flex items-center gap-0.5 font-medium rounded-lg text-[9px] px-1.5 py-1 text-slate-600">
                        <LogOut size={9} />Sign out
                      </div>
                    </div>
                  </header>

                  {/* Page */}
                  <div ref={mobileContentScrollRef} className="flex-1 min-h-0 p-2.5 overflow-y-auto" style={{ opacity: fading ? 0 : 1, transition: "opacity 0.3s ease" }}>

                    {/* ── Projects ── mirrors /admin/projects/page.tsx */}
                    {screen === "projects" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <h2 className="text-base font-bold text-slate-900">Projects</h2>
                          <p className="text-[11px] text-slate-500">Manage your workspace projects</p>
                          <Button variant="primary" size="sm">New Project</Button>
                        </div>
                        <Card>
                          <CardHeader className="px-3 py-3">
                            {/* Same flex justify-between flex-wrap as real CardHeader */}
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <CardTitle className="text-sm">All Projects ({PROJECTS.length})</CardTitle>
                              <div className="relative flex-shrink-0">
                                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                <div className="h-7 w-32 rounded-lg border border-slate-200 bg-white pl-6 pr-2 text-[10px] text-slate-400 flex items-center">Search projects…</div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-0">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-2.5 py-2 text-left whitespace-nowrap">
                                      <SortHead label="Name" active />
                                    </th>
                                    <th className="px-2.5 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Slug</th>
                                    <th className="px-2.5 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                                    <th className="px-2.5 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Cats</th>
                                    <th className="px-2.5 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap sticky right-0 bg-slate-50">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {PROJECTS.map((p, i) => (
                                    <tr key={p.name} className="border-b border-slate-100">
                                      <td className="px-2.5 py-2 min-w-[80px]">
                                        <span className="text-[11px] font-medium text-slate-900">{p.name}</span>
                                      </td>
                                      <td className="px-2.5 py-2 min-w-[60px] max-w-[70px]">
                                        <span className="block truncate text-[10px] text-slate-500">{p.slug}</span>
                                      </td>
                                      <td className="px-2.5 py-2 whitespace-nowrap">
                                        <Badge variant={p.variant}>{p.status}</Badge>
                                      </td>
                                      <td className="px-2.5 py-2 text-[11px] text-slate-700">{p.cats}</td>
                                      <td className="px-2.5 py-2 sticky right-0 bg-white">
                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant={clickRow === i ? "primary" : "outline"}
                                            size="sm"
                                            className={`text-[10px] h-6 px-2 ${clickRow === i ? "scale-95" : ""}`}
                                            data-cursor={i === 0 ? "mob-projects-open-0" : undefined}
                                          >Open</Button>
                                          <span className="text-slate-400 text-[10px] leading-none">···</span>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="px-3 py-2 pointer-events-none select-none">
                              <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] text-slate-500">
                                <div className="flex items-center gap-1.5">
                                  <span>Rows per page:</span>
                                  <span className="inline-flex items-center gap-0.5 rounded-lg border border-slate-300 bg-white px-1.5 py-0.5">20 <ChevronDown size={9} className="text-slate-400" /></span>
                                  <span className="text-slate-300">·</span>
                                  <span className="font-medium text-slate-700">{PROJECTS.length}</span>
                                  <span>total</span>
                                </div>
                                <span>1–{PROJECTS.length} of {PROJECTS.length}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {/* ── Project detail ── mirrors /admin/projects/[id]/page.tsx */}
                    {screen === "project-detail" && (
                      <div className="space-y-3">
                        {/* Header: flex flex-wrap items-start gap-2 sm:gap-3 */}
                        <div className="flex flex-wrap items-start gap-2">
                          <Button variant="outline" size="sm" className="gap-1 text-[10px] h-6 px-2 shrink-0">
                            <ArrowLeft size={11}/>Projects
                          </Button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h2 className="text-sm font-bold text-slate-900 truncate">Canopy Website</h2>
                              <Badge variant="success">live</Badge>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">A modern content platform for creative teams</p>
                          </div>
                          <div className="flex items-center gap-1.5 w-full">
                            <Button variant="outline" className="gap-1 text-[10px] h-7 px-2">
                              <Activity size={11}/>Health
                            </Button>
                            <Button variant="outline" className="gap-1 text-[10px] h-7 px-2">
                              <Pencil size={11}/>Edit
                            </Button>
                          </div>
                        </div>

                        {/* Assigned Client — same structure as real */}
                        <Card>
                          <CardHeader className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <User size={13} className="text-slate-400" />
                              <CardTitle className="text-xs">Assigned Client</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="px-3 pb-3 pt-1">
                            <Button variant="outline" size="sm" className="gap-1 text-[10px] h-6 px-2">
                              <UserPlus size={11}/>Assign client
                            </Button>
                          </CardContent>
                        </Card>

                        {/* Details meta — grid-cols-2 same as real */}
                        <div className="grid grid-cols-2 gap-2">
                          <Card><CardContent className="px-3 py-2.5">
                            <p className="text-[9px] text-slate-500 mb-0.5">Slug</p>
                            <p className="text-[10px] font-medium text-slate-800 truncate">canopy-website</p>
                          </CardContent></Card>
                          <Card><CardContent className="px-3 py-2.5">
                            <p className="text-[9px] text-slate-500 mb-0.5">Industry</p>
                            <p className="text-[10px] font-medium text-slate-800">SaaS</p>
                          </CardContent></Card>
                        </div>

                        {/* Public API */}
                        <Card>
                          <CardHeader className="px-3 py-2.5 space-y-2">
                            <div className="flex items-center gap-1.5">
                              <Key size={13} className="text-slate-400" />
                              <CardTitle className="text-xs">Public API</CardTitle>
                            </div>
                            <div className="flex items-center gap-2 w-full">
                              <div className="relative flex-1">
                                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                <div className="h-7 w-full rounded-lg border border-slate-200 bg-white pl-6 pr-2 text-[10px] text-slate-400 flex items-center">Search keys…</div>
                              </div>
                              <Button variant="outline" size="sm" className="shrink-0 text-[10px] h-6 px-2">New Key</Button>
                            </div>
                          </CardHeader>
                          <CardContent className="p-0">
                            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/60 space-y-1">
                              <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide">Endpoints</p>
                              {[
                                { label: "All projects",  url: "cms.canopy.app/api/v1/projects" },
                                { label: "This project",  url: "cms.canopy.app/api/v1/canopy-website" },
                                { label: "Category data", url: "cms.canopy.app/api/v1/canopy-website/[slug]" },
                              ].map(({ label, url }) => (
                                <div key={label} className="flex items-center gap-1.5 py-0.5 border-b border-slate-100 last:border-0">
                                  <span className="text-[9px] text-slate-500 w-16 shrink-0">{label}</span>
                                  <code className="flex-1 text-[9px] font-mono text-slate-700 truncate">{url}</code>
                                  <Copy size={9} className="text-slate-400 shrink-0" />
                                </div>
                              ))}
                            </div>
                            <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
                              <span className="text-[10px] font-medium text-slate-900 shrink-0">Production</span>
                              <code className="flex-1 text-[9px] font-mono text-slate-600 bg-slate-50 border border-slate-200 px-1 py-0.5 rounded truncate">cms_9f3a••••••••</code>
                              <Trash2 size={10} className="text-slate-400 shrink-0" />
                            </div>
                            <div className="px-3 py-2 pointer-events-none select-none">
                              <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] text-slate-500">
                                <div className="flex items-center gap-1.5">
                                  <span>Rows per page:</span>
                                  <span className="inline-flex items-center gap-0.5 rounded-lg border border-slate-300 bg-white px-1.5 py-0.5">20 <ChevronDown size={9} className="text-slate-400" /></span>
                                  <span className="text-slate-300">·</span>
                                  <span className="font-medium text-slate-700">1</span>
                                  <span>total</span>
                                </div>
                                <span>1–1 of 1</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Content Categories — same structure as real */}
                        <Card>
                          <CardHeader className="px-3 py-2.5">
                            <div className="flex items-center justify-between gap-3 w-full flex-wrap">
                              <CardTitle className="text-xs">Content Categories ({CATEGORIES.length})</CardTitle>
                              <div className="flex items-center justify-between gap-2 w-full">
                                <div className="relative flex-1">
                                  <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                  <div className="h-7 w-full rounded-lg border border-slate-200 bg-white pl-6 pr-2 text-[10px] text-slate-400 flex items-center">Search categories…</div>
                                </div>
                                <Button variant="primary" size="sm" className="shrink-0 text-[10px] h-6 px-2">Add Category</Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-0">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="px-2.5 py-2"><SortHead label="Name" active /></TableHead>
                                  <TableHead className="px-2.5 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Slug</TableHead>
                                  <TableHead className="px-2.5 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Entries</TableHead>
                                  <TableHead className="px-2.5 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider sticky right-0 bg-slate-50">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {CATEGORIES.map((c, i) => (
                                  <TableRow key={c.name}>
                                    <TableCell className="px-2.5 py-2 font-medium text-slate-900 text-[11px]">{c.name}</TableCell>
                                    <TableCell className="px-2.5 py-2 max-w-[55px]">
                                      <span className="block truncate text-[10px] text-slate-500">{c.slug}</span>
                                    </TableCell>
                                    <TableCell className="px-2.5 py-2 text-[11px] text-slate-700">{c.entries}</TableCell>
                                    <TableCell className="px-2.5 py-2 sticky right-0 bg-white">
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant={clickRow === i ? "primary" : "outline"}
                                          size="sm"
                                          className={`text-[10px] h-6 px-2 ${clickRow === i ? "scale-95" : ""}`}
                                          data-cursor={i === 0 ? "mob-detail-manage-0" : undefined}
                                        >Manage</Button>
                                        <span className="text-slate-400 text-[10px] leading-none">···</span>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            <div className="px-3 py-2 pointer-events-none select-none">
                              <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] text-slate-500">
                                <div className="flex items-center gap-1.5">
                                  <span>Rows per page:</span>
                                  <span className="inline-flex items-center gap-0.5 rounded-lg border border-slate-300 bg-white px-1.5 py-0.5">20 <ChevronDown size={9} className="text-slate-400" /></span>
                                  <span className="text-slate-300">·</span>
                                  <span className="font-medium text-slate-700">{CATEGORIES.length}</span>
                                  <span>total</span>
                                </div>
                                <span>1–{CATEGORIES.length} of {CATEGORIES.length}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {/* ── Entries ── mirrors /admin/projects/[id]/categories/[catId]/page.tsx */}
                    {screen === "entries" && (
                      <div className="space-y-3">
                        {/* Header: flex items-start gap-3 flex-wrap same as real */}
                        <div className="flex items-start gap-2 flex-wrap">
                          <Button variant="outline" size="sm" className="gap-1 text-[10px] h-6 px-2 shrink-0">
                            <ArrowLeft size={11}/>Canopy Website
                          </Button>
                          <div className="flex-1 min-w-0">
                            <h2 className="text-base font-bold text-slate-900">Blog Posts</h2>
                          </div>
                          {/* Action buttons: grid grid-cols-2 on mobile, same as real page */}
                          <div className="grid grid-cols-2 gap-1.5 w-full">
                            <Button variant="outline" size="sm" className="gap-1 text-[10px] h-7 justify-center">
                              <Webhook size={11}/>Webhooks
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1 text-[10px] h-7 justify-center">
                              <Download size={11}/>Export<ChevronDown size={9}/>
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1 text-[10px] h-7 justify-center">
                              <Upload size={11}/>Import
                            </Button>
                            <Button variant="primary" size="sm" className="text-[10px] h-7 justify-center">
                              New Row
                            </Button>
                            {/* col-span-2 same as real ManageSchemaButton wrapper */}
                            <div className="col-span-2">
                              <Button variant="outline" size="sm" className="gap-1 text-[10px] h-7 w-full justify-center">
                                <Columns size={11}/>Manage Columns<span className="ml-0.5 text-[9px] text-slate-400">(4)</span>
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Entries card */}
                        <Card className="overflow-hidden">
                          <CardHeader className="px-3 py-2.5 border-b border-slate-100">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <CardTitle className="text-xs">{ENTRIES.length} entries</CardTitle>
                              <div className="relative flex-shrink-0">
                                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                <div className="h-7 w-28 rounded-lg border border-slate-200 bg-white pl-6 pr-2 text-[10px] text-slate-400 flex items-center">Search…</div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-0">
                            {/* Columns toolbar — same as EntriesTable */}
                            <div className="flex items-center justify-end px-3 py-2 border-b border-slate-100 bg-white">
                              <button className="inline-flex items-center gap-1 px-2 py-1.5 text-[10px] font-medium rounded border text-slate-600 bg-white border-slate-200">
                                <Columns3 size={11}/>Columns
                              </button>
                            </div>
                            {/* Table — same structure as EntriesTable */}
                            <div ref={tableScrollRef} className="overflow-x-auto">
                              <table className="w-full text-sm border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="w-6 px-2 py-2 border-r border-slate-200 sticky left-0 bg-slate-50 z-10">
                                      <input type="checkbox" readOnly className="w-3 h-3 rounded border-slate-300 accent-indigo-600 pointer-events-none" />
                                    </th>
                                    <th className="w-6 px-2 py-2 text-left border-r border-slate-200 sticky left-6 bg-slate-50 z-10">
                                      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 uppercase"># <ChevronDown size={9} className="text-indigo-500" /></span>
                                    </th>
                                    {[
                                      { label: "Slug",    type: "text",      color: "text-violet-500" },
                                      { label: "Title",   type: "text",      color: "text-violet-500" },
                                      { label: "Date",    type: "date",      color: "text-emerald-500" },
                                      { label: "Content", type: "rich_text", color: "text-purple-600" },
                                    ].map(({ label, type, color }) => (
                                      <th key={label} className="px-2.5 py-2 text-left border-r border-slate-200 whitespace-nowrap min-w-[100px]">
                                        <div className="flex flex-col gap-0.5">
                                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
                                          <span className={`text-[9px] font-normal uppercase tracking-wide ${color}`}>{type}</span>
                                        </div>
                                      </th>
                                    ))}
                                    <th className="px-2.5 py-2 text-left border-r border-slate-200 whitespace-nowrap min-w-[65px]">
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Status</span>
                                        <span className="text-[9px] font-normal uppercase tracking-wide text-slate-400">system</span>
                                      </div>
                                    </th>
                                    <th className="px-2.5 py-2 text-left whitespace-nowrap sticky right-0 bg-slate-50 min-w-[80px]">
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Actions</span>
                                        <span className="text-[9px] font-normal uppercase tracking-wide text-slate-400">system</span>
                                      </div>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ENTRIES.map((e, i) => (
                                    <tr key={e.slug} className="border-b border-slate-100">
                                      <td className="px-2 py-2 border-r border-slate-100 sticky left-0 z-10 bg-white">
                                        <input type="checkbox" readOnly className="w-3 h-3 rounded border-slate-300 accent-indigo-600 pointer-events-none" />
                                      </td>
                                      <td className="px-2 py-2 text-center text-[10px] text-slate-400 border-r border-slate-100 sticky left-6 z-10 bg-white">{i + 1}</td>
                                      <td className="px-2.5 py-2 border-r border-slate-100 max-w-[100px]">
                                        <span className="block truncate text-[10px] text-slate-700">{e.slug}</span>
                                      </td>
                                      <td className="px-2.5 py-2 border-r border-slate-100 max-w-[100px]">
                                        <span className="block truncate text-[10px] text-slate-700">{e.title}</span>
                                      </td>
                                      <td className="px-2.5 py-2 border-r border-slate-100 whitespace-nowrap">
                                        <span className="text-[10px] text-slate-700">{e.date}</span>
                                      </td>
                                      <td className="px-2.5 py-2 border-r border-slate-100 max-w-[100px]">
                                        <span className="block truncate text-[10px] text-slate-700">{e.content}</span>
                                      </td>
                                      <td className="px-2.5 py-2 border-r border-slate-100">
                                        <Badge variant="success">Active</Badge>
                                      </td>
                                      <td className="px-2.5 py-2 sticky right-0 z-10 bg-white">
                                        <div className="flex items-center gap-0.5">
                                          <span className="inline-flex items-center gap-0.5 px-1 py-1 text-[9px] font-medium text-slate-600 rounded">
                                            <ExternalLink size={9}/>Preview
                                          </span>
                                          <Button size="sm" variant="ghost" className="text-[9px] h-5 px-1.5">Edit</Button>
                                          <span className="text-slate-400 text-[9px]">···</span>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="px-3 py-2 pointer-events-none select-none">
                              <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] text-slate-500">
                                <div className="flex items-center gap-1.5">
                                  <span>Rows per page:</span>
                                  <span className="inline-flex items-center gap-0.5 rounded-lg border border-slate-300 bg-white px-1.5 py-0.5">20 <ChevronDown size={9} className="text-slate-400" /></span>
                                  <span className="text-slate-300">·</span>
                                  <span className="font-medium text-slate-700">{ENTRIES.length}</span>
                                  <span>total</span>
                                </div>
                                <span>1–{ENTRIES.length} of {ENTRIES.length}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                  </div>
                </div>

                {/* Safari bottom toolbar */}
                <div className="bg-[#f2f2f7] border-t border-slate-200/80 flex items-center justify-around px-5 py-2.5 flex-shrink-0">
                  <ChevronLeft size={22} className="text-slate-400" />
                  <ChevronRight size={22} className="text-slate-300" />
                  <svg viewBox="0 0 24 24" className="w-[21px] h-[21px] text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                    <polyline points="16 6 12 2 8 6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                  <div className="w-[22px] h-[22px] rounded-[5px] border-[1.8px] border-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-600">1</div>
                  <svg viewBox="0 0 24 24" className="w-[21px] h-[21px] text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>

                {/* Home indicator */}
                <div className="bg-[#f2f2f7] pb-2 pt-1.5 flex justify-center flex-shrink-0">
                  <div className="w-28 h-1 bg-slate-800 rounded-full" />
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* ── Desktop browser mockup ── shown sm and above ──────────────── */}
        <div className="hidden sm:block relative w-full max-w-5xl mx-auto pb-4 sm:pb-10" style={{ animation: "mk-fade-up 0.8s 0.4s ease both" }}>
          <div ref={mockupRef} className="relative rounded-xl overflow-hidden border border-slate-200 shadow-md pointer-events-none select-none [&_*:focus]:outline-none [&_*:focus]:ring-0 [&_*:focus]:shadow-none">

            {/* Cursor */}
            {cursorPos && (
              <div className="absolute pointer-events-none z-50" style={{ left: cursorPos.x, top: cursorPos.y, transform: "translate(-3px, -2px)", transition: "left 0.55s cubic-bezier(0.4,0,0.2,1), top 0.55s cubic-bezier(0.4,0,0.2,1)" }}>
                {cursorClicking && <span className="absolute -inset-3 rounded-full bg-indigo-400/25" style={{ animation: "mk-ripple 0.4s ease-out forwards" }} />}
                <svg width="14" height="18" viewBox="0 0 14 18" fill="none" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.35))", transform: cursorClicking ? "scale(0.88)" : "scale(1)", transition: "transform 0.1s" }}>
                  <path d="M1.5 1.5 L1.5 14.5 L4.5 11.5 L7 17 L9 16 L6.5 10.5 L10.5 10.5 Z" fill="white" stroke="#1e293b" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
              </div>
            )}

            {/* Chrome */}
            <div className="bg-[#dee1e6] flex flex-col" aria-hidden="true">
              <div className="hidden sm:flex items-end px-2 pt-1.5 gap-0.5">
                <div className="flex items-center gap-1.5 bg-[#f1f3f4] rounded-t-lg px-3 py-1.5 text-[10px] text-slate-700 font-medium min-w-0 max-w-[180px]">
                  <div className="w-3 h-3 rounded-sm bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 32 32" className="w-2 h-2" fill="none"><path d="M5 22 Q16 8 27 22" stroke="white" strokeWidth="3.5" strokeLinecap="round" /><path d="M9 27 Q16 17 23 27" stroke="white" strokeWidth="2.5" strokeLinecap="round" /></svg>
                  </div>
                  <span className="truncate">Canopy</span>
                  <span className="ml-auto text-slate-400 text-[9px] pl-2 flex-shrink-0">✕</span>
                </div>
                <div className="flex items-center justify-center w-6 h-6 mb-0.5 text-slate-500 text-sm">+</div>
                <div className="ml-auto flex items-center mb-0.5">
                  {[
                    <svg key="min"   viewBox="0 0 10 1"  className="w-2.5 h-px"  fill="currentColor"><rect width="10" height="1"/></svg>,
                    <svg key="max"   viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="1"><rect x="0.5" y="0.5" width="9" height="9"/></svg>,
                    <svg key="close" viewBox="0 0 10 10" className="w-2.5 h-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>,
                  ].map((icon, i) => <div key={i} className={`w-8 h-6 flex items-center justify-center text-slate-600 ${i === 2 ? "rounded-tr-xl" : ""}`}>{icon}</div>)}
                </div>
              </div>
              <div className="bg-[#f1f3f4] flex items-center gap-1 px-2 py-1.5">
                <button className="hidden sm:flex w-6 h-6 items-center justify-center rounded-full text-slate-500"><svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg></button>
                <button className="hidden sm:flex w-6 h-6 items-center justify-center rounded-full text-slate-300"><svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg></button>
                <button className="hidden sm:flex w-6 h-6 items-center justify-center rounded-full text-slate-500"><svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg></button>
                <div className="flex-1 flex items-center gap-1.5 bg-white rounded-full px-3 py-1 mx-1 border border-black/10">
                  <svg viewBox="0 0 24 24" className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  <span className="text-[10px] text-slate-500 flex-1 truncate">canopy-production-7f21.up.railway.app<span className="text-slate-800 transition-all duration-300">{urlPath[screen]}</span></span>
                  <svg viewBox="0 0 24 24" className="hidden sm:block w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="12" r="4"/><path d="M10 12h12"/><path d="M19 12v3"/><path d="M16 12v2"/></svg>
                  <svg viewBox="0 0 24 24" className="hidden sm:block w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-white text-[8px] font-bold mx-0.5">A</div>
                  <div className="hidden sm:flex w-6 h-6 items-center justify-center text-slate-600"><svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg></div>
                </div>
              </div>
            </div>

            {/* App shell */}
            <div className="flex h-[380px] sm:h-[460px]" aria-hidden="true">

              {/* Sidebar — hidden below lg, matching real app's lg:translate-x-0 breakpoint */}
              <div className="w-52 bg-slate-900 border-r border-slate-800 flex-col flex-shrink-0 hidden lg:flex">
                <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-800 flex-shrink-0">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 32 32" className="w-3.5 h-3.5" fill="none"><path d="M5 22 Q16 8 27 22" stroke="white" strokeWidth="3" strokeLinecap="round" /><path d="M9 27 Q16 17 23 27" stroke="white" strokeWidth="2.5" strokeLinecap="round" /></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-xs truncate">Canopy</p>
                    <p className="text-slate-400 text-[10px] truncate">Admin</p>
                  </div>
                </div>
                <nav className="flex-1 overflow-hidden px-2 py-2 space-y-0.5">
                  {[
                    { label: "Dashboard",       Icon: LayoutDashboard, active: false, count: undefined },
                    { label: "Projects",        Icon: FolderKanban,    active: true,  count: PROJECTS.length },
                    { label: "Clients",         Icon: Users,           active: false, count: 4 },
                    { label: "Archive",         Icon: Archive,         active: false, count: 7 },
                    { label: "Logs",            Icon: ScrollText,      active: false, count: 24 },
                    { label: "API Integration", Icon: Code2,           active: false, count: undefined },
                  ].map(({ label, Icon, active, count }) => (
                    <div key={label} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium ${active ? "bg-indigo-600 text-white" : "text-slate-400"}`}>
                      <Icon size={13} className={`flex-shrink-0 ${active ? "text-white" : "text-slate-500"}`} />
                      <span className="flex-1 truncate">{label}</span>
                      {count !== undefined && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none tabular-nums flex-shrink-0 ${active ? "bg-indigo-500 text-indigo-100" : "bg-slate-800 text-slate-400"}`}>
                          {count}
                        </span>
                      )}
                      {active && <ChevronRight size={10} className="text-indigo-300 flex-shrink-0" />}
                    </div>
                  ))}
                </nav>
                <div className="px-2 py-2 border-t border-slate-800 space-y-0.5 flex-shrink-0">
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-400"><Settings size={13} className="flex-shrink-0 text-slate-500" /><span>Settings</span></div>
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-400"><LogOut size={13} className="flex-shrink-0 text-slate-500" /><span>Sign out</span></div>
                  <div className="flex items-center gap-2 px-2 py-2 mt-0.5">
                    <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0"><Building2 size={11} className="text-white" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-[10px] font-medium truncate">Alex Admin</p>
                      <p className="text-slate-500 text-[10px] truncate">@alexadmin</p>
                    </div>
                  </div>
                </div>
                <div className="px-3 py-2 border-t border-slate-800 flex-shrink-0">
                  <p className="text-[10px] text-slate-600 mb-1">Issue? Contact the platform owner</p>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Mail size={10} className="flex-shrink-0" />
                    <span className="truncate">owner@canopy.app</span>
                  </div>
                </div>
              </div>

              {/* Main */}
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 min-w-0">
                <header className="bg-white border-b border-slate-200 h-11 flex items-center justify-between px-4 flex-shrink-0">
                  {/* Left: hamburger + logo — shown when sidebar is hidden (below lg), matching real topbar */}
                  <div className="flex items-center gap-2">
                    <button className="p-1 rounded-lg text-slate-500 lg:hidden">
                      <Menu size={16} />
                    </button>
                    <div className="flex items-center gap-1.5 lg:hidden">
                      <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                        <svg viewBox="0 0 32 32" className="w-3 h-3" fill="none"><path d="M5 22 Q16 8 27 22" stroke="white" strokeWidth="3" strokeLinecap="round" /><path d="M9 27 Q16 17 23 27" stroke="white" strokeWidth="2.5" strokeLinecap="round" /></svg>
                      </div>
                      <span className="text-xs font-semibold tracking-wide text-slate-900">Canopy</span>
                    </div>
                  </div>
                  {/* Right: requests badge + sign out */}
                  <div className="flex items-center gap-0.5">
                    <button className="relative p-1.5 rounded-lg text-slate-500">
                      <MessageSquare size={13} />
                      <span className="absolute -top-0.5 -right-0.5 flex h-3 min-w-3 px-0.5 items-center justify-center rounded-full bg-amber-500 text-white text-[7px] font-bold leading-none">2</span>
                    </button>
                    <button className="inline-flex items-center gap-1 font-medium rounded-lg text-[10px] px-2 py-1 h-6 bg-transparent text-slate-600"><LogOut size={11} />Sign out</button>
                  </div>
                </header>

                {/* Page */}
                <div ref={contentScrollRef} className="flex-1 p-3 overflow-y-auto" style={{ opacity: fading ? 0 : 1, transition: "opacity 0.3s ease" }}>

                  {/* ── Projects ── mirrors /admin/projects/page.tsx */}
                  {screen === "projects" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-y-2">
                        <div>
                          <h2 className="text-base font-bold text-slate-900">Projects</h2>
                          <p className="text-slate-500 text-xs mt-0.5">Manage your workspace projects</p>
                        </div>
                        <Button variant="primary" size="sm">New Project</Button>
                      </div>
                      <Card>
                        <CardHeader className="px-3 py-2.5">
                          <div className="flex items-center justify-start gap-3 flex-wrap w-full">
                            <CardTitle className="text-sm">All Projects ({PROJECTS.length})</CardTitle>
                            <MockSearch placeholder="Search projects…" />
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="px-3 py-2"><SortHead label="Name" /></TableHead>
                                <TableHead className="hidden sm:table-cell px-3 py-2">Slug</TableHead>
                                <TableHead className="px-3 py-2">Status</TableHead>
                                <TableHead className="hidden sm:table-cell px-3 py-2">Categories</TableHead>
                                <TableHead className="hidden sm:table-cell px-3 py-2">Domain</TableHead>
                                <TableHead className="hidden sm:table-cell px-3 py-2"><SortHead label="Updated" active /></TableHead>
                                <TableHead className="px-3 py-2 sticky right-0 bg-slate-50">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {PROJECTS.map((p, i) => (
                                <TableRow key={p.name}>
                                  <TableCell className="px-3 py-2"><span className="font-medium text-slate-900">{p.name}</span></TableCell>
                                  <TableCell className="hidden sm:table-cell px-3 py-2 text-slate-500">{p.slug}</TableCell>
                                  <TableCell className="px-3 py-2"><Badge variant={p.variant}>{p.status}</Badge></TableCell>
                                  <TableCell className="hidden sm:table-cell px-3 py-2">{p.cats}</TableCell>
                                  <TableCell className="hidden sm:table-cell px-3 py-2">
                                    {p.domain
                                      ? <span className="flex items-center gap-1 text-slate-500 text-xs"><ExternalLink size={11} />{p.domain}</span>
                                      : <span className="text-slate-400">—</span>}
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell px-3 py-2 text-slate-500">{p.updated}</TableCell>
                                  <TableCell className="px-3 py-2 sticky right-0 bg-white">
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant={clickRow === i ? "primary" : "outline"}
                                        size="sm"
                                        className={clickRow === i ? "scale-95" : ""}
                                        data-cursor={i === 0 ? "projects-open-0" : undefined}
                                      >Open</Button>
                                      <Button variant="ghost" size="sm" className="h-7 px-2">···</Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          <div className="px-3">
                            <MockPagination total={PROJECTS.length} limit={20} />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* ── Project detail ── mirrors /admin/projects/[id]/page.tsx */}
                  {screen === "project-detail" && (
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <ArrowLeft size={13} />Projects
                        </Button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-slate-900">Canopy Website</h2>
                            <Badge variant="success">live</Badge>
                          </div>
                          <p className="text-slate-500 text-xs">A modern content platform for creative teams</p>
                        </div>
                        <Button variant="outline" size="sm" className="gap-1.5"><Activity size={13} />Health</Button>
                        <Button variant="outline" size="sm" className="gap-1.5"><Pencil size={13} />Edit</Button>
                      </div>

                      {/* Assigned Client */}
                      <Card>
                        <CardHeader className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <User size={13} className="text-slate-400" />
                            <CardTitle className="text-sm">Assigned Client</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 pt-2">
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <UserPlus size={13} />Assign client
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Media */}
                      <Card>
                        <CardHeader className="px-3 py-2.5">
                          <CardTitle className="text-sm">Media</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 pt-2 space-y-1.5">
                          <p className="text-[11px] text-slate-500">Image Background</p>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="https://picsum.photos/seed/canopy/800/200" alt="Project cover" className="w-full h-20 object-cover rounded-lg border border-slate-200" />
                        </CardContent>
                      </Card>

                      {/* Details meta — mirrors grid-cols-2 sm:grid-cols-4 from real page */}
                      <div className="grid grid-cols-4 gap-2">
                        <Card><CardContent className="px-3 py-2">
                          <p className="text-[10px] text-slate-500 mb-0.5">Slug</p>
                          <p className="text-xs font-medium text-slate-800 truncate">canopy-website</p>
                        </CardContent></Card>
                        <Card><CardContent className="px-3 py-2">
                          <p className="text-[10px] text-slate-500 mb-0.5">Industry</p>
                          <p className="text-xs font-medium text-slate-800">SaaS</p>
                        </CardContent></Card>
                      </div>

                      {/* Links meta — mirrors grid-cols-2 sm:grid-cols-4 from real page */}
                      <div className="grid grid-cols-4 gap-2">
                        <Card><CardContent className="px-3 py-2">
                          <p className="text-[10px] text-slate-500 mb-0.5">Domain</p>
                          <div className="flex items-center gap-1">
                            <Globe size={11} className="text-slate-400 flex-shrink-0" />
                            <p className="text-xs font-medium text-slate-800 truncate">canopy.app</p>
                          </div>
                        </CardContent></Card>
                        <Card><CardContent className="px-3 py-2">
                          <p className="text-[10px] text-slate-500 mb-0.5">Host</p>
                          <div className="flex items-center gap-1">
                            <Server size={11} className="text-slate-400 flex-shrink-0" />
                            <p className="text-xs font-medium text-slate-800">Vercel</p>
                          </div>
                        </CardContent></Card>
                        <Card><CardContent className="px-3 py-2">
                          <p className="text-[10px] text-slate-500 mb-0.5">GitHub</p>
                          <div className="flex items-center gap-1">
                            <GitBranch size={11} className="text-slate-400 flex-shrink-0" />
                            <p className="text-xs font-medium text-slate-800 truncate">org/canopy-web</p>
                          </div>
                        </CardContent></Card>
                      </div>

                      {/* Description */}
                      <Card>
                        <CardHeader className="px-3 py-2.5">
                          <CardTitle className="text-sm">Description</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 pt-2">
                          <p className="text-xs text-slate-700 leading-relaxed">A modern content management platform built for creative teams with real-time collaboration, role-based access, and approval workflows.</p>
                        </CardContent>
                      </Card>

                      {/* Public API */}
                      <Card>
                        <CardHeader className="px-3 py-2.5">
                          <div className="flex items-center justify-between w-full gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <Key size={13} className="text-slate-400" />
                              <CardTitle className="text-sm">Public API</CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                              <MockSearch placeholder="Search keys…" />
                              <Button variant="outline" size="sm">New Key</Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          {/* Endpoints */}
                          <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/60 space-y-1.5">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Endpoints</p>
                            {[
                              { label: "All projects",  url: "https://cms.canopy.app/api/v1/projects" },
                              { label: "This project",  url: "https://cms.canopy.app/api/v1/canopy-website" },
                              { label: "Category data", url: "https://cms.canopy.app/api/v1/canopy-website/[category-slug]" },
                            ].map(({ label, url }) => (
                              <div key={label} className="flex items-center gap-2 py-1 border-b border-slate-100 last:border-0">
                                <span className="text-[11px] text-slate-500 w-20 flex-shrink-0">{label}</span>
                                <code className="flex-1 text-[11px] font-mono text-slate-700 truncate">{url}</code>
                                <Copy size={12} className="text-slate-400 flex-shrink-0" />
                              </div>
                            ))}
                          </div>
                          {/* Keys table */}
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="px-3 py-2">Name</TableHead>
                                <TableHead className="px-3 py-2">Key</TableHead>
                                <TableHead className="px-3 py-2">Created</TableHead>
                                <TableHead className="px-3 py-2">Last Used</TableHead>
                                <TableHead className="px-3 py-2 sticky right-0 bg-slate-50" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell className="px-3 py-2 font-medium text-slate-900">Production</TableCell>
                                <TableCell className="px-3 py-2">
                                  <code className="text-[11px] font-mono text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">cms_9f3a••••••••••••••••••••••••••••••</code>
                                </TableCell>
                                <TableCell className="px-3 py-2 text-slate-500 text-xs whitespace-nowrap">6/1/2025</TableCell>
                                <TableCell className="px-3 py-2 text-slate-500 text-xs whitespace-nowrap">6/3/2025</TableCell>
                                <TableCell className="px-3 py-2 sticky right-0 bg-white">
                                  <Trash2 size={13} className="text-slate-400" />
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                          <div className="px-3">
                            <MockPagination total={1} limit={20} />
                          </div>
                        </CardContent>
                      </Card>

                      {/* Content Categories */}
                      <Card>
                        <CardHeader className="px-3 py-2.5">
                          <div className="flex items-center justify-between gap-3 w-full flex-wrap">
                            <CardTitle className="text-sm">Content Categories ({CATEGORIES.length})</CardTitle>
                            <div className="flex items-center gap-2">
                              <MockSearch placeholder="Search categories…" />
                              <Button variant="primary" size="sm">Add Category</Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="px-3 py-2"><SortHead label="Name" active /></TableHead>
                                <TableHead className="px-3 py-2">Slug</TableHead>
                                <TableHead className="px-3 py-2">Entries</TableHead>
                                <TableHead className="px-3 py-2 sticky right-0 bg-slate-50">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {CATEGORIES.map((c, i) => (
                                <TableRow key={c.name}>
                                  <TableCell className="px-3 py-2 font-medium text-slate-900">{c.name}</TableCell>
                                  <TableCell className="px-3 py-2 text-slate-500">{c.slug}</TableCell>
                                  <TableCell className="px-3 py-2">{c.entries}</TableCell>
                                  <TableCell className="px-3 py-2 sticky right-0 bg-white">
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant={clickRow === i ? "primary" : "outline"}
                                        size="sm"
                                        className={clickRow === i ? "scale-95" : ""}
                                        data-cursor={i === 0 ? "detail-manage-0" : undefined}
                                      >Manage</Button>
                                      <Button variant="ghost" size="sm" className="h-7 px-2">···</Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          <div className="px-3">
                            <MockPagination total={CATEGORIES.length} limit={20} />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* ── Entries ── mirrors /admin/projects/[id]/categories/[catId]/page.tsx + entries-table.tsx */}
                  {screen === "entries" && (
                    <div className="space-y-4">
                      <div className="flex items-start gap-2 flex-wrap">
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <ArrowLeft size={13} />Canopy Website
                        </Button>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-base font-bold text-slate-900">Blog Posts</h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="outline" size="sm" className="gap-1.5"><Webhook size={13} />Webhooks</Button>
                          <Button variant="outline" size="sm" className="gap-1.5"><Download size={13} />Export<ChevronDown size={11} /></Button>
                          <Button variant="outline" size="sm" className="gap-1.5"><Upload size={13} />Import</Button>
                          <Button variant="primary" size="sm">New Row</Button>
                          <Button variant="outline" size="sm" className="gap-1.5"><Columns size={13} />Manage Columns<span className="ml-0.5 text-xs text-slate-400">(4)</span></Button>
                        </div>
                      </div>

                      <Card className="overflow-hidden">
                        <CardHeader className="px-3 py-2.5">
                          <div className="flex items-center gap-3 w-full">
                            <CardTitle className="text-sm">{ENTRIES.length} entries</CardTitle>
                            <MockSearch placeholder="Search entries…" />
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          {/* Columns toolbar — mirrors entries-table.tsx */}
                          <div className="flex items-center justify-end px-4 py-2 border-b border-slate-100 bg-white">
                            <button tabIndex={-1} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border text-slate-600 bg-white border-slate-200 pointer-events-none outline-none">
                              <Columns3 size={13} />Columns
                            </button>
                          </div>

                          {/* Raw table — mirrors entries-table.tsx structure exactly */}
                          <div ref={tableScrollRef} className="overflow-x-auto pointer-events-none">
                            <table className="w-full text-sm border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                  <th className="w-8 px-2.5 py-2 border-r border-slate-200 sticky left-0 bg-slate-50 z-10">
                                    <input type="checkbox" tabIndex={-1} className="w-3.5 h-3.5 rounded border-slate-300 accent-indigo-600 pointer-events-none outline-none focus:outline-none focus:ring-0" readOnly />
                                  </th>
                                  <th className="w-8 px-2.5 py-2 text-left border-r border-slate-200 sticky left-8 bg-slate-50 z-10">
                                    <span className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                      # <ChevronDown size={10} className="text-indigo-500" />
                                    </span>
                                  </th>
                                  {[
                                    { label: "Slug",         type: "text",      color: "text-violet-500" },
                                    { label: "Title",        type: "text",      color: "text-violet-500" },
                                    { label: "Updated Date", type: "date",      color: "text-emerald-500" },
                                    { label: "Content",      type: "rich_text", color: "text-purple-600" },
                                  ].map(({ label, type, color }) => (
                                    <th key={label} className="px-3 py-2 text-left font-medium text-slate-700 border-r border-slate-200 whitespace-nowrap">
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
                                        <span className={`text-[10px] font-normal uppercase tracking-wide ${color}`}>{type}</span>
                                      </div>
                                    </th>
                                  ))}
                                  <th className="px-3 py-2 text-left font-medium text-slate-700 border-r border-slate-200 whitespace-nowrap">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</span>
                                      <span className="text-[10px] font-normal uppercase tracking-wide text-slate-400">system</span>
                                    </div>
                                  </th>
                                  <th className="px-3 py-2 text-left font-medium text-slate-700 whitespace-nowrap sticky right-0 bg-slate-50">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</span>
                                      <span className="text-[10px] font-normal uppercase tracking-wide text-slate-400">system</span>
                                    </div>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {ENTRIES.map((e, i) => (
                                  <tr key={e.slug} className="border-b border-slate-100">
                                    <td className="px-2.5 py-2 border-r border-slate-100 sticky left-0 z-10 bg-white">
                                      <input type="checkbox" tabIndex={-1} className="w-3.5 h-3.5 rounded border-slate-300 accent-indigo-600 pointer-events-none outline-none focus:outline-none focus:ring-0" readOnly />
                                    </td>
                                    <td className="px-2.5 py-2 text-center text-xs text-slate-400 border-r border-slate-100 sticky left-8 z-10 bg-white">
                                      {i + 1}
                                    </td>
                                    <td className="px-3 py-2 border-r border-slate-100 max-w-[140px]">
                                      <span className="block truncate text-slate-700">{e.slug}</span>
                                    </td>
                                    <td className="px-3 py-2 border-r border-slate-100 max-w-[160px]">
                                      <span className="block truncate text-slate-700">{e.title}</span>
                                    </td>
                                    <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">
                                      <span className="text-slate-700">{e.date}</span>
                                    </td>
                                    <td className="px-3 py-2 border-r border-slate-100 max-w-[200px]">
                                      <span className="block truncate text-slate-700">{e.content}</span>
                                    </td>
                                    <td className="px-3 py-2 border-r border-slate-100">
                                      <Badge variant="success">Active</Badge>
                                    </td>
                                    <td className="px-3 py-2 sticky right-0 z-10 bg-white">
                                      <div className="flex items-center gap-1">
                                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 rounded pointer-events-none">
                                          <ExternalLink size={11} />Preview
                                        </span>
                                        <Button tabIndex={-1} variant="ghost" size="sm" className="h-7 px-2 pointer-events-none focus:outline-none focus:ring-0">Edit</Button>
                                        <Button tabIndex={-1} variant="ghost" size="sm" className="h-7 px-2 pointer-events-none focus:outline-none focus:ring-0">···</Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="px-3">
                            <MockPagination total={ENTRIES.length} limit={20} />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40 select-none pointer-events-none" aria-hidden="true">
        <span className="text-[10px] text-slate-400 tracking-[0.2em] uppercase">Scroll</span>
        <div className="w-5 h-8 border border-slate-300 rounded-full flex items-start justify-center p-1.5">
          <div className="w-1 h-1.5 bg-slate-400 rounded-full" style={{ animation: "mk-scroll-dot 1.6s ease-in-out infinite" }} />
        </div>
      </div>
    </section>
  );
}
