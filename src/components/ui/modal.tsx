"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  isDirty?: boolean;
}

export interface ModalRef {
  attemptClose: () => void;
}

export const Modal = forwardRef<ModalRef, ModalProps>(function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  isDirty = false,
}, ref) {
  const [confirmingClose, setConfirmingClose] = useState(false);

  const attemptClose = useCallback(() => {
    if (isDirty) {
      setConfirmingClose(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const forceClose = useCallback(() => {
    setConfirmingClose(false);
    onClose();
  }, [onClose]);

  useImperativeHandle(ref, () => ({ attemptClose }), [attemptClose]);

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
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <button
              onClick={attemptClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">{children}</div>

        {confirmingClose && (
          <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-[2px] rounded-xl flex items-center justify-center p-6">
            <div className="text-center space-y-3">
              <p className="text-sm font-semibold text-slate-800">Discard unsaved changes?</p>
              <p className="text-xs text-slate-500">Your changes will be lost if you close now.</p>
              <div className="flex gap-3 justify-center pt-1">
                <button
                  onClick={() => setConfirmingClose(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Keep editing
                </button>
                <button
                  onClick={forceClose}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
});
