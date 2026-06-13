"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  CheckCircle2, ChevronDown, Plus, Trash2, X, Send,
  Bold, Italic, Heading2, Heading3, List, ListOrdered, Quote, Code, Minus, ImageIcon,
  ToggleRight, ToggleLeft, GripVertical,
} from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

// ── Shared cursor overlay ─────────────────────────────────────────────────────

type CursorVariant = 'arrow' | 'grab' | 'grabbing';

function MiniCursor({ x, y, clicking, variant = 'arrow' }: {
  x: number; y: number; clicking: boolean; variant?: CursorVariant;
}) {
  // Hotspot offset: arrow = top-left tip, hand = middle-finger tip (center-top)
  const offset = variant === 'arrow' ? "translate(-3px, -2px)" : "translate(-8px, -1px)";
  const svgStyle = {
    filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.35))",
    transform: clicking ? "scale(0.88)" : "scale(1)",
    transition: "transform 0.1s",
  };
  return (
    <div
      className="absolute pointer-events-none z-50"
      style={{
        left: x, top: y, transform: offset,
        transition: "left 0.55s cubic-bezier(0.4,0,0.2,1), top 0.55s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {clicking && (
        <span className="absolute -inset-3 rounded-full bg-indigo-400/25"
          style={{ animation: "mk-ripple 0.4s ease-out forwards" }} />
      )}

      {variant === 'arrow' && (
        <svg width="14" height="18" viewBox="0 0 14 18" fill="none" style={svgStyle}>
          <path d="M1.5 1.5 L1.5 14.5 L4.5 11.5 L7 17 L9 16 L6.5 10.5 L10.5 10.5 Z"
            fill="white" stroke="#1e293b" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}

      {variant === 'grab' && (
        <svg width="16" height="19" viewBox="0 0 16 19" fill="none" style={svgStyle}>
          {/* Palm fill — drawn first so finger strokes land on white */}
          <path fill="white"
            d="M1.5 10.5 L1.5 14 Q1.5 18 8 18 Q14.5 18 14.5 14 L14.5 10.5 Z"/>
          {/* Fingers: open-bottom U-paths — fill closes invisibly, stroke traces 3 sides only */}
          {/* Index */}
          <path fill="white" stroke="#1e293b" strokeWidth="1.1"
            d="M1.5 10.5 L1.5 3 Q1.5 1.5 3 1.5 Q4.5 1.5 4.5 3 L4.5 10.5"/>
          {/* Middle (tallest) */}
          <path fill="white" stroke="#1e293b" strokeWidth="1.1"
            d="M5 10.5 L5 2 Q5 0.5 6.5 0.5 Q8 0.5 8 2 L8 10.5"/>
          {/* Ring */}
          <path fill="white" stroke="#1e293b" strokeWidth="1.1"
            d="M8.5 10.5 L8.5 3 Q8.5 1.5 10 1.5 Q11.5 1.5 11.5 3 L11.5 10.5"/>
          {/* Pinky */}
          <path fill="white" stroke="#1e293b" strokeWidth="1.1"
            d="M12 10.5 L12 5 Q12 3.5 13.25 3.5 Q14.5 3.5 14.5 5 L14.5 10.5"/>
          {/* Palm outline — U-path, strokes sides + bottom only */}
          <path fill="none" stroke="#1e293b" strokeWidth="1.1" strokeLinejoin="round"
            d="M1.5 10.5 L1.5 14 Q1.5 18 8 18 Q14.5 18 14.5 14 L14.5 10.5"/>
          {/* Thumb */}
          <path fill="white" stroke="#1e293b" strokeWidth="1.1" strokeLinecap="round"
            d="M1.5 11.5 Q0 11 0 13 Q0 15 1.5 14.5"/>
        </svg>
      )}

      {variant === 'grabbing' && (
        <svg width="16" height="13" viewBox="0 0 16 13" fill="none" style={svgStyle}>
          {/* Fist with natural knuckle bumps along the top */}
          <path fill="white" stroke="#1e293b" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round"
            d="M2.5 3.5 Q3 1.5 5 2.5 Q5.5 0.5 7.5 1.5 Q8 0 10 1.5 Q10.5 0.5 12.5 2
               L14 3.5 L14.5 8 Q14.5 12.5 8.5 12.5 Q2.5 12.5 2.5 8 Z"/>
          {/* Thumb */}
          <path fill="white" stroke="#1e293b" strokeWidth="1.1" strokeLinecap="round"
            d="M2.5 7 Q0.5 6.5 0.5 9 Q0.5 11 2.5 10.5"/>
        </svg>
      )}
    </div>
  );
}

// ── Mini UI preview components ────────────────────────────────────────────────

function SchemaPreview() {
  type Phase =
    | 'idle' | 'moving_add' | 'adding' | 'typing'
    | 'moving_type' | 'open_dropdown' | 'moving_boolean' | 'done';

  const BASE_FIELDS = [
    { name: "slug",         type: "Text"      },
    { name: "title",        type: "Text"      },
    { name: "updated", type: "Date"      },
    { name: "content",      type: "Rich Text" },
  ];

  const TYPE_OPTIONS = [
    "Text", "Textarea", "Rich Text", "Number",
    "Date", "URL", "Email", "Boolean", "Enum", "Relation", "Count",
  ];

  const TYPED_NAME = 'published';

  const [phase, setPhase] = useState<Phase>('idle');
  const [typedText, setTypedText] = useState('');
  const [showNewRow, setShowNewRow] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedType, setSelectedType] = useState('Text');
  const [dropdownPos, setDropdownPos] = useState<{ bottom: number; left: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [cursorClicking, setCursorClicking] = useState(false);

  const moveTo = useCallback((selector: string) => {
    const c = containerRef.current;
    if (!c) return;
    const t = c.querySelector(`[data-cursor="${selector}"]`) as HTMLElement | null;
    if (!t) return;
    const cr = c.getBoundingClientRect(), tr = t.getBoundingClientRect();
    setCursorPos({ x: tr.left - cr.left + tr.width / 2, y: tr.top - cr.top + tr.height / 2 });
  }, []);

  const openDropdown = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const t = c.querySelector('[data-cursor="sc-type"]') as HTMLElement | null;
    if (!t) return;
    const cr = c.getBoundingClientRect(), tr = t.getBoundingClientRect();
    // Open upward so dropdown doesn't overflow card bottom
    setDropdownPos({ bottom: cr.bottom - tr.top + 2, left: tr.left - cr.left });
    setShowDropdown(true);
  }, []);

  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, fn: () => void) => { ts.push(setTimeout(fn, ms)); };

    if (phase === 'idle') {
      setTypedText(''); setShowNewRow(false); setShowDropdown(false);
      setSelectedType('Text'); setCursorPos(null); setCursorClicking(false); setDropdownPos(null);
      later(900, () => setPhase('moving_add'));
    }

    else if (phase === 'moving_add') {
      moveTo('sc-title');               // cursor enters at "Manage Columns" title (top-left)
      later(350, () => moveTo('sc-add')); // glide straight down to Add column button
      later(1000, () => setCursorClicking(true));
      later(1180, () => { setCursorClicking(false); setShowNewRow(true); setPhase('adding'); });
    }

    else if (phase === 'adding') {
      later(200, () => moveTo('sc-input'));
      later(520, () => setCursorClicking(true));
      later(680, () => { setCursorClicking(false); setPhase('typing'); });
    }

    else if (phase === 'typing') {
      TYPED_NAME.split('').forEach((_, i) => {
        later(100 + i * 88, () => setTypedText(TYPED_NAME.slice(0, i + 1)));
      });
      const done = 100 + (TYPED_NAME.length - 1) * 88 + 340;
      later(done, () => moveTo('sc-type'));
      later(done + 120, () => setPhase('moving_type'));
    }

    else if (phase === 'moving_type') {
      later(650, () => setCursorClicking(true));
      later(830, () => { setCursorClicking(false); openDropdown(); setPhase('open_dropdown'); });
    }

    else if (phase === 'open_dropdown') {
      later(160, () => moveTo('sc-boolean'));
      later(260, () => setPhase('moving_boolean'));
    }

    else if (phase === 'moving_boolean') {
      later(600, () => setCursorClicking(true));
      later(780, () => {
        setCursorClicking(false); setSelectedType('Boolean');
        setShowDropdown(false); setDropdownPos(null); setPhase('done');
      });
    }

    else if (phase === 'done') {
      later(2100, () => setPhase('idle'));
    }

    return () => ts.forEach(clearTimeout);
  }, [phase, moveTo, openDropdown]);

  const showCaret = phase === 'adding' || phase === 'typing';
  const dropdownHover = (phase === 'moving_boolean') ? 'Boolean' : null;

  return (
    <div ref={containerRef} className="pointer-events-none select-none w-full" style={{ position: 'relative' }}>
      {cursorPos && <MiniCursor x={cursorPos.x} y={cursorPos.y} clicking={cursorClicking} />}

      {/* Type dropdown — positioned upward from sc-type button */}
      {showDropdown && dropdownPos && (
        <div
          className="absolute z-40 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden py-0.5 max-h-[200px]"
          style={{ bottom: dropdownPos.bottom, left: dropdownPos.left, width: 92 }}
        >
          {TYPE_OPTIONS.map(opt => (
            <div
              key={opt}
              data-cursor={opt === 'Boolean' ? 'sc-boolean' : undefined}
              className={`px-2.5 py-[3px] text-[10px] leading-[18px] ${
                opt === dropdownHover
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-slate-700'
              }`}
            >
              {opt}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">

        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <span data-cursor="sc-title" className="text-sm font-semibold text-slate-900">Manage Columns</span>
          <div data-cursor="sc-close" className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400">
            <X size={14} />
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-2 overflow-hidden" style={{ height: 232 }}>

          {/* Column header */}
          <div className="grid grid-cols-[14px_1fr_88px_20px] gap-2 pb-0.5 items-center">
            <div className="w-3.5 h-3.5 rounded border border-slate-300 bg-white flex-shrink-0" />
            <span className="text-[11px] font-medium text-slate-500">Column Name</span>
            <span className="text-[11px] font-medium text-slate-500">Type</span>
            <span />
          </div>

          {/* Base rows */}
          {BASE_FIELDS.map(f => (
            <div key={f.name} className="grid grid-cols-[14px_1fr_88px_20px] gap-2 items-center">
              <div className="w-3.5 h-3.5 rounded border border-slate-300 bg-white flex-shrink-0" />
              <div className="h-7 rounded-lg border border-slate-300 bg-white px-2.5 flex items-center text-[11px] text-slate-900 truncate min-w-[70px]">
                {f.name}
              </div>
              <div className="h-7 rounded-lg border border-slate-300 bg-white px-2 flex items-center justify-between gap-1">
                <span className="text-[11px] text-slate-900 truncate">{f.type}</span>
                <ChevronDown size={10} className="text-slate-400 flex-shrink-0" />
              </div>
              <div className="flex items-center justify-center text-slate-300"><Trash2 size={11} /></div>
            </div>
          ))}

          {/* New "published" row */}
          {showNewRow && (
            <div
              className="grid grid-cols-[14px_1fr_88px_20px] gap-2 items-center"
              style={{ animation: 'mk-fade-up 0.22s ease-out' }}
            >
              <div className="w-3.5 h-3.5 rounded border border-slate-300 bg-white flex-shrink-0" />
              <div
                data-cursor="sc-input"
                className="h-7 rounded-lg border border-indigo-400 ring-1 ring-indigo-100 bg-white px-2.5 flex items-center text-[11px] text-slate-900"
              >
                <span className="truncate flex-1">{typedText}</span>
                {showCaret && (
                  <span className="inline-block w-px h-3 bg-indigo-500 flex-shrink-0" />
                )}
              </div>
              <div
                data-cursor="sc-type"
                className="h-7 rounded-lg border border-slate-300 bg-white px-2 flex items-center justify-between gap-1"
              >
                <span className="text-[11px] text-slate-900 truncate">{selectedType}</span>
                <ChevronDown size={10} className="text-slate-400 flex-shrink-0" />
              </div>
              <div className="flex items-center justify-center text-slate-300"><Trash2 size={11} /></div>
            </div>
          )}

          {/* Add column */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <Plus size={12} className="text-indigo-600 flex-shrink-0" />
            <span data-cursor="sc-add" className="text-xs font-medium text-indigo-600">Add column</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
          <div className="flex-1 sm:flex-none justify-center h-7 px-3 rounded-lg border border-slate-300 bg-white flex items-center text-[11px] font-medium text-slate-700">
            Cancel
          </div>
          <div className="flex-1 sm:flex-none justify-center h-7 px-3 rounded-lg bg-indigo-600 flex items-center text-[11px] font-medium text-white">
            Save Columns
          </div>
        </div>

      </div>
    </div>
  );
}

function ApprovalPreview() {
  type Phase = 'idle' | 'lifting' | 'flying' | 'settling' | 'settled';
  const [phase, setPhase] = useState<Phase>('idle');
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [cursorClicking, setCursorClicking] = useState(false);

  const moveTo = useCallback((sel: string) => {
    const c = containerRef.current;
    if (!c) return;
    const el = c.querySelector<HTMLElement>(`[data-cursor="${sel}"]`);
    if (!el) return;
    const cr = c.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    setCursorPos({ x: er.left - cr.left + er.width / 2, y: er.top - cr.top + er.height / 2 });
  }, []);

  // Phase transitions
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (phase === 'idle')     t = setTimeout(() => setPhase('lifting'),  2000);
    if (phase === 'lifting')  t = setTimeout(() => setPhase('flying'),   480);
    if (phase === 'flying')   t = setTimeout(() => setPhase('settling'), 580);
    if (phase === 'settling') t = setTimeout(() => setPhase('settled'),  350);
    if (phase === 'settled')  t = setTimeout(() => setPhase('idle'),     3000);
    return () => clearTimeout(t);
  }, [phase]);

  // Cursor movement per phase
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (phase === 'idle') {
      timers.push(setTimeout(() => moveTo('ap-grip'), 400));
    } else if (phase === 'lifting') {
      setCursorClicking(true);
      timers.push(setTimeout(() => setCursorClicking(false), 220));
    } else if (phase === 'flying') {
      moveTo('ap-resolved');
    } else if (phase === 'settling') {
      setCursorClicking(true);
      timers.push(setTimeout(() => setCursorClicking(false), 220));
    }
    return () => timers.forEach(clearTimeout);
  }, [phase, moveTo]);

  const showCardAInOpen     = phase === 'idle' || phase === 'lifting' || phase === 'flying';
  const showCardAInResolved = phase === 'settling' || phase === 'settled';
  const dragOverResolved    = phase === 'flying' || phase === 'settling';

  return (
    <div ref={containerRef} className="pointer-events-none select-none w-full" style={{ position: 'relative' }}>
      {cursorPos && (
        <MiniCursor
          x={cursorPos.x} y={cursorPos.y} clicking={cursorClicking}
          variant={(phase === 'lifting' || phase === 'flying') ? 'grabbing' : 'grab'}
        />
      )}

      {/* Hint — mirrors real modal: "Drag requests between columns to resolve or reopen." */}
      <p className="text-[9px] text-slate-400 mb-2.5">Drag requests between columns to resolve or reopen.</p>

      <div className="flex gap-2.5" style={{ position: 'relative' }}>

        {/* ── Open column ── */}
        <div
          className="flex-1 min-w-0 rounded-xl bg-slate-50 p-2.5"
          style={{ position: 'relative', zIndex: (phase === 'lifting' || phase === 'flying') ? 1 : undefined }}
        >
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide">Open</span>
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 leading-none">
              {showCardAInOpen ? '2' : '1'}
            </span>
          </div>

          {/* Card A — lifted and flown to Resolved */}
          {showCardAInOpen && (
            <div
              className="bg-white rounded-lg border border-slate-200 p-2 mb-1.5"
              style={{
                position: 'relative',
                transform:
                  phase === 'lifting' ? 'translateY(-3px) scale(1.03) rotate(1deg)' :
                  phase === 'flying'  ? 'translateX(112%) translateY(-4px) rotate(2deg)' :
                  'none',
                opacity: phase === 'flying' ? 0 : 1,
                boxShadow: (phase === 'lifting' || phase === 'flying') ? '0 8px 24px rgba(0,0,0,0.13)' : 'none',
                transition: 'transform 0.52s cubic-bezier(0.4,0,0.2,1), opacity 0.52s ease, box-shadow 0.3s ease',
                zIndex: 10,
              }}
            >
              <div className="flex items-start gap-1.5">
                <span data-cursor="ap-grip" className="flex-shrink-0 mt-0.5">
                  <GripVertical size={11} className="text-slate-300" />
                </span>
                <div>
                  <p className="text-[10px] text-slate-800 leading-snug">Intro needs more audience context.</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">
                    <span className="font-medium text-slate-500">Sarah Chen</span>{" · "}2h ago
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Card B — stays in Open */}
          <div className="bg-white rounded-lg border border-slate-200 p-2">
            <div className="flex items-start gap-1.5">
              <GripVertical size={11} className="text-slate-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-slate-800 leading-snug">Add a subtitle to the hero section.</p>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  <span className="font-medium text-slate-500">Mark Kim</span>{" · "}1d ago
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Resolved column ── */}
        <div className={`flex-1 min-w-0 rounded-xl p-2.5 transition-colors duration-300 ${
          dragOverResolved ? 'bg-emerald-50' : 'bg-slate-50'
        }`}>
          <div className="flex items-center gap-1.5 mb-2.5">
            <span data-cursor="ap-resolved" className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide">Resolved</span>
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 leading-none">
              {showCardAInResolved ? '2' : '1'}
            </span>
          </div>

          {/* Card A — dropped in, slides in via mk-fade-up */}
          {showCardAInResolved && (
            <div
              className="bg-white rounded-lg border border-emerald-100 p-2 mb-1.5"
              style={{ animation: 'mk-fade-up 0.35s cubic-bezier(0.16,1,0.3,1) forwards' }}
            >
              <p className="text-[10px] text-slate-400 leading-snug line-through">
                Intro needs more audience context.
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-0.5">
                <CheckCircle2 size={9} className="text-emerald-500 flex-shrink-0" />
                <span className="text-emerald-600 font-medium">Admin</span>{" · "}just now
              </p>
            </div>
          )}

          {/* Pre-existing resolved card */}
          <div className="bg-white rounded-lg border border-slate-100 p-2">
            <p className="text-[10px] text-slate-400 leading-snug line-through">Update the footer links.</p>
            <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-0.5">
              <CheckCircle2 size={9} className="text-emerald-500 flex-shrink-0" />
              <span className="text-emerald-600 font-medium">Mark Kim</span>{" · "}1d ago
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

function EditorPreview() {
  type Phase =
    | 'idle' | 'moving_h2' | 'h2_clicked' | 'typing_heading'
    | 'typing_body' | 'typing_code' | 'selecting_code' | 'moving_code'
    | 'typing_sentence' | 'selecting' | 'moving_bold' | 'done';

  const HEADING      = 'Introducing Canopy 2.0';
  const BODY         = "We're excited to announce the release of Canopy 2.0, bringing major improvements to the content workflow and schema builder.";
  const CODE_TEXT    = 'npm install @canopy/sdk';
  const SENT_BEFORE  = 'The schema builder lets you define typed fields with ';
  const SENT_TARGET  = 'full type safety';
  const SENT_AFTER   = ' end-to-end.';
  const FULL_SENTENCE = SENT_BEFORE + SENT_TARGET + SENT_AFTER;
  const T_START = SENT_BEFORE.length;
  const T_END   = T_START + SENT_TARGET.length;

  const [phase, setPhase] = useState<Phase>('idle');
  const [typedHeading, setTypedHeading] = useState('');
  const [typedBody, setTypedBody] = useState('');
  const [typedCode, setTypedCode] = useState('');
  const [codeSelected, setCodeSelected] = useState(false);
  const [codeActive, setCodeActive] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [typedSentence, setTypedSentence] = useState('');
  const [targetSelected, setTargetSelected] = useState(false);
  const [targetBolded, setTargetBolded] = useState(false);
  const [h2Active, setH2Active] = useState(false);
  const [boldActive, setBoldActive] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [cursorClicking, setCursorClicking] = useState(false);

  const moveTo = useCallback((selector: string) => {
    const c = containerRef.current;
    if (!c) return;
    const el = c.querySelector<HTMLElement>(`[data-cursor="${selector}"]`);
    if (!el) return;
    const cr = c.getBoundingClientRect(), er = el.getBoundingClientRect();
    setCursorPos({ x: er.left - cr.left + er.width / 2, y: er.top - cr.top + er.height / 2 });
  }, []);

  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, fn: () => void) => { ts.push(setTimeout(fn, ms)); };

    if (phase === 'idle') {
      setTypedHeading(''); setTypedBody(''); setTypedCode('');
      setCodeSelected(false); setCodeActive(false); setShowCode(false);
      setTypedSentence(''); setTargetSelected(false); setTargetBolded(false);
      setH2Active(false); setBoldActive(false);
      setCursorPos(null); setCursorClicking(false);
      later(900, () => setPhase('moving_h2'));
    }

    else if (phase === 'moving_h2') {
      moveTo('ed-h2');
      later(580, () => setCursorClicking(true));
      later(760, () => { setCursorClicking(false); setH2Active(true); setPhase('h2_clicked'); });
    }

    else if (phase === 'h2_clicked') {
      later(120, () => moveTo('ed-body'));
      later(680, () => setCursorClicking(true));
      later(860, () => { setCursorClicking(false); setCursorPos(null); setPhase('typing_heading'); });
    }

    else if (phase === 'typing_heading') {
      HEADING.split('').forEach((_, i) => {
        later(60 + i * 65, () => setTypedHeading(HEADING.slice(0, i + 1)));
      });
      const done = 60 + (HEADING.length - 1) * 65 + 280;
      later(done, () => setPhase('typing_body'));
    }

    else if (phase === 'typing_body') {
      BODY.split('').forEach((_, i) => {
        later(i * 26, () => setTypedBody(BODY.slice(0, i + 1)));
      });
      const done = (BODY.length - 1) * 26 + 350;
      later(done, () => setPhase('typing_code'));
    }

    else if (phase === 'typing_code') {
      CODE_TEXT.split('').forEach((_, i) => {
        later(i * 38, () => setTypedCode(CODE_TEXT.slice(0, i + 1)));
      });
      const done = (CODE_TEXT.length - 1) * 38 + 300;
      later(done, () => setPhase('selecting_code'));
    }

    else if (phase === 'selecting_code') {
      setCodeSelected(true);
      later(60, () => moveTo('ed-body'));
      later(620, () => setPhase('moving_code'));
    }

    else if (phase === 'moving_code') {
      moveTo('ed-code');
      later(560, () => setCursorClicking(true));
      later(740, () => {
        setCursorClicking(false);
        setCodeActive(true);
        setCodeSelected(false);
        setTypedCode('');
        setShowCode(true);
        setCursorPos(null);
      });
      later(980, () => { setCodeActive(false); setPhase('typing_sentence'); });
    }

    else if (phase === 'typing_sentence') {
      FULL_SENTENCE.split('').forEach((_, i) => {
        later(i * 30, () => setTypedSentence(FULL_SENTENCE.slice(0, i + 1)));
      });
      const done = (FULL_SENTENCE.length - 1) * 30 + 350;
      later(done, () => setPhase('selecting'));
    }

    else if (phase === 'selecting') {
      setTargetSelected(true);
      later(60, () => moveTo('ed-body'));
      later(620, () => setPhase('moving_bold'));
    }

    else if (phase === 'moving_bold') {
      moveTo('ed-bold');
      later(560, () => setCursorClicking(true));
      later(740, () => {
        setCursorClicking(false);
        setBoldActive(true);
        setTargetSelected(false);
        setTargetBolded(true);
        setPhase('done');
      });
    }

    else if (phase === 'done') {
      later(2200, () => setPhase('idle'));
    }

    return () => ts.forEach(clearTimeout);
  }, [phase, moveTo]);

  const showHeadingCaret = phase === 'h2_clicked' || phase === 'typing_heading';
  const showBodyCaret    = phase === 'typing_body';
  const showCodeCaret    = phase === 'typing_code';
  const showSentCaret    = phase === 'typing_sentence';

  const sentBefore = typedSentence.slice(0, T_START);
  const sentTarget = typedSentence.slice(T_START, T_END);
  const sentAfter  = typedSentence.slice(T_END);

  const sep = <span className="w-px h-4 bg-slate-200 mx-1 flex-shrink-0" />;
  const tbBtn = (Icon: React.ElementType, active = false, dc?: string) => (
    <span
      {...(dc ? { 'data-cursor': dc } : {})}
      className={`p-1.5 rounded flex-shrink-0 ${active ? "bg-indigo-100 text-indigo-700" : "text-slate-500"}`}
    >
      <Icon size={13} />
    </span>
  );

  return (
    <div ref={containerRef} className="pointer-events-none select-none w-full" style={{ position: 'relative' }}>
      {cursorPos && <MiniCursor x={cursorPos.x} y={cursorPos.y} clicking={cursorClicking} />}

      <div className="rounded-lg border border-slate-300 overflow-hidden bg-white">

        {/* Toolbar */}
        <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-slate-200 bg-slate-50">
          {tbBtn(Bold,         boldActive,  'ed-bold')}
          {tbBtn(Italic)}
          {sep}
          {tbBtn(Heading2,    h2Active,    'ed-h2')}
          {tbBtn(Heading3)}
          {sep}
          {tbBtn(List)}
          {tbBtn(ListOrdered)}
          {sep}
          {tbBtn(Quote)}
          {tbBtn(Code,        codeActive,  'ed-code')}
          {tbBtn(Minus)}
          {sep}
          {tbBtn(ImageIcon)}
        </div>

        {/* Editor content */}
        <div data-cursor="ed-body" className="p-3 h-[300px] overflow-hidden space-y-2">

          {/* Heading — appears once H2 is activated */}
          {(h2Active || typedHeading) && (
            <div className="text-sm font-bold text-slate-900 leading-snug flex items-center">
              <span>{typedHeading}</span>
              {showHeadingCaret && (
                <span className="inline-block w-0.5 h-[17px] bg-slate-800 ml-px flex-shrink-0" />
              )}
            </div>
          )}

          {/* Body paragraph */}
          {typedBody && (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {typedBody}
              {showBodyCaret && (
                <span className="inline-block w-0.5 h-[13px] bg-slate-500 ml-px" />
              )}
            </p>
          )}

          {/* Code — plain text while typing, selection highlight, then formatted block */}
          {typedCode && !showCode && (
            <p className="text-[11px] text-slate-500 font-mono">
              <span className={codeSelected ? 'bg-indigo-200 text-indigo-800 rounded-[2px] px-px' : ''}>
                {typedCode}
              </span>
              {showCodeCaret && <span className="inline-block w-0.5 h-[13px] bg-slate-500 ml-px" />}
            </p>
          )}
          {showCode && (
            <div
              className="inline-flex items-center gap-1 bg-slate-100 rounded px-2 py-1"
              style={{ animation: 'mk-fade-up 0.25s ease-out' }}
            >
              <span className="text-slate-400 text-[10px] font-mono">$</span>
              <span className="text-indigo-600 text-[10px] font-mono">npm install @canopy/sdk</span>
            </div>
          )}

          {/* Sentence with selection highlight → bold */}
          {typedSentence && (
            <p className="text-[11px] text-slate-500">
              {sentBefore}
              {sentTarget && (
                targetBolded
                  ? <strong className="font-semibold text-slate-700">{sentTarget}</strong>
                  : <span className={targetSelected ? 'bg-indigo-200 text-indigo-800 rounded-[2px] px-px' : ''}>{sentTarget}</span>
              )}
              {sentAfter}
              {showSentCaret && <span className="inline-block w-0.5 h-[13px] bg-slate-500 ml-px" />}
            </p>
          )}

        </div>
      </div>
    </div>
  );
}

function ApiPreview() {
  const FULL_PATH = '/api/v1/canopy-website/blog-posts';
  const SLUG_IDX = 9; // start of 'canopy-website' in FULL_PATH

  type Phase = 'idle' | 'typing' | 'sending' | 'loading' | 'response';
  const [phase, setPhase] = useState<Phase>('idle');
  const [typed, setTyped] = useState('');
  const [cursorOn, setCursorOn] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [cursorClicking, setCursorClicking] = useState(false);

  const moveTo = useCallback((sel: string) => {
    const c = containerRef.current;
    if (!c) return;
    const el = c.querySelector<HTMLElement>(`[data-cursor="${sel}"]`);
    if (!el) return;
    const cr = c.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    setCursorPos({ x: er.left - cr.left + er.width / 2, y: er.top - cr.top + er.height / 2 });
  }, []);

  // Blinking caret
  useEffect(() => {
    const id = setInterval(() => setCursorOn(v => !v), 530);
    return () => clearInterval(id);
  }, []);

  // idle → typing; move cursor to url input
  useEffect(() => {
    if (phase !== 'idle') return;
    const t1 = setTimeout(() => moveTo('api-url'), 350);
    const t2 = setTimeout(() => setPhase('typing'), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase, moveTo]);

  // Advance one character at a time, then move cursor to Send and fire
  useEffect(() => {
    if (phase !== 'typing') return;
    if (typed.length < FULL_PATH.length) {
      const t = setTimeout(() => setTyped(FULL_PATH.slice(0, typed.length + 1)), 48);
      return () => clearTimeout(t);
    }
    // Typing done — slide cursor to Send button, then send
    const t1 = setTimeout(() => moveTo('api-send'), 180);
    const t2 = setTimeout(() => setPhase('sending'), 450);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase, typed, moveTo]);

  // sending → loading → response → idle; drive cursor clicks & moves
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (phase === 'sending') {
      moveTo('api-send');
      setCursorClicking(true);
      timers.push(setTimeout(() => setCursorClicking(false), 220));
      timers.push(setTimeout(() => setPhase('loading'), 250));
    }
    if (phase === 'loading') timers.push(setTimeout(() => setPhase('response'), 700));
    if (phase === 'response') {
      timers.push(setTimeout(() => moveTo('api-json'), 400));
      timers.push(setTimeout(() => { setTyped(''); setPhase('idle'); }, 4500));
    }
    return () => timers.forEach(clearTimeout);
  }, [phase, moveTo]);

  const renderPath = (path: string) => {
    if (path.length <= SLUG_IDX)
      return <span className="text-slate-400">{path}</span>;
    return (
      <>
        <span className="text-slate-400">{path.slice(0, SLUG_IDX)}</span>
        <span className="text-slate-200">{path.slice(SLUG_IDX, SLUG_IDX + 14)}</span>
        <span className="text-slate-400">{path.slice(SLUG_IDX + 14)}</span>
      </>
    );
  };

  return (
    <div ref={containerRef} className="pointer-events-none select-none w-full h-full min-h-[350px] sm:min-h-0" style={{ position: 'relative' }}>
      {cursorPos && <MiniCursor x={cursorPos.x} y={cursorPos.y} clicking={cursorClicking} />}

      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-sm h-full flex flex-col">

        {/* Request bar */}
        <div className="flex flex-col sm:flex-row sm:items-stretch gap-2 px-3 py-3 border-b border-slate-800">
          <div className="flex flex-1 items-stretch rounded-lg border border-slate-700 overflow-hidden bg-slate-900 min-w-0">
            <span className="flex items-center px-2.5 bg-slate-800 border-r border-slate-700 text-[10px] font-bold text-emerald-400 flex-shrink-0">
              GET
            </span>
            <span data-cursor="api-url" className="flex-1 px-2.5 py-1.5 text-[10px] font-mono flex items-center min-w-0 overflow-hidden">
              {phase === 'idle' ? (
                <span className="flex items-center text-slate-600">
                  /api/v1/…
                  <span className={`inline-block w-0.5 h-3 bg-slate-600 ml-0.5 transition-opacity duration-100 ${cursorOn ? 'opacity-100' : 'opacity-0'}`} />
                </span>
              ) : (
                <span className="flex items-center min-w-0 overflow-hidden">
                  <span className="truncate">{renderPath(typed)}</span>
                  {phase === 'typing' && (
                    <span className={`inline-block w-0.5 h-3 bg-slate-300 ml-0.5 flex-shrink-0 transition-opacity duration-100 ${cursorOn ? 'opacity-100' : 'opacity-0'}`} />
                  )}
                </span>
              )}
            </span>
          </div>
          {/* Send button */}
          <div
            data-cursor="api-send"
            className={`flex items-center justify-center gap-1 rounded-lg px-2.5 py-2 sm:py-0 text-[10px] font-medium text-white transition-all duration-150 ${
              phase === 'sending' ? 'bg-indigo-700 scale-95 opacity-70' : 'bg-indigo-600'
            }`}
          >
            <Send size={10} />
            Send
          </div>
        </div>

        {/* Status bar — always rendered; fades in on response */}
        <div className={`flex items-center gap-3 px-3 py-1.5 border-b border-slate-800/60 bg-slate-900/40 transition-opacity duration-300 ${
          phase === 'response' ? 'opacity-100' : 'opacity-0'
        }`}>
          <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">200 OK</span>
          <span className="text-[9px] text-slate-600">12ms</span>
          <span className="text-[9px] text-slate-600">·</span>
          <span className="text-[9px] text-slate-600">348 B</span>
        </div>

        {/* Response area — flex-1 fills remaining card height so no gap shows */}
        <div className="p-3.5 flex-1 overflow-hidden">
          {phase === 'loading' && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-slate-800 border-t-indigo-500 animate-spin flex-shrink-0" />
              <span className="text-[10px] font-mono text-slate-600">Fetching…</span>
            </div>
          )}
          {phase === 'response' && (
            <div
              data-cursor="api-json"
              className="text-[10px] font-mono space-y-0.5 leading-relaxed"
              style={{ animation: 'mk-fade-up 0.35s cubic-bezier(0.16,1,0.3,1) forwards' }}
            >
              <div><span className="text-slate-500">{"{"}</span></div>
              <div className="pl-3 space-y-0.5">
                <div><span className="text-sky-300">&quot;entries&quot;</span><span className="text-slate-500">: [</span></div>
                <div className="pl-3 space-y-0.5">
                  <div><span className="text-slate-500">{"{"}</span></div>
                  <div className="pl-3">
                    <div><span className="text-sky-300">&quot;slug&quot;</span><span className="text-slate-500">: </span><span className="text-amber-300">&quot;canopy-2-0&quot;</span><span className="text-slate-500">,</span></div>
                    <div><span className="text-sky-300">&quot;title&quot;</span><span className="text-slate-500">: </span><span className="text-amber-300">&quot;Introducing Canopy 2.0&quot;</span><span className="text-slate-500">,</span></div>
                    <div><span className="text-sky-300">&quot;published&quot;</span><span className="text-slate-500">: </span><span className="text-fuchsia-300">true</span></div>
                  </div>
                  <div><span className="text-slate-500">{"}"}</span></div>
                </div>
                <div><span className="text-slate-500">],</span></div>
                <div><span className="text-sky-300">&quot;total&quot;</span><span className="text-slate-500">: </span><span className="text-emerald-300">24</span><span className="text-slate-500">,</span></div>
                <div><span className="text-sky-300">&quot;page&quot;</span><span className="text-slate-500">: </span><span className="text-emerald-300">1</span></div>
              </div>
              <div><span className="text-slate-500">{"}"}</span></div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function WebhooksPreview() {
  type Phase = 'idle' | 'moving_toggle' | 'toggled' | 'sending' | 'success';

  const [phase, setPhase] = useState<Phase>('idle');
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackStatus, setSlackStatus] = useState<'timeout' | 'sending' | 'ok'>('timeout');
  const [pulsing, setPulsing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [cursorClicking, setCursorClicking] = useState(false);

  const moveTo = useCallback((selector: string) => {
    const c = containerRef.current;
    if (!c) return;
    const el = c.querySelector<HTMLElement>(`[data-cursor="${selector}"]`);
    if (!el) return;
    const cr = c.getBoundingClientRect(), er = el.getBoundingClientRect();
    setCursorPos({ x: er.left - cr.left + er.width / 2, y: er.top - cr.top + er.height / 2 });
  }, []);

  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, fn: () => void) => { ts.push(setTimeout(fn, ms)); };

    if (phase === 'idle') {
      setSlackEnabled(false); setSlackStatus('timeout');
      setPulsing(false); setCursorPos(null); setCursorClicking(false);
      later(900, () => setPhase('moving_toggle'));
    }

    else if (phase === 'moving_toggle') {
      moveTo('wh-toggle-vercel');
      later(480, () => moveTo('wh-toggle-slack'));
      later(1080, () => setCursorClicking(true));
      later(1260, () => { setCursorClicking(false); setSlackEnabled(true); setPhase('toggled'); });
    }

    else if (phase === 'toggled') {
      later(380, () => { setSlackStatus('sending'); setPhase('sending'); });
    }

    else if (phase === 'sending') {
      later(820, () => { setSlackStatus('ok'); setPulsing(true); setPhase('success'); });
    }

    else if (phase === 'success') {
      later(500, () => setPulsing(false));
      later(2600, () => setPhase('idle'));
    }

    return () => ts.forEach(clearTimeout);
  }, [phase, moveTo]);

  const evBadge = (label: string) => (
    <span key={label} className="text-[7.5px] font-medium bg-slate-800 text-slate-300 border border-slate-700 px-1 py-0.5 rounded-sm leading-none">
      {label}
    </span>
  );

  return (
    <div ref={containerRef} className="pointer-events-none select-none w-full h-full" style={{ position: 'relative' }}>
      {cursorPos && <MiniCursor x={cursorPos.x} y={cursorPos.y} clicking={cursorClicking} />}

      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-sm h-full flex flex-col">

        {/* Table header */}
        <div className="grid grid-cols-[1fr_68px_52px_16px] gap-2 items-center px-3.5 py-2 border-b border-slate-800 bg-slate-900/50">
          <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Name</span>
          <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Events</span>
          <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Status</span>
          <span />
        </div>

        {/* Vercel row — static */}
        <div className="grid grid-cols-[1fr_68px_52px_16px] gap-2 items-center px-3.5 py-2.5 border-b border-slate-800/60">
          <div className="min-w-0">
            <div className="text-[10px] font-medium text-slate-200 truncate">Vercel Revalidation</div>
            <code className="text-[8px] font-mono text-slate-600 truncate block">api.vercel.com/v1/deploy-hooks/…</code>
          </div>
          <div className="flex flex-wrap gap-0.5">{evBadge('Created')}{evBadge('Updated')}</div>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded w-fit text-emerald-400 bg-emerald-400/10">200 OK</span>
          <span data-cursor="wh-toggle-vercel" className="flex-shrink-0">
            <ToggleRight size={13} className="text-indigo-400" />
          </span>
        </div>

        {/* Slack row — animated */}
        <div className={`grid grid-cols-[1fr_68px_52px_16px] gap-2 items-center px-3.5 py-2.5 transition-opacity duration-300 ${slackEnabled ? 'opacity-100' : 'opacity-50'}`}>
          <div className="min-w-0">
            <div className="text-[10px] font-medium text-slate-200 truncate">Slack Notify</div>
            <code className="text-[8px] font-mono text-slate-600 truncate block">hooks.slack.com/services/T0…</code>
          </div>
          <div className="flex flex-wrap gap-0.5">{evBadge('Created')}</div>

          {/* Status — three states */}
          <div className="relative flex items-center h-[18px]">
            {slackStatus === 'timeout' && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded text-rose-400 bg-rose-400/10">Timeout</span>
            )}
            {slackStatus === 'sending' && (
              <div className="w-2.5 h-2.5 rounded-full border border-slate-700 border-t-indigo-400 animate-spin" />
            )}
            {slackStatus === 'ok' && (
              <div className="relative">
                {pulsing && (
                  <span className="absolute -inset-1 rounded bg-emerald-400/25"
                    style={{ animation: 'mk-ripple 0.55s ease-out forwards' }} />
                )}
                <span
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded text-emerald-400 bg-emerald-400/10 relative"
                  style={{ animation: 'mk-fade-up 0.22s ease-out' }}
                >
                  200 OK
                </span>
              </div>
            )}
          </div>

          {/* Toggle */}
          <span data-cursor="wh-toggle-slack" className="flex-shrink-0">
            {slackEnabled
              ? <ToggleRight size={13} className="text-indigo-400 transition-all duration-200" />
              : <ToggleLeft  size={13} className="text-slate-600 transition-all duration-200" />
            }
          </span>
        </div>

      </div>
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

interface FeatureCardProps {
  title: string;
  body: string;
  preview: React.ReactNode;
  dark?: boolean;
  className?: string;
}

function FeatureCard({ title, body, preview, dark, className = "" }: FeatureCardProps) {
  return (
    <div className={`h-full flex flex-col rounded-2xl border overflow-hidden transition-all duration-200 ${dark ? "bg-slate-950 border-slate-800 hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5" : "bg-white border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5"} ${className}`}>
      <div className="flex-1 p-3 sm:p-5 pb-0">{preview}</div>
      <div className="p-5 pt-4">
        <h3 className={`font-bold text-lg mb-1.5 ${dark ? "text-white" : "text-slate-900"}`}>{title}</h3>
        <p className={`text-sm leading-relaxed ${dark ? "text-slate-400" : "text-slate-500"}`}>{body}</p>
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="py-12 sm:py-32 bg-slate-50 relative overflow-hidden"
      aria-labelledby="features-heading"
    >
      <div className="max-w-7xl mx-auto px-6">
        <ScrollReveal className="text-center mb-8 sm:mb-20">
          <h2
            id="features-heading"
            className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-5"
          >
            Everything your content
            <br className="hidden sm:block" /> team needs
          </h2>
          <p className="text-slate-600 text-lg leading-relaxed max-w-2xl mx-auto">
            From schema design to client approval. Canopy brings every stage of the
            content lifecycle into one structured, collaborative platform.
          </p>
        </ScrollReveal>

        {/* Row 1: Schema (wide) + Approval */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <ScrollReveal className="lg:col-span-2" delay={0}>
            <FeatureCard
              title="Schema Builder"
              body="Define your content structure with typed fields — text, date, rich text, media, and more. Every project gets its own schema, enforced end-to-end through the API."
              preview={<SchemaPreview />}
            />
          </ScrollReveal>
          <ScrollReveal delay={65}>
            <FeatureCard
              title="Client Review & Approval"
              body="Clients see exactly what they need, leave threaded comments, and approve or request changes — all without touching a single editor setting."
              preview={<ApprovalPreview />}
            />
          </ScrollReveal>
        </div>

        {/* Row 2: Editor + API (dark) + Security */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ScrollReveal delay={130}>
            <FeatureCard
              title="Rich Content Editor"
              body="A polished block editor with headings, code blocks, inline media, and keyboard shortcuts — everything contributors need to write and format great content."
              preview={<EditorPreview />}
            />
          </ScrollReveal>
          <ScrollReveal delay={195}>
            <FeatureCard
              dark
              title="REST API Built-in"
              body="Every project gets a versioned REST API automatically. Fetch entries, filter by field, and integrate with any front-end framework or deployment pipeline."
              preview={<ApiPreview />}
            />
          </ScrollReveal>
          <ScrollReveal delay={260}>
            <FeatureCard
              dark
              title="Webhooks & Events"
              body="Fire real-time events on every content action. Connect Canopy to your deployment pipeline, Slack, CRM, or any custom HTTP endpoint."
              preview={<WebhooksPreview />}
            />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
