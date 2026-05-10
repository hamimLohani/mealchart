"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signInWithPopup, signInWithRedirect, GoogleAuthProvider } from "firebase/auth";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { buildAdminProfile, buildGroupRecord } from "@/lib/firebase/factories";
import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { groupsCollection, adminsCollection } from "@/lib/firebase/paths";
import { getAdminProfile } from "@/lib/firebase/repositories";

type FormState = { groupName: string };
const initialState: FormState = { groupName: "" };

export function RegisterGroupForm() {
  const { t, tx } = useT();
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreated, setIsCreated] = useState(false);



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
      const user = result.user;
      
      if (!user.email) throw new Error("No email found from Google.");

      // Step 2: Check if already an admin
      const existingAdmin = await getAdminProfile(user.uid);
      if (existingAdmin) {
        throw new Error(t("errors.adminExists"));
      }

      const adminId = user.uid;
      const groupId = crypto.randomUUID();
      const nameTrim = form.groupName.trim();

      const batch = writeBatch(db);

      batch.set(doc(db, groupsCollection, groupId), {
        ...buildGroupRecord({ id: groupId, name: nameTrim, adminId }),
        createdAt: serverTimestamp(),
      });

      batch.set(doc(db, adminsCollection, adminId), {
        ...buildAdminProfile({ id: adminId, email: user.email, groupId }),
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      setIsCreated(true);
      setForm(initialState);
    } catch (err) {
      const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code?: string }).code) : "";
      if (code === "auth/popup-closed-by-user") {
        setError(null);
      } else if (code === "auth/popup-blocked") {
        setError("Your browser blocked the sign-in popup. Please allow popups or use the redirect method below.");
      } else {
        setError(tx(err instanceof Error ? err.message : t("errors.registerFailed")));
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
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (err) {
      setError(tx(err instanceof Error ? err.message : t("errors.registerFailed")));
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
