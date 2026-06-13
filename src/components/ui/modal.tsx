"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "./button";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/lib/use-scroll-lock";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Action rendered in the header row, to the left of the close button. */
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  /** Sticky footer rendered below the scrollable content — put action buttons here. */
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  isDirty?: boolean;
  /** While true, the modal can't be closed (X / backdrop / Escape) — use during in-flight actions. */
  busy?: boolean;
}

export interface ModalRef {
  attemptClose: () => void;
}

export const Modal = forwardRef<ModalRef, ModalProps>(function Modal({
  open,
  onClose,
  title,
  headerAction,
  children,
  footer,
  size = "md",
  isDirty = false,
  busy = false,
}, ref) {
  const [confirmingClose, setConfirmingClose] = useState(false);

  const attemptClose = useCallback(() => {
    if (busy) return; // an action is running — block all close paths
    if (isDirty) {
      setConfirmingClose(true);
    } else {
      onClose();
    }
  }, [busy, isDirty, onClose]);

  const forceClose = useCallback(() => {
    setConfirmingClose(false);
    onClose();
  }, [onClose]);

  useImperativeHandle(ref, () => ({ attemptClose }), [attemptClose]);

  useScrollLock(open);

  useEffect(() => {
    if (!open) setConfirmingClose(false);
  }, [open]);

  useEffect(() => {
    if (!open || !isDirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [open, isDirty]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmingClose) setConfirmingClose(false);
        else attemptClose();
      }
    };
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, isDirty, confirmingClose, attemptClose]);

  if (!open) return null;

  const sizes = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={attemptClose}
      />
      <div
        className={cn(
          "relative bg-white rounded-xl shadow-2xl w-full flex flex-col max-h-[90vh]",
          sizes[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex-shrink-0">
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">{title}</h2>
            <div className="flex items-center gap-2">
              {headerAction}
              <button
                onClick={attemptClose}
                disabled={busy}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">{children}</div>
        {footer && (
          <div className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100">
            {footer}
          </div>
        )}

        {confirmingClose && (
          <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-[2px] rounded-xl flex items-center justify-center p-6">
            <div className="text-center space-y-3">
              <p className="text-sm font-semibold text-slate-800">Discard unsaved changes?</p>
              <p className="text-xs text-slate-500">Your changes will be lost if you close now.</p>
              <div className="flex gap-3 justify-center pt-1">
                <Button variant="outline" type="button" onClick={() => setConfirmingClose(false)}>
                  Keep editing
                </Button>
                <Button variant="danger" type="button" onClick={forceClose}>
                  Discard
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
});
