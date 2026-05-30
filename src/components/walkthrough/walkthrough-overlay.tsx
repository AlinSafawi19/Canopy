"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { type SessionRole } from "@/lib/auth";
import { getWalkthroughSteps } from "@/lib/walkthrough-steps";

interface SpotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TooltipPos {
  left?: number | string;
  top?: number | string;
  transform?: string;
}

const TOOLTIP_W = 296;
const TOOLTIP_H = 200;
const SPOT_PAD = 8;
const SPOT_RADIUS = 10;
const GAP = 12;

function computeTooltip(rect: SpotRect | null): TooltipPos {
  if (!rect) {
    return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  }
  const vh = window.innerHeight;
  const vw = window.innerWidth;

  let top: number;
  if (rect.y + rect.h + SPOT_PAD + GAP + TOOLTIP_H <= vh) {
    top = rect.y + rect.h + SPOT_PAD + GAP;
  } else if (rect.y - SPOT_PAD - GAP - TOOLTIP_H >= 0) {
    top = rect.y - SPOT_PAD - GAP - TOOLTIP_H;
  } else {
    top = vh / 2 - TOOLTIP_H / 2;
  }

  let left = rect.x + rect.w / 2 - TOOLTIP_W / 2;
  left = Math.max(16, Math.min(left, vw - TOOLTIP_W - 16));

  return { left, top };
}

export function WalkthroughOverlay({ role }: { role: SessionRole }) {
  const router = useRouter();
  const pathname = usePathname();
  const steps = getWalkthroughSteps(role);

  const [stepIdx, setStepIdx] = useState(0);
  const [spotRect, setSpotRect] = useState<SpotRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPos>({
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
  });
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number>(0);

  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;

  // Fade in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Navigate to the step's page if not already there
  useEffect(() => {
    if (step.page && pathname !== step.page) {
      router.push(step.page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  // Track target element position with rAF
  useEffect(() => {
    if (!step.target) {
      setSpotRect(null);
      setTooltipPos({ left: "50%", top: "50%", transform: "translate(-50%, -50%)" });
      return;
    }

    function tick() {
      const el = document.querySelector(step.target!);
      if (el) {
        const r = el.getBoundingClientRect();
        const next: SpotRect = { x: r.left, y: r.top, w: r.width, h: r.height };
        setSpotRect((prev) => {
          if (
            prev &&
            Math.abs(prev.x - next.x) < 0.5 &&
            Math.abs(prev.y - next.y) < 0.5 &&
            Math.abs(prev.w - next.w) < 0.5 &&
            Math.abs(prev.h - next.h) < 0.5
          ) {
            return prev;
          }
          setTooltipPos(computeTooltip(next));
          return next;
        });
      } else {
        setSpotRect(null);
        setTooltipPos({ left: "50%", top: "50%", transform: "translate(-50%, -50%)" });
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [stepIdx, pathname, step.target]);

  const finish = useCallback(async () => {
    cancelAnimationFrame(rafRef.current);
    setVisible(false);
    await apiFetch("/api/auth/walkthrough-complete", { method: "POST" });
    router.refresh();
  }, [router]);

  const handleNext = useCallback(() => {
    if (isLast) {
      finish();
    } else {
      setStepIdx((i) => i + 1);
    }
  }, [isLast, finish]);

  const sx = spotRect ? spotRect.x - SPOT_PAD : 0;
  const sy = spotRect ? spotRect.y - SPOT_PAD : 0;
  const sw = spotRect ? spotRect.w + SPOT_PAD * 2 : 0;
  const sh = spotRect ? spotRect.h + SPOT_PAD * 2 : 0;

  return (
    // Outer wrapper blocks ALL pointer events — nothing in the app is clickable
    <div
      className="fixed inset-0 transition-opacity duration-500"
      style={{ zIndex: 9990, opacity: visible ? 1 : 0, pointerEvents: "auto" }}
    >
      {/* Dark overlay with spotlight cutout */}
      {spotRect ? (
        <svg
          className="fixed inset-0 w-full h-full"
          style={{ zIndex: 9991, pointerEvents: "none" }}
          aria-hidden
        >
          <defs>
            <mask id="wt-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect x={sx} y={sy} width={sw} height={sh} rx={SPOT_RADIUS} fill="black" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(15,23,42,0.72)" mask="url(#wt-mask)" />
          {/* Indigo spotlight ring */}
          <rect
            x={sx - 2}
            y={sy - 2}
            width={sw + 4}
            height={sh + 4}
            rx={SPOT_RADIUS + 2}
            fill="none"
            stroke="rgba(99,102,241,0.7)"
            strokeWidth="2"
          />
        </svg>
      ) : (
        <div
          className="fixed inset-0"
          style={{ zIndex: 9991, background: "rgba(15,23,42,0.72)", pointerEvents: "none" }}
          aria-hidden
        />
      )}

      {/* Tooltip card — only interactive element */}
      <div
        className="fixed bg-white rounded-xl border border-slate-200 shadow-2xl"
        style={{ zIndex: 9993, width: TOOLTIP_W, pointerEvents: "auto", ...tooltipPos }}
      >
        {/* Progress bar */}
        <div className="h-1 bg-slate-100 rounded-t-xl overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400 tabular-nums">
              Step {stepIdx + 1} of {steps.length}
            </span>
            <button
              onClick={finish}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
            >
              <X size={12} />
              Skip tour
            </button>
          </div>

          <h3 className="text-sm font-semibold text-slate-900 mb-1.5 leading-snug">
            {step.title}
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">
            {step.description}
          </p>

          <button
            onClick={handleNext}
            className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-2.5 rounded-lg transition-colors"
          >
            {isLast ? "Get started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
