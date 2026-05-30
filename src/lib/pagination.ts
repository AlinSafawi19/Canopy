export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export function parsePage(raw: string | undefined): number {
  const n = parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function parseLimit(raw: string | undefined): number {
  const n = parseInt(raw ?? String(DEFAULT_PAGE_SIZE), 10);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

export function parseSearch(raw: string | undefined): string {
  return raw?.trim() ?? "";
}

export function parseSortDir(raw: string | undefined): "asc" | "desc" {
  return raw === "asc" ? "asc" : "desc";
}

export function parseSortBy<T extends string>(raw: string | undefined, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(raw ?? "") ? (raw as T) : fallback;
}

export function paginationArgs(page: number, limit = DEFAULT_PAGE_SIZE) {
  return { skip: (page - 1) * limit, take: limit };
}

export function paginationMeta(total: number, page: number, limit = DEFAULT_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { total, page, limit, totalPages };
}
