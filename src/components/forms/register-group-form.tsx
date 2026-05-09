"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { buildAdminProfile, buildGroupRecord, buildNoticeRecord } from "@/lib/firebase/factories";
import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { groupsCollection, adminsCollection, noticesCollection } from "@/lib/firebase/paths";
import { generateGroupToken, slugifyGroupName } from "@/lib/utils/group-token";

type FormState = { groupName: string; email: string; password: string };
const initialState: FormState = { groupName: "", email: "", password: "" };

export function RegisterGroupForm() {
  const { t, tx } = useT();
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [hasCopiedToken, setHasCopiedToken] = useState(false);

  const previewToken = useMemo(() => {
    if (!form.groupName.trim()) return "MEAT-XXXXXX";
    return `${slugifyGroupName(form.groupName)}-XXXXXX`;
  }, [form.groupName]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCreatedToken(null);
    setHasCopiedToken(false);

    if (!auth || !db || !isFirebaseConfigured) {
      setError(t("errors.firebaseNotConfiguredLocal"));
      return;
    }

    setIsSubmitting(true);
    try {
      const credentials = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      const adminId = credentials.user.uid;
      const groupId = crypto.randomUUID();
      const groupToken = generateGroupToken(form.groupName);
      const nameTrim = form.groupName.trim();

      await setDoc(doc(db, groupsCollection, groupId), {
        ...buildGroupRecord({ id: groupId, name: nameTrim, token: groupToken, adminId }),
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, adminsCollection, adminId), {
        ...buildAdminProfile({ id: adminId, email: form.email.trim(), groupId }),
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, noticesCollection(groupId), crypto.randomUUID()), {
        ...buildNoticeRecord({
          title: t("registerForm.noticeTitle"),
          body: t("registerForm.noticeBody", { name: nameTrim }),
          systemGenerated: true,
        }),
        createdAt: serverTimestamp(),
      });

      setCreatedToken(groupToken);
      setForm(initialState);
    } catch (err) {
      setError(tx(err instanceof Error ? err.message : t("errors.registerFailed")));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopyToken() {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(createdToken);
      setHasCopiedToken(true);
      setError(null);
    } catch {
      setError(t("errors.copyTokenFailed"));
    }
  }

  return (
    <form className="mt-7 grid gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)]">
          {t("registerForm.groupName")}
          <input
            className="input"
            onChange={(e) => setForm((c) => ({ ...c, groupName: e.target.value }))}
            placeholder={t("registerForm.placeholderGroup")}
            required
            value={form.groupName}
          />
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)]">
          {t("registerForm.email")}
          <input
            className="input"
            onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
            placeholder="admin@example.com"
            required
            type="email"
            value={form.email}
          />
        </label>
      </div>

      <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)]">
        {t("registerForm.password")}
        <input
          className="input"
          minLength={6}
          onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
          placeholder={t("registerForm.placeholderPassword")}
          required
          type="password"
          value={form.password}
        />
      </label>

      <div className="rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] p-4">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[color:var(--muted)]">
          {t("registerForm.tokenPreview")}
        </p>
        <p className="mt-2 font-mono text-base font-semibold text-[color:var(--foreground)]">
          {previewToken}
        </p>
        <p className="mt-1.5 text-xs text-[color:var(--soft-foreground)]">
          {t("registerForm.tokenPreviewHelp")}
        </p>
      </div>

      {!isFirebaseConfigured && (
        <p className="alert-warn">
          {t("registerForm.warnEnv")}
        </p>
      )}

      {error && <p className="alert-error">{error}</p>}

      {createdToken && (
        <div className="alert-success">
          <p className="font-semibold">{t("registerForm.successTitle")}</p>
          <p className="mt-1.5">
            {t("registerForm.tokenLabel")} <span className="font-mono font-bold">{createdToken}</span>
          </p>
        </div>
      )}

      {createdToken ? (
        <div className="grid gap-3">
          <button
            className="button-primary w-full"
            onClick={() => void handleCopyToken()}
            type="button"
          >
            {hasCopiedToken ? t("registerForm.copied") : t("registerForm.copyToken")}
          </button>
          <Link href="/admin/login" className="button-secondary w-full text-center">
            {t("registerForm.goAdminLogin")}
          </Link>
          <p className="text-center text-xs text-[color:var(--soft-foreground)]">
            {t("registerForm.postSignupNote")}
          </p>
          <Link href="/admin" className="text-center text-sm font-semibold text-[color:var(--accent)] underline-offset-2 hover:underline">
            {t("registerForm.openDashboard")}
          </Link>
        </div>
      ) : (
        <button
          className="button-primary w-full"
          disabled={isSubmitting || !isFirebaseConfigured}
          type="submit"
        >
          {isSubmitting ? t("registerForm.submitting") : t("registerForm.submit")}
        </button>
      )}
    </form>
  );
}
