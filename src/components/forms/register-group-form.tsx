"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getRedirectResult, GoogleAuthProvider, signInWithPopup, signInWithRedirect, type User } from "firebase/auth";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { buildAdminProfile, buildGroupRecord } from "@/lib/firebase/factories";
import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { groupsCollection, adminsCollection } from "@/lib/firebase/paths";
import { getAdminProfileForUser, normalizeEmail } from "@/lib/auth/sign-in-routing";
import { getAuthErrorMessage } from "@/lib/auth/errors";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import { sendAdminWelcomeEmail } from "@/lib/email/actions";
import { getFriendlyEmailError } from "@/lib/utils/email-error";

type FormState = { groupName: string };
const initialState: FormState = { groupName: "" };
const pendingGroupNameKey = "mealchart.pendingGroupName";

export function RegisterGroupForm() {
  const { t, tx } = useT();
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreated, setIsCreated] = useState(false);

  useGlobalLoading("register-group-form", isSubmitting, t("registerForm.submitting"));

  const createGroupForUser = useCallback(
    async (user: User, groupName: string) => {
      if (!db) throw new Error(t("errors.firebaseNotConfiguredLocal"));
      if (!user.email) throw new Error("No email found from Google.");

      const existingAdmin = await getAdminProfileForUser(user);
      if (existingAdmin) throw new Error(t("errors.adminExists"));

      const adminId = user.uid;
      const groupId = crypto.randomUUID();
      const token = crypto.randomUUID().slice(0, 8).toUpperCase();
      const nameTrim = groupName.trim();
      if (!nameTrim) throw new Error(t("registerForm.placeholderGroup"));

      const batch = writeBatch(db);

      batch.set(doc(db, groupsCollection, groupId), {
        ...buildGroupRecord({ id: groupId, name: nameTrim, adminId, token }),
        createdAt: serverTimestamp(),
      });

      batch.set(doc(db, adminsCollection, adminId), {
        ...buildAdminProfile({ 
          id: adminId, 
          email: normalizeEmail(user.email), 
          groupId,
          fullName: user.displayName || undefined
        }),
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      void sendAdminWelcomeEmail(
        normalizeEmail(user.email),
        user.displayName || "Admin",
        nameTrim
      ).then(result => {
        if (!result.success) {
          const friendlyError = getFriendlyEmailError(result.error || "");
          setError(`ERR_TRANS:${JSON.stringify({ 
            key: "errors.emailAdminWelcomeFailed", 
            vars: { error: friendlyError } 
          })}`);
        }
      });
    },
    [t],
  );

  useEffect(() => {
    if (!isFirebaseConfigured || !auth || !db) return;

    const firebaseAuth = auth;
    let active = true;
    async function completeRedirectRegistration() {
      const pendingGroupName = window.sessionStorage.getItem(pendingGroupNameKey);
      if (!pendingGroupName) return;

      setIsSubmitting(true);
      setError(null);
      try {
        const result = await getRedirectResult(firebaseAuth);
        if (!active) return;
        if (!result?.user) {
          window.sessionStorage.removeItem(pendingGroupNameKey);
          return;
        }
        await createGroupForUser(result.user, pendingGroupName);
        window.sessionStorage.removeItem(pendingGroupNameKey);
        setIsCreated(true);
        setForm(initialState);
      } catch (err) {
        if (!active) return;
        window.sessionStorage.removeItem(pendingGroupNameKey);
        setError(tx(getAuthErrorMessage(err, t("errors.registerFailed"))));
      } finally {
        if (!active) return;
        setIsSubmitting(false);
      }
    }

    void completeRedirectRegistration();
    return () => {
      active = false;
    };
  }, [createGroupForUser, t, tx]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsCreated(false);

    if (!auth || !db || !isFirebaseConfigured) {
      setError(t("errors.firebaseNotConfiguredLocal"));
      return;
    }

    setIsSubmitting(true);
    try {
      // Step 1: Google Sign In
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const nameTrim = form.groupName.trim();
      await createGroupForUser(result.user, nameTrim);
      setIsCreated(true);
      setForm(initialState);
    } catch (err) {
      const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code?: string }).code) : "";
      if (code === "auth/popup-closed-by-user") {
        setError(null);
      } else if (code === "auth/popup-blocked") {
        await handleGoogleSignInRedirect();
      } else {
        setError(tx(getAuthErrorMessage(err, t("errors.registerFailed"))));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignInRedirect() {
    setError(null);
    if (!isFirebaseConfigured || !auth) {
      setError(t("errors.firebaseNotConfigured"));
      return;
    }
    setIsSubmitting(true);
    try {
      const groupName = form.groupName.trim();
      if (!groupName) {
        setError(t("registerForm.placeholderGroup"));
        setIsSubmitting(false);
        return;
      }
      window.sessionStorage.setItem(pendingGroupNameKey, groupName);
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (err) {
      setError(tx(getAuthErrorMessage(err, t("errors.registerFailed"))));
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-7 grid gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-4">
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
      </div>



      {!isFirebaseConfigured && (
        <p className="alert-warn">
          {t("registerForm.warnEnv")}
        </p>
      )}

      {error && <p className="alert-error">{error}</p>}

      {isCreated && (
        <div className="alert-success">
          <p className="font-semibold">{t("registerForm.successTitle")}</p>
        </div>
      )}

      {isCreated ? (
        <div className="grid gap-3">
          <Link href="/admin" className="button-primary w-full text-center">
            {t("registerForm.openDashboard")}
          </Link>
          <p className="text-center text-xs text-[color:var(--soft-foreground)]">
            {t("registerForm.postSignupNote")}
          </p>
        </div>
      ) : (
        <button
          className="button-primary w-full flex items-center justify-center gap-3 py-3.5"
          disabled={isSubmitting || !isFirebaseConfigured}
          type="submit"
        >
          {isSubmitting ? (
            t("registerForm.submitting")
          ) : (
            <>
              <svg height="18" viewBox="0 0 24 24" width="18">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="white"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="white"
                  fillOpacity="0.8"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="white"
                  fillOpacity="0.7"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="white"
                  fillOpacity="0.9"
                />
              </svg>
              <span className="font-semibold">{t("registerForm.submit")}</span>
            </>
          )}
        </button>
      )}

      {error?.includes("blocked") && (
        <button
          className="button-secondary w-full py-3"
          onClick={handleGoogleSignInRedirect}
          type="button"
        >
          {t("enterForm.useRedirectMethod", { defaultValue: "Sign in with Redirect" })}
        </button>
      )}
    </form>
  );
}
