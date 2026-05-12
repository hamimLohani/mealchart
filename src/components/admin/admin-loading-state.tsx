"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function AdminLoadingState({
  message,
  compact = false,
}: {
  message: string;
  compact?: boolean;
}) {
  return (
    <div className={`mt-6 grid gap-4 ${compact ? "" : "rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]"}`}>
      <div className="flex items-center gap-3">
        <span className="global-loading-spinner" aria-hidden="true" />
        <p className="text-sm font-medium text-[color:var(--soft-foreground)]">{message}</p>
      </div>
      <div className="grid gap-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  );
}
