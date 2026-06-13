"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Lock, ShieldCheck, Users, ScrollText, KeyRound, Zap,
  Check, X, Monitor, AlertTriangle, LogOut, Smartphone, AlertCircle,
} from "lucide-react";

// ── Mini UI Previews ──────────────────────────────────────────────────────────

// ── Mini cursor (arrow only) ──────────────────────────────────────────────────

function MiniCursor({ x, y, clicking }: { x: number; y: number; clicking: boolean }) {
  return (
    <div
      className="absolute pointer-events-none z-50"
      style={{
        left: x, top: y,
        transform: "translate(-3px, -2px)",
        transition: "left 0.5s cubic-bezier(0.4,0,0.2,1), top 0.5s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {clicking && (
        <span
          className="absolute -inset-3 rounded-full bg-indigo-400/25"
          style={{ animation: "mk-ripple 0.4s ease-out forwards" }}
        />
      )}
      <svg
        width="14" height="18" viewBox="0 0 14 18" fill="none"
        style={{
          filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.35))",
          transform: clicking ? "scale(0.88)" : "scale(1)",
          transition: "transform 0.1s",
        }}
      >
        <path
          d="M1.5 1.5 L1.5 14.5 L4.5 11.5 L7 17 L9 16 L6.5 10.5 L10.5 10.5 Z"
          fill="white" stroke="#1e293b" strokeWidth="1.4"
          strokeLinejoin="round" strokeLinecap="round"
        />
      </svg>
    </div>
  );
}


function TwoFAPreview() {
  type Phase = 'idle' | 'moving_input' | 'typing' | 'moving_verify' | 'done';

  const CODE = '374281';
  const [phase, setPhase]       = useState<Phase>('idle');
  const [typed, setTyped]       = useState('');
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [clicking, setClicking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const moveTo = useCallback((sel: string) => {
    const c = containerRef.current;
    if (!c) return;
    const el = c.querySelector(`[data-cursor="${sel}"]`) as HTMLElement | null;
    if (!el) return;
    const cr = c.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    setCursorPos({ x: er.left - cr.left + er.width / 2, y: er.top - cr.top + er.height / 2 });
  }, []);

  useEffect(() => {
    const T = (ms: number, fn: () => void) => setTimeout(fn, ms);
    const ts: ReturnType<typeof setTimeout>[] = [];

    if (phase === 'idle') {
      setCursorPos(null);
      setTyped('');
      setClicking(false);
      ts.push(T(1400, () => setPhase('moving_input')));
    } else if (phase === 'moving_input') {
      moveTo('tf-icon');
      ts.push(T(120, () => moveTo('tf-input')));
      ts.push(T(680, () => setPhase('typing')));
    } else if (phase === 'typing') {
      CODE.split('').forEach((_, i) => {
        ts.push(T(i * 230, () => setTyped(CODE.slice(0, i + 1))));
      });
      ts.push(T(CODE.length * 230 + 420, () => setPhase('moving_verify')));
    } else if (phase === 'moving_verify') {
      moveTo('tf-verify');
      ts.push(T(560,  () => setClicking(true)));
      ts.push(T(760,  () => { setClicking(false); setPhase('done'); }));
    } else if (phase === 'done') {
      ts.push(T(1600, () => setPhase('idle')));
    }

    return () => ts.forEach(clearTimeout);
  }, [phase, moveTo]);

  const remaining  = Math.max(0, 6 - typed.length);
  const showCaret  = phase === 'moving_input' || phase === 'typing';

  return (
    <div ref={containerRef} className="bg-slate-950 p-5 flex items-center justify-center" style={{ position: 'relative' }}>
      {cursorPos && <MiniCursor x={cursorPos.x} y={cursorPos.y} clicking={clicking} />}
      <div className="w-full max-w-[280px]">
        <div>
          <div className="flex justify-center mb-4">
            <div data-cursor="tf-icon" className="w-12 h-12 rounded-full bg-indigo-500/15 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
          <p className="text-white text-sm font-semibold text-center mb-1">Verify your identity</p>
          <p className="text-slate-400 text-[11px] text-center mb-5 leading-relaxed">
            Welcome back, <span className="text-slate-200 font-medium">Alex</span>.{" "}
            Enter the 6-digit code from your authenticator app.
          </p>
          <div
            data-cursor="tf-input"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 mb-3 flex items-center justify-center gap-0.5"
          >
            {typed    && <span className="font-mono tracking-widest text-base text-slate-200">{typed}</span>}
            {showCaret && <span className="w-0.5 h-4 bg-indigo-400 animate-pulse" />}
            {remaining > 0 && <span className="font-mono tracking-widest text-base text-slate-600">{'0'.repeat(remaining)}</span>}
          </div>
          <button
            data-cursor="tf-verify"
            className="w-full bg-indigo-600 text-white text-xs font-medium py-2 rounded-lg"
          >
            Verify
          </button>
          <p className="text-center text-slate-500 text-[11px] mt-3">Use a backup code instead</p>
        </div>
      </div>
    </div>
  );
}
function RBACPreview() {
  type Phase =
    | 'idle'
    | 'moving_create' | 'click_create'
    | 'moving_edit'   | 'click_edit'
    | 'moving_delete' | 'click_delete'
    | 'done';

  const [phase, setPhase]       = useState<Phase>('idle');
  const [grants, setGrants]     = useState<Record<string, boolean | null>>({ create: null, edit: null, delete: null });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [clicking, setClicking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const moveTo = useCallback((sel: string) => {
    const c = containerRef.current;
    if (!c) return;
    const el = c.querySelector(`[data-cursor="${sel}"]`) as HTMLElement | null;
    if (!el) return;
    const cr = c.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    setCursorPos({ x: er.left - cr.left + er.width / 2, y: er.top - cr.top + er.height / 2 });
  }, []);

  useEffect(() => {
    const T = (ms: number, fn: () => void) => setTimeout(fn, ms);
    const ts: ReturnType<typeof setTimeout>[] = [];

    if (phase === 'idle') {
      setCursorPos(null);
      setGrants({ create: null, edit: null, delete: null });
      setClicking(false);
      ts.push(T(1500, () => setPhase('moving_create')));
    } else if (phase === 'moving_create') {
      moveTo('rbac-create');
      ts.push(T(620, () => setPhase('click_create')));
    } else if (phase === 'click_create') {
      setClicking(true);
      ts.push(T(200, () => { setClicking(false); setGrants(g => ({ ...g, create: true })); }));
      ts.push(T(680, () => setPhase('moving_edit')));
    } else if (phase === 'moving_edit') {
      moveTo('rbac-edit');
      ts.push(T(580, () => setPhase('click_edit')));
    } else if (phase === 'click_edit') {
      setClicking(true);
      ts.push(T(200, () => { setClicking(false); setGrants(g => ({ ...g, edit: true })); }));
      ts.push(T(680, () => setPhase('moving_delete')));
    } else if (phase === 'moving_delete') {
      moveTo('rbac-delete');
      ts.push(T(580, () => setPhase('click_delete')));
    } else if (phase === 'click_delete') {
      setClicking(true);
      ts.push(T(200, () => { setClicking(false); setGrants(g => ({ ...g, delete: false })); }));
      ts.push(T(680, () => setPhase('done')));
    } else if (phase === 'done') {
      ts.push(T(1800, () => setPhase('idle')));
    }

    return () => ts.forEach(clearTimeout);
  }, [phase, moveTo]);

  const contribCell = (key: string, grant: boolean | null) => {
    if (grant === null)
      return (
        <span className="inline-block bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded">
          by client
        </span>
      );
    if (grant)
      return <Check className="w-3.5 h-3.5 text-emerald-400 mx-auto" style={{ animation: 'mk-fade-up 0.18s ease-out' }} />;
    return <X className="w-3.5 h-3.5 text-slate-600 mx-auto" style={{ animation: 'mk-fade-up 0.18s ease-out' }} />;
  };

  const rows: { label: string; admin: boolean; client: boolean; contribKey?: string; contribFixed?: boolean }[] = [
    { label: 'View content',    admin: true, client: true, contribFixed: true  },
    { label: 'Create entries',  admin: true, client: true, contribKey: 'create' },
    { label: 'Edit entries',    admin: true, client: true, contribKey: 'edit'   },
    { label: 'Delete entries',  admin: true, client: true, contribKey: 'delete' },
    { label: 'Manage users',    admin: true, client: true, contribFixed: false  },
  ];

  return (
    <div ref={containerRef} className="bg-slate-950 p-4" style={{ position: 'relative', minHeight: 270, overflow: 'hidden' }}>
      {cursorPos && <MiniCursor x={cursorPos.x} y={cursorPos.y} clicking={clicking} />}
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="text-left text-slate-500 font-medium pb-2.5 pr-3 text-[10px] uppercase tracking-widest pl-2">
              Permission
            </th>
            {[
              { full: "Admin",       short: "Admin"   },
              { full: "Client",      short: "Client"  },
              { full: "Contributor", short: "Contrib" },
            ].map(({ full, short }) => (
              <th key={full} className="text-center text-slate-500 font-medium pb-2.5 px-1 sm:px-2 text-[9px] sm:text-[10px] uppercase tracking-wide sm:tracking-widest">
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">{full}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.label} className={i % 2 === 0 ? "" : "bg-slate-900/40"}>
              <td className="text-slate-300 py-2 pr-3 text-[11px] pl-2">{row.label}</td>
              <td className="text-center py-2 px-1 sm:px-2">
                {row.admin ? <Check className="w-3.5 h-3.5 text-emerald-400 mx-auto" /> : <X className="w-3.5 h-3.5 text-slate-700 mx-auto" />}
              </td>
              <td className="text-center py-2 px-1 sm:px-2">
                {row.client ? <Check className="w-3.5 h-3.5 text-emerald-400 mx-auto" /> : <X className="w-3.5 h-3.5 text-slate-700 mx-auto" />}
              </td>
              <td
                className="text-center py-2 px-1"
                {...(row.contribKey ? { 'data-cursor': `rbac-${row.contribKey}` } : {})}
              >
                {row.contribKey
                  ? contribCell(row.contribKey, grants[row.contribKey])
                  : row.contribFixed
                  ? <Check className="w-3.5 h-3.5 text-emerald-400 mx-auto" />
                  : <X className="w-3.5 h-3.5 text-slate-700 mx-auto" />
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-slate-600 text-[10px] mt-3 pl-2">
        Contributor permissions are assigned per project by the client.
      </p>
    </div>
  );
}
function AuditPreview() {
  const EVENTS = [
    {
      label: "Password reset",
      Icon: Lock,
      iconCls: "text-amber-400",
      badge: { text: "Security", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20"        },
      meta:  "Jun 10, 2:14 PM \xb7 192.168.1.10 \xb7 Chrome macOS",
    },
    {
      label: "Password changed",
      Icon: Lock,
      iconCls: "text-emerald-400",
      badge: { text: "Security", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"  },
      meta:  "Jun 10, 11:30 AM \xb7 10.0.0.54 \xb7 Safari iPhone",
    },
    {
      label: "Two-factor enabled",
      Icon: ShieldCheck,
      iconCls: "text-emerald-400",
      badge: { text: "Security", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"  },
      meta:  "Jun 9, 9:15 AM \xb7 172.16.4.2 \xb7 Firefox Windows",
    },
    {
      label: "Failed sign-in attempt",
      Icon: AlertTriangle,
      iconCls: "text-red-400",
      badge: { text: "Alert",    cls: "bg-red-500/10 text-red-400 border-red-500/20"              },
      meta:  "Jun 8, 6:42 PM \xb7 185.234.12.89 \xb7 Unknown",
    },
  ];

  const [count,    setCount]    = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (count < EVENTS.length) {
      const t = setTimeout(() => setCount((c) => c + 1), count === 0 ? 700 : 560);
      return () => clearTimeout(t);
    }

    // All events visible — scroll down to reveal last one
    const tScroll = setTimeout(() => setScrolled(true), 350);

    // Reset
    const tReset = setTimeout(() => {
      setScrolled(false);
      setCount(0);
    }, 2400);

    return () => { clearTimeout(tScroll); clearTimeout(tReset); };
  }, [count]);

  return (
    <div className="bg-slate-950 p-4">
      <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold mb-3">
        Recent security activity
      </p>
      {/* Fixed-height viewport — overflow hidden, inner content translates up */}
      <div style={{ height: 180, overflow: 'hidden' }}>
        <div
          className="divide-y divide-slate-800"
          style={{
            transform:  scrolled ? 'translateY(-62px)' : 'translateY(0)',
            transition: scrolled ? 'transform 0.7s cubic-bezier(0.4,0,0.2,1)' : 'none',
          }}
        >
          {EVENTS.slice(0, count).map((e) => (
            <div
              key={e.label}
              className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
              style={{ animation: "mk-fade-up 0.28s ease-out" }}
            >
              <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                <e.Icon className={`w-3.5 h-3.5 ${e.iconCls}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-200 text-[11px] font-medium">{e.label}</span>
                  <span className={`text-[9px] font-semibold border px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0 ${e.badge.cls}`}>
                    {e.badge.text}
                  </span>
                </div>
                <p className="text-slate-500 text-[10px] mt-0.5">{e.meta}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function SessionPreview() {
  type Phase =
    | 'idle'
    | 'moving_1' | 'clicking_1'
    | 'moving_2' | 'clicking_2'
    | 'done';

  const SESSIONS = [
    { id: 'chrome',  Icon: Monitor,    label: 'Chrome on macOS',    ip: '192.168.1.10', ago: 'Just now', current: true  },
    { id: 'safari',  Icon: Smartphone, label: 'Safari on iPhone',   ip: '10.0.0.54',    ago: '2d ago',   current: false },
    { id: 'firefox', Icon: Monitor,    label: 'Firefox on Windows', ip: '172.16.4.2',   ago: '5d ago',   current: false },
  ];

  const [phase,   setPhase]   = useState<Phase>('idle');
  const [revoked, setRevoked] = useState<Set<string>>(new Set());
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [clicking,  setClicking]  = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const moveTo = useCallback((sel: string) => {
    const c = containerRef.current;
    if (!c) return;
    const el = c.querySelector(`[data-cursor="${sel}"]`) as HTMLElement | null;
    if (!el) return;
    const cr = c.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    setCursorPos({ x: er.left - cr.left + er.width / 2, y: er.top - cr.top + er.height / 2 });
  }, []);

  useEffect(() => {
    const T = (ms: number, fn: () => void) => setTimeout(fn, ms);
    const ts: ReturnType<typeof setTimeout>[] = [];

    if (phase === 'idle') {
      setCursorPos(null);
      setRevoked(new Set());
      setClicking(false);
      ts.push(T(1400, () => setPhase('moving_1')));
    } else if (phase === 'moving_1') {
      moveTo('ses-revoke-safari');
      ts.push(T(640, () => setPhase('clicking_1')));
    } else if (phase === 'clicking_1') {
      setClicking(true);
      ts.push(T(180, () => { setClicking(false); setRevoked(r => new Set(r).add('safari')); }));
      ts.push(T(700, () => setPhase('moving_2')));
    } else if (phase === 'moving_2') {
      moveTo('ses-revoke-firefox');
      ts.push(T(620, () => setPhase('clicking_2')));
    } else if (phase === 'clicking_2') {
      setClicking(true);
      ts.push(T(180, () => { setClicking(false); setRevoked(r => new Set(r).add('firefox')); }));
      ts.push(T(600, () => setPhase('done')));
    } else if (phase === 'done') {
      ts.push(T(1800, () => setPhase('idle')));
    }

    return () => ts.forEach(clearTimeout);
  }, [phase, moveTo]);

  return (
    <div
      ref={containerRef}
      className="bg-slate-950 p-4"
      style={{ position: 'relative', minHeight: 250 }}
    >
      {cursorPos && <MiniCursor x={cursorPos.x} y={cursorPos.y} clicking={clicking} />}
      <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold mb-3">
        Active sessions
      </p>
      <div className="divide-y divide-slate-800">
        {SESSIONS.map((s) => {
          const isRevoked = revoked.has(s.id);
          return (
            <div
              key={s.id}
              className="flex items-center gap-3 first:pt-0 last:pb-0"
              style={{
                overflow:      'hidden',
                maxHeight:     isRevoked ? 0 : 72,
                opacity:       isRevoked ? 0 : 1,
                paddingTop:    isRevoked ? 0 : 10,
                paddingBottom: isRevoked ? 0 : 10,
                transition:    'max-height 0.35s ease-out, opacity 0.25s ease-out, padding 0.35s ease-out',
              }}
            >
              {/* Icon box */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                s.current
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                <s.Icon className="w-3.5 h-3.5" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-200 text-[11px] font-medium">{s.label}</span>
                  {s.current && (
                    <span className="text-[9px] font-semibold border px-1.5 py-0.5 rounded uppercase tracking-wide bg-sky-500/10 text-sky-400 border-sky-500/20">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-slate-500 text-[10px] mt-0.5">{s.ip} · {s.ago}</p>
              </div>

              {/* Revoke button */}
              {!s.current && (
                <button
                  data-cursor={`ses-revoke-${s.id}`}
                  className="flex-shrink-0 flex items-center gap-1 text-red-400 text-[10px] font-medium border border-red-500/30 px-2 py-1 rounded-lg"
                >
                  <LogOut className="w-3 h-3" />
                  Revoke
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function RateLimitPreview() {
  const limits = [
    { label: "Login attempts", used: 3,   max: 10,  unit: "/ 15 min" },
    { label: "API reads",      used: 142, max: 200, unit: "/ min"    },
    { label: "API writes",     used: 23,  max: 100, unit: "/ min"    },
    { label: "Password reset", used: 1,   max: 5,   unit: "/ 15 min" },
  ];

  const [fill, setFill] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFill(f => !f), fill ? 2400 : 400);
    return () => clearTimeout(t);
  }, [fill]);

  return (
    <div className="bg-slate-950 p-4">
      <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold mb-4">
        Rate limits
      </p>
      <div className="space-y-3.5">
        {limits.map((l, i) => {
          const pct = (l.used / l.max) * 100;
          return (
            <div key={l.label}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-slate-300 text-[11px]">{l.label}</span>
                <span className="text-slate-500 text-[10px] font-mono">
                  {l.used} / {l.max} {l.unit}
                </span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${pct > 75 ? "bg-amber-500" : "bg-indigo-500"}`}
                  style={{
                    width: fill ? `${pct}%` : '0%',
                    transition: fill
                      ? `width 0.85s cubic-bezier(0.4,0,0.2,1) ${i * 110}ms`
                      : 'none',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LockoutPreview() {
  type Phase =
    | 'idle'
    | 'moving_user' | 'typing_user'
    | 'moving_pass' | 'typing_pass'
    | 'moving_submit' | 'clicking'
    | 'locked';

  const USERNAME   = 'alex.morgan';
  const PASS_DOTS  = 8;
  const INIT_SECS  = 14 * 60 + 32;

  const [phase,    setPhase]    = useState<Phase>('idle');
  const [username, setUsername] = useState('');
  const [dots,     setDots]     = useState(0);
  const [locked,   setLocked]   = useState(false);
  const [secs,     setSecs]     = useState(INIT_SECS);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [clicking,  setClicking]  = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const moveTo = useCallback((sel: string) => {
    const c = containerRef.current;
    if (!c) return;
    const el = c.querySelector(`[data-cursor="${sel}"]`) as HTMLElement | null;
    if (!el) return;
    const cr = c.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    setCursorPos({ x: er.left - cr.left + er.width / 2, y: er.top - cr.top + er.height / 2 });
  }, []);

  // Countdown only while locked
  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => setSecs(s => s <= 1 ? INIT_SECS : s - 1), 1000);
    return () => clearInterval(t);
  }, [locked]);

  useEffect(() => {
    const T = (ms: number, fn: () => void) => setTimeout(fn, ms);
    const ts: ReturnType<typeof setTimeout>[] = [];

    if (phase === 'idle') {
      setCursorPos(null); setUsername(''); setDots(0);
      setLocked(false); setSecs(INIT_SECS); setClicking(false);
      ts.push(T(1200, () => setPhase('moving_user')));
    } else if (phase === 'moving_user') {
      moveTo('lk-username');
      ts.push(T(580, () => setPhase('typing_user')));
    } else if (phase === 'typing_user') {
      USERNAME.split('').forEach((_, i) =>
        ts.push(T(i * 95, () => setUsername(USERNAME.slice(0, i + 1))))
      );
      ts.push(T(USERNAME.length * 95 + 320, () => setPhase('moving_pass')));
    } else if (phase === 'moving_pass') {
      moveTo('lk-password');
      ts.push(T(560, () => setPhase('typing_pass')));
    } else if (phase === 'typing_pass') {
      for (let i = 1; i <= PASS_DOTS; i++)
        ts.push(T(i * 115, () => setDots(d => d + 1)));
      ts.push(T(PASS_DOTS * 115 + 380, () => setPhase('moving_submit')));
    } else if (phase === 'moving_submit') {
      moveTo('lk-submit');
      ts.push(T(580, () => setPhase('clicking')));
    } else if (phase === 'clicking') {
      setClicking(true);
      ts.push(T(200, () => { setClicking(false); setLocked(true); setPhase('locked'); }));
    } else if (phase === 'locked') {
      ts.push(T(2800, () => setPhase('idle')));
    }

    return () => ts.forEach(clearTimeout);
  }, [phase, moveTo]);

  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');
  const showUserCaret = phase === 'typing_user' || phase === 'moving_pass';
  const showPassCaret = phase === 'typing_pass' || phase === 'moving_submit' || phase === 'clicking';

  return (
    <div
      ref={containerRef}
      className="bg-slate-950 p-4"
      style={{ position: 'relative', minHeight: 255 }}
    >
      {cursorPos && <MiniCursor x={cursorPos.x} y={cursorPos.y} clicking={clicking} />}

      {/* Lockout banner — slides in when locked */}
      <div style={{
        maxHeight: locked ? 64 : 0,
        opacity:   locked ? 1 : 0,
        overflow:  'hidden',
        marginBottom: locked ? 10 : 0,
        transition: 'max-height 0.3s ease-out, opacity 0.25s ease-out, margin-bottom 0.3s ease-out',
      }}>
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-red-400 text-[11px] font-medium">Account locked</p>
            <p className="text-red-400/70 text-[10px] mt-0.5">
              Try again in: <span className="font-mono font-bold">{mm}:{ss}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Username */}
      <div className="mb-2">
        <p className="text-slate-500 text-[10px] font-medium mb-1">Username</p>
        <div
          data-cursor="lk-username"
          className={`border rounded-lg px-3 py-2 text-[11px] flex items-center min-h-[28px] transition-colors duration-300 ${
            locked ? 'bg-slate-800/40 border-slate-700/40 text-slate-600'
                   : 'bg-slate-800 border-slate-700 text-slate-200'
          }`}
        >
          <span>{username}</span>
          {showUserCaret && !locked && <span className="w-0.5 h-3.5 bg-indigo-400 animate-pulse ml-px" />}
        </div>
      </div>

      {/* Password */}
      <div className="mb-3">
        <p className="text-slate-500 text-[10px] font-medium mb-1">Password</p>
        <div
          data-cursor="lk-password"
          className={`border rounded-lg px-3 py-2 text-[11px] flex items-center min-h-[28px] transition-colors duration-300 ${
            locked ? 'bg-slate-800/40 border-slate-700/40 text-slate-600'
                   : 'bg-slate-800 border-slate-700 text-slate-200'
          }`}
        >
          <span>{'•'.repeat(dots)}</span>
          {showPassCaret && !locked && <span className="w-0.5 h-3.5 bg-indigo-400 animate-pulse ml-px" />}
        </div>
      </div>

      {/* Submit */}
      <div
        data-cursor="lk-submit"
        className={`w-full text-[11px] font-medium py-2 rounded-lg text-center transition-all duration-300 ${
          locked ? 'bg-slate-800 text-slate-500' : 'bg-indigo-600 text-white'
        }`}
      >
        {locked ? `Try again in ${mm}:${ss}` : 'Sign in'}
      </div>
    </div>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    id: "twofa",
    icon: ShieldCheck,
    title: "Two-Factor Authentication",
    description:
      "TOTP-based 2FA via any authenticator app. Each account gets 10 single-use backup codes, stored hashed, never in plain text.",
    Preview: TwoFAPreview,
  },
  {
    id: "rbac",
    icon: Users,
    title: "Role-Based Access Control",
    description:
      "Four distinct roles (Owner, Admin, Client, and Contributor), each with scoped permissions and per-project overrides.",
    Preview: RBACPreview,
  },
  {
    id: "audit",
    icon: ScrollText,
    title: "Audit Trail",
    description:
      "Every action is logged with actor, timestamp, IP address, and device. Security events carry severity levels: info, warning, and critical.",
    Preview: AuditPreview,
  },
  {
    id: "sessions",
    icon: KeyRound,
    title: "Session Management",
    description:
      "View all active sessions with IP and device info. Revoke any session individually or sign out everywhere at once.",
    Preview: SessionPreview,
  },
  {
    id: "ratelimit",
    icon: Zap,
    title: "Rate Limiting",
    description:
      "Per-IP limits on login, signup, and password reset. Per-user limits on API reads and writes, enforced at the edge.",
    Preview: RateLimitPreview,
  },
  {
    id: "lockout",
    icon: Lock,
    title: "Account Lockout",
    description:
      "Ten consecutive failed login attempts lock the account for 30 minutes. Security alerts are sent by email for sensitive changes.",
    Preview: LockoutPreview,
  },
] as const;

// ── Section ───────────────────────────────────────────────────────────────────

export function SecuritySection() {
  const [active, setActive] = useState(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observers = itemRefs.current.map((el, i) => {
      if (!el) return null;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(i); },
        { threshold: 0, rootMargin: "-30% 0px -55% 0px" }
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach((obs) => obs?.disconnect());
  }, []);

  return (
    <section
      id="security"
      className="relative bg-slate-50 pb-12 sm:pb-32"
      aria-labelledby="security-heading"
    >
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-10 sm:mb-20">
          <h2
            id="security-heading"
            className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight mb-5"
          >
            Built secure from the ground up
          </h2>
          <p className="text-slate-500 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto">
            Every security feature here is live in the product, not a roadmap item.
          </p>
        </div>

        {/* Sticky-scroll layout */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-20 items-start">

          {/* Left: sticky text panel */}
          <div className="hidden lg:block sticky top-28">

            {/* Fading feature content */}
            <div className="relative" style={{ minHeight: 220 }}>
              {FEATURES.map((f, i) => (
                <div
                  key={f.id}
                  aria-hidden={active !== i}
                  style={{
                    position: i === 0 ? "relative" : "absolute",
                    inset: 0,
                    opacity: active === i ? 1 : 0,
                    transform: active === i ? "translateY(0)" : "translateY(10px)",
                    transition: "opacity 0.4s ease, transform 0.4s ease",
                    pointerEvents: active === i ? "auto" : "none",
                  }}
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-5">
                    <f.icon className="w-6 h-6 text-indigo-600" aria-hidden="true" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">{f.title}</h3>
                  <p className="text-slate-500 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>

            {/* Progress dots */}
            <div className="flex items-center gap-2 mt-10">
              {FEATURES.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    active === i ? "w-6 bg-indigo-600" : "w-1.5 bg-slate-300"
                  }`}
                />
              ))}
            </div>

          </div>

          {/* Right: scrollable previews */}
          <div className="space-y-6 sm:space-y-12">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.id}
                ref={(el) => { itemRefs.current[i] = el; }}
              >
                <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                  <feature.Preview />
                </div>
                {/* Mobile-only label */}
                <div className="lg:hidden flex items-start gap-3 mt-4">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <feature.icon className="w-4 h-4 text-indigo-600" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-slate-900 font-semibold text-[15px] mb-1">{feature.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
