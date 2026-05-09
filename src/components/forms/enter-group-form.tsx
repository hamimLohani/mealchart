"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { findGroupByToken, listMembers } from "@/lib/firebase/repositories";
import { GroupTokenMismatchHint } from "@/components/forms/group-token-mismatch-hint";

export function EnterGroupForm() {
  const router = useRouter();
  const { t, tx } = useT();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    sessionStorage.removeItem("mc_member_id");
    sessionStorage.removeItem("mc_member_name");
  }, []);

  async function handleTokenSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!isFirebaseConfigured) {
      setError(t("errors.firebaseNotConfigured"));
      return;
    }

    const normalized = token.trim().toUpperCase();
    if (!normalized) {
      setError(t("errors.enterValidToken"));
      return;
    }

    setIsSubmitting(true);
    try {
      const group = await findGroupByToken(normalized);
      if (!group) {
        setError(t("errors.noGroupForToken"));
        return;
      }

      const memberList = await listMembers(group.id);
      if (memberList.length === 0) {
        setError(t("errors.groupNoMembers"));
        return;
      }

      router.push(`/group/${group.token}`);
    } catch (err) {
      setError(tx(err instanceof Error ? err.message : t("errors.findGroupFailed")));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-6 grid gap-4" onSubmit={handleTokenSubmit}>
      <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)]">
        {t("enterForm.labelToken")}
        <input
          className="input font-mono uppercase tracking-wider"
          onChange={(e) => setToken(e.target.value.toUpperCase())}
          placeholder={t("enterForm.placeholderToken")}
          required
          value={token}
        />
      </label>

      {!isFirebaseConfigured && (
        <p className="alert-warn">
          {t("enterForm.warnEnv")}
        </p>
      )}

      {error && <p className="alert-error">{error}</p>}
      <GroupTokenMismatchHint message={error} />

      <button
        className="button-primary w-full"
        disabled={isSubmitting || !isFirebaseConfigured}
        type="submit"
      >
        {isSubmitting ? t("enterForm.submitting") : t("enterForm.submit")}
      </button>
    </form>
  );
}
