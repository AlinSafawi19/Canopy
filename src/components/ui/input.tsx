"use client";

import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  showToggle?: boolean;
  hideRequiredMark?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, type, showToggle, required, hideRequiredMark, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const resolvedType = type === "password" && showToggle
      ? (showPassword ? "text" : "password")
      : type;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs sm:text-sm font-medium text-slate-700">
            {label}{required && !hideRequiredMark && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            id={inputId}
            ref={ref}
            type={resolvedType}
            className={cn(
              "h-8 sm:h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 sm:px-3 text-sm text-slate-900 placeholder:text-slate-400",
              "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
              "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
              "transition-shadow duration-150",
              showToggle && type === "password" && "pr-9",
              error && "border-red-400 focus:ring-red-400",
              className
            )}
            {...props}
          />
          {showToggle && type === "password" && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
