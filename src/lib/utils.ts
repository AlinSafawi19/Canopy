import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { nanoid } from "nanoid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(size = 21): string {
  return nanoid(size);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

export function stripRichText(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Returns a human-readable label for an entry by finding its first non-HTML, non-empty string value. */
export function getEntryLabel(values: Record<string, unknown>): string {
  const strs = Object.values(values).filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0
  );
  if (!strs.length) return "(empty)";
  const plain = strs.find((v) => !v.trimStart().startsWith("<")) ?? strs[0];
  const text = plain.trimStart().startsWith("<") ? stripRichText(plain) : plain;
  const trimmed = text.trim();
  return trimmed.length > 60 ? trimmed.slice(0, 57) + "…" : trimmed || "(empty)";
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
