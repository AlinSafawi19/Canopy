"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

const toastContext: {
  listeners: ((toast: Toast) => void)[];
  add: (toast: Omit<Toast, "id">) => void;
  lastToasts: Map<string, number>;
} = {
  listeners: [],
  lastToasts: new Map(),
  add(toast) {
    const key = `${toast.type}:${toast.title}`;
    const now = Date.now();
    const lastTime = this.lastToasts.get(key) || 0;

    // Prevent duplicate toasts within 5 seconds
    if (now - lastTime < 5000) {
      return;
    }

    this.lastToasts.set(key, now);
    const id = Math.random().toString(36).slice(2);
    this.listeners.forEach((listener) => listener({ ...toast, id }));
  },
};

export function useToast() {
  return {
    success: (title: string, message?: string) =>
      toastContext.add({ type: "success", title, message, duration: 4000 }),
    error: (title: string, message?: string) =>
      toastContext.add({ type: "error", title, message }),
    warning: (title: string, message?: string) =>
      toastContext.add({ type: "warning", title, message, duration: 5000 }),
    info: (title: string, message?: string) =>
      toastContext.add({ type: "info", title, message, duration: 4000 }),
  };
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(onClose, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, onClose]);

  const iconMap = {
    success: <CheckCircle size={18} className="text-emerald-600" />,
    error: <AlertTriangle size={18} className="text-red-600" />,
    warning: <AlertTriangle size={18} className="text-amber-600" />,
    info: <Info size={18} className="text-blue-600" />,
  };

  const bgMap = {
    success: "bg-emerald-50 border-emerald-200",
    error: "bg-red-50 border-red-200",
    warning: "bg-amber-50 border-amber-200",
    info: "bg-blue-50 border-blue-200",
  };

  const textMap = {
    success: "text-emerald-700",
    error: "text-red-700",
    warning: "text-amber-700",
    info: "text-blue-700",
  };

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${bgMap[toast.type]} animate-in fade-in slide-in-from-right`}>
      <div className="flex-shrink-0 mt-0.5">{iconMap[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${textMap[toast.type]}`}>{toast.title}</p>
        {toast.message && <p className={`text-xs ${textMap[toast.type]} opacity-80 mt-0.5`}>{toast.message}</p>}
      </div>
      <button
        onClick={onClose}
        className={`flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors mt-0.5`}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (toast: Toast) => {
      setToasts((prev) => [...prev, toast]);
    };
    toastContext.listeners.push(listener);
    return () => {
      toastContext.listeners = toastContext.listeners.filter((l) => l !== listener);
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-3 max-w-md pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem
            toast={toast}
            onClose={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
          />
        </div>
      ))}
    </div>
  );
}
