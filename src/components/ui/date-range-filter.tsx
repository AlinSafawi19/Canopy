"use client";

import { useRouter } from "next/navigation";
import { DateRangePicker } from "./date-range-picker";

interface Props {
  startDate?: string | null;
  endDate?: string | null;
  basePath: string;
  extraParams?: Record<string, string>;
}

export function DateRangeFilter({ startDate, endDate, basePath, extraParams }: Props) {
  const router = useRouter();

  function handleChange(start: string | null, end: string | null) {
    const params = new URLSearchParams(extraParams ?? {});
    if (start) params.set("startDate", start);
    else params.delete("startDate");
    if (end) params.set("endDate", end);
    else params.delete("endDate");
    params.set("page", "1");
    router.replace(`${basePath}?${params}`);
  }

  return (
    <DateRangePicker
      startDate={startDate}
      endDate={endDate}
      onChange={handleChange}
      placeholder="Filter by date"
    />
  );
}
