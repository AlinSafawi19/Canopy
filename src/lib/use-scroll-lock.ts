"use client";

import { useEffect } from "react";

// Reference-counted body scroll lock. Multiple overlays can be open at once
// (e.g. a modal on top of the mobile sidebar); the page only regains scroll
// when the last one releases. paddingRight compensates for the vanishing
// scrollbar so the layout behind the overlay doesn't shift.
let lockCount = 0;
let prevOverflow = "";
let prevPaddingRight = "";

function lock() {
  if (lockCount === 0) {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    prevOverflow = document.body.style.overflow;
    prevPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
  lockCount += 1;
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = prevOverflow;
    document.body.style.paddingRight = prevPaddingRight;
  }
}

/** Prevents the page behind an overlay from scrolling while `active` is true. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
}
