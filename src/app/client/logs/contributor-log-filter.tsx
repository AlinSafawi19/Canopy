"use client";

import { useRouter } from "next/navigation";
import { ComboSelect } from "@/components/ui/combo-select";
import { X } from "lucide-react";

interface Props {
  value: string;
  initialLabel: string;
  basePath: string;
  extraParams?: Record<string, string>;
}

export function ContributorLogFilter({ value, initialLabel, basePath, extraParams }: Props) {
  const router = useRouter();

  function handleChange(id: string) {
    const params = new URLSearchParams(extraParams ?? {});
    if (id) params.set("contributorId", id);
    else params.delete("contributorId");
    params.set("page", "1");
    router.replace(`${basePath}?${params}`);
  }

  return (
    <div className="flex items-center gap-1">
      <div className="w-48">
        <ComboSelect
          endpoint="/api/client/selects/contributors"
          value={value}
          onChange={(id) => handleChange(id)}
          placeholder="All contributors"
          initialLabel={initialLabel}
        />
      </div>
      {value && (
        <button
          type="button"
          onClick={() => handleChange("")}
          className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
          title="Clear contributor filter"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
