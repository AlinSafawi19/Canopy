"use client";

import { useState, useRef, useEffect, useId, createContext, useContext } from "react";
import { Button } from "./button";

const Ctx = createContext<{ close: () => void }>({ close: () => {} });

export function ActionMenu({ children }: { children: React.ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onOtherOpen(e: Event) {
      if ((e as CustomEvent).detail !== id) setOpen(false);
    }
    window.addEventListener("action-menu-open", onOtherOpen);
    return () => window.removeEventListener("action-menu-open", onOtherOpen);
  }, [id]);

  function handleToggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const right = window.innerWidth - rect.right;
      const spaceAbove = rect.top;
      if (spaceAbove < 200) {
        setPos({ top: rect.bottom + 4, right });
      } else {
        setPos({ bottom: window.innerHeight - rect.top + 4, right });
      }
      window.dispatchEvent(new CustomEvent("action-menu-open", { detail: id }));
    }
    setOpen((v) => !v);
  }

  return (
    <Ctx.Provider value={{ close: () => setOpen(false) }}>
      <div className="relative inline-block">
        <Button
          ref={triggerRef}
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={handleToggle}
        >
          ···
        </Button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              style={{ top: pos.top, bottom: pos.bottom, right: pos.right }}
              className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-44"
            >
              {children}
            </div>
          </>
        )}
      </div>
    </Ctx.Provider>
  );
}

type ItemVariant = "default" | "warning" | "danger" | "success";

const variantClasses: Record<ItemVariant, string> = {
  default: "text-slate-700 hover:bg-slate-50",
  warning: "text-amber-700 hover:bg-amber-50",
  danger: "text-red-600 hover:bg-red-50",
  success: "text-emerald-700 hover:bg-emerald-50",
};

export function ActionMenuItem({
  onClick,
  variant = "default",
  disabled,
  children,
}: {
  onClick: () => void;
  variant?: ItemVariant;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { close } = useContext(Ctx);

  return (
    <button
      onClick={() => { close(); onClick(); }}
      disabled={disabled}
      className={`flex items-center w-full px-3 py-2 text-sm disabled:opacity-50 ${variantClasses[variant]}`}
    >
      {children}
    </button>
  );
}
