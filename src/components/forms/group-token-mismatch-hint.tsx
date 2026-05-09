"use client";

import Link from "next/link";

function isTokenNotFoundMessage(message: string | null) {
  if (!message) return false;
  return /no group found|group not found/i.test(message);
}

export function GroupTokenMismatchHint({ message }: { message: string | null }) {
  if (!isTokenNotFoundMessage(message)) return null;

  return (
    <div className="mt-4 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-4">
      <p className="text-sm font-medium text-[color:var(--foreground)]">Wrong or unknown token?</p>
      <p className="mt-1 text-xs text-[color:var(--soft-foreground)]">
        Create a new group to get your own token, or double-check the token your admin shared.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/register" className="button-primary inline-flex text-center text-sm">
          Register a group
        </Link>
        <Link href="/enter-group" className="button-secondary inline-flex text-center text-sm">
          Try another token
        </Link>
      </div>
    </div>
  );
}
