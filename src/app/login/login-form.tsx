"use client";
import { apiFetch } from "@/lib/api-fetch";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lockoutEnd, setLockoutEnd] = useState<number | null>(null);
  const [lockoutCountdown, setLockoutCountdown] = useState<string>("");

  // Initialize lockout state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("login_lockout_end");

    if (stored) {
      const end = parseInt(stored);
      if (end > Date.now()) {
        setLockoutEnd(end);
      } else {
        localStorage.removeItem("login_lockout_end");
      }
    }

  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutEnd) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (lockoutEnd <= now) {
        setLockoutEnd(null);
        localStorage.removeItem("login_lockout_end");
        clearInterval(interval);
        return;
      }

      const remaining = lockoutEnd - now;
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setLockoutCountdown(`${mins}:${secs.toString().padStart(2, "0")}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutEnd]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (lockoutEnd && lockoutEnd > Date.now()) {
      setError("Account locked due to too many failed attempts. Please try again later.");
      return;
    }

    if (!username.trim()) { setError("Username is required."); return; }
    if (!password) { setError("Password is required."); return; }
    setLoading(true);

    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          // Account locked
          const retryAfter = parseInt(res.headers?.get("Retry-After") || "1800");
          const lockoutTime = Date.now() + retryAfter * 1000;
          localStorage.setItem("login_lockout_end", lockoutTime.toString());
          setLockoutEnd(lockoutTime);
        }
        setError(data.error ?? "Invalid credentials");
        return;
      }

      // Clear lockout state on success
      localStorage.removeItem("login_lockout_end");

      router.push(data.redirectTo);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Lockout alert with countdown */}
      {lockoutEnd && lockoutEnd > Date.now() && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          <AlertCircle size={16} className="flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Account locked</p>
            <p className="text-xs text-red-600 mt-1">
              Try again in: <span className="font-mono font-bold">{lockoutCountdown}</span>
            </p>
          </div>
        </div>
      )}

      <Input
        label="Username"
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Enter your username"
        autoComplete="username"
        required
        hideRequiredMark
        disabled={lockoutEnd ? lockoutEnd > Date.now() : false}
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium text-slate-700">
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          showToggle
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
          disabled={lockoutEnd ? lockoutEnd > Date.now() : false}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        size="lg"
        loading={loading}
        disabled={lockoutEnd ? lockoutEnd > Date.now() : false}
      >
        {lockoutEnd && lockoutEnd > Date.now() ? `Try again in ${lockoutCountdown}` : "Sign in"}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs text-slate-400">or</span>
        </div>
      </div>

      <p className="text-center text-sm text-slate-500">
        New admin?{" "}
        <Link href="/signup" className="text-indigo-600 hover:text-indigo-700 font-medium">
          Create an account
        </Link>
      </p>
    </form>
  );
}
