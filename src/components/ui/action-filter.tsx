"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "archived", label: "Archived" },
  { value: "restored", label: "Restored" },
  { value: "deleted", label: "Deleted" },
];

interface Props {
  value: string;
  basePath: string;
  extraParams?: Record<string, string>;
}

export function ActionFilter({ value, basePath, extraParams }: Props) {
  const router = useRouter();

  function handleChange(action: string) {
    const params = new URLSearchParams(extraParams ?? {});
    if (action) params.set("action", action);
    else params.delete("action");
    params.set("page", "1");
    router.replace(`${basePath}?${params}`, { scroll: false });
  }

  return (
    <Select
      value={value}
      onChange={handleChange}
      options={ACTION_OPTIONS}
      size="sm"
      autoWidth
    />
  );
}
