"use client";

import { useRouter } from "next/navigation";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { Select } from "./select";

interface Props {
  limit: number;
  basePath: string;
  extraParams?: Record<string, string>;
  pageParam?: string;
  limitParam?: string;
}

export function PerPageSelector({ limit, basePath, extraParams, pageParam = "page", limitParam = "limit" }: Props) {
  const router = useRouter();

  function handleChange(value: string) {
    const params = new URLSearchParams(extraParams ?? {});
    params.set(pageParam, "1");
    params.set(limitParam, value);
    router.push(`${basePath}?${params}`);
  }

  return (
    <Select
      value={String(limit)}
      onChange={handleChange}
      options={PAGE_SIZE_OPTIONS.map((s) => ({ value: String(s), label: String(s) }))}
      size="sm"
      autoWidth
    />
  );
}
