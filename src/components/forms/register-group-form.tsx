"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { buildAdminProfile, buildGroupRecord } from "@/lib/firebase/factories";
import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { groupsCollection, adminsCollection } from "@/lib/firebase/paths";
import { getAdminProfileForUser, normalizeEmail } from "@/lib/auth/sign-in-routing";
import { getAuthErrorMessage } from "@/lib/auth/errors";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { sendAdminWelcomeEmail } from "@/lib/email/actions";
import { getFriendlyEmailError } from "@/lib/utils/email-error";

type FormState = { groupName: string; email: string; password: string; fullName: string };
type Step = "info" | "verify" | "created";
const initialState: FormState = { groupName: "", email: "", password: "", fullName: "" };
const pendingGroupNameKey = "mealchart.pendingGroupName";
const pendingUserKey = "mealchart.pendingUser";
const pendingFormKey = "mealchart.pendingForm";

export function RegisterGroupForm() {
  const { t, tx } = useT();
  const isOnline = useOnlineStatus();
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authMethod, setAuthMethod] = useState<"google" | "email">("google");
  const [step, setStep] = useState<Step>("info");
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  useGlobalLoading("register-group-form", isSubmitting, t("registerForm.submitting"));

  const createGroupForUser = useCallback(
    async (user: User, groupName: string, fullName?: string) => {
      if (!db) throw new Error(t("errors.firebaseNotConfiguredLocal"));
      if (!user.email) throw new Error("No email found.");

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
          fullName: fullName || user.displayName || undefined
        }),
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      void sendAdminWelcomeEmail(
        normalizeEmail(user.email),
        fullName || user.displayName || "Admin",
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

    // Check if we have a pending user and form data in session storage
    const savedPendingUser = sessionStorage.getItem(pendingUserKey);
    const savedPendingForm = sessionStorage.getItem(pendingFormKey);
    if (savedPendingUser && auth.currentUser && savedPendingForm) {
      const parsedForm = JSON.parse(savedPendingForm);
      setForm(parsedForm);
      setPendingUser(auth.currentUser);
      setStep("verify");
    }

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
        setStep("created");
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

  async function handleSendVerification() {
    setError(null);

    if (!isOnline) {
      setError(t("common.offlineAuth"));
      return;
    }

    if (!auth || !db || !isFirebaseConfigured) {
      setError(t("errors.firebaseNotConfiguredLocal"));
      return;
    }

    setIsSubmitting(true);
    try {
      if (authMethod === "google") {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const nameTrim = form.groupName.trim();
        await createGroupForUser(result.user, nameTrim);
        setStep("created");
        setForm(initialState);
      } else {
        const nameTrim = form.groupName.trim();
        const emailTrim = form.email.trim();
        const fullNameTrim = form.fullName.trim();
        
        if (!nameTrim || !emailTrim || !form.password || !fullNameTrim) {
          setError(t("registerForm.fieldsRequired"));
          return;
        }

        let userCredential;
        try {
          // First try to create a new user
          userCredential = await createUserWithEmailAndPassword(auth, emailTrim, form.password);
        } catch (err) {
          const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code?: string }).code) : "";
          // If email already exists, try to sign in
          if (code === "auth/email-already-in-use") {
            try {
              userCredential = await signInWithEmailAndPassword(auth, emailTrim, form.password);
            } catch (signInErr) {
              const signInCode = typeof signInErr === "object" && signInErr !== null && "code" in signInErr ? String((signInErr as { code?: string }).code) : "";
              if (signInCode === "auth/wrong-password") {
                setError(t("registerForm.wrongPassword"));
                setShowPasswordReset(true);
                return;
              }
              throw signInErr;
            }
          } else {
            // Re-throw other errors
            throw err;
          }
        }

        // If we have a user (either newly created or signed in), send verification and proceed
        if (userCredential?.user) {
          // Send verification email (even if already sent before)
          await sendEmailVerification(userCredential.user);
          setPendingUser(userCredential.user);
          sessionStorage.setItem(pendingUserKey, "true");
          sessionStorage.setItem(pendingFormKey, JSON.stringify(form));
          setStep("verify");
        }
      }
    } catch (err) {
      const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code?: string }).code) : "";
      if (code === "auth/popup-closed-by-user") {
        setError(null);
      } else if (code === "auth/popup-blocked" && authMethod === "google") {
        await handleGoogleSignInRedirect();
      } else {
        setError(tx(getAuthErrorMessage(err, t("errors.registerFailed"))));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyAndCreate() {
    if (!auth || !db || !isFirebaseConfigured) {
      setError(t("errors.firebaseNotConfiguredLocal"));
      return;
    }

    if (!pendingUser || !auth.currentUser) {
      setError(t("registerForm.noPendingUser"));
      return;
    }

    // Reload user to check email verification status
    await auth.currentUser.reload();
    
    if (!auth.currentUser.emailVerified) {
      setError(t("registerForm.emailNotVerified"));
      return;
    }

    setIsSubmitting(true);
    try {
      await createGroupForUser(auth.currentUser, form.groupName, form.fullName);
      sessionStorage.removeItem(pendingUserKey);
      sessionStorage.removeItem(pendingFormKey);
      setStep("created");
      setForm(initialState);
    } catch (err) {
      setError(tx(getAuthErrorMessage(err, t("errors.registerFailed"))));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendVerification() {
    if (!auth || !pendingUser) return;
    setIsSubmitting(true);
    try {
      await sendEmailVerification(pendingUser);
      setError(null);
    } catch (err) {
      setError(tx(getAuthErrorMessage(err, t("errors.registerFailed"))));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendPasswordReset() {
    if (!auth || !isFirebaseConfigured) {
      setError(t("errors.firebaseNotConfiguredLocal"));
      return;
    }
    if (!form.email) {
      setError(t("registerForm.fieldsRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, form.email.trim());
      setError(null);
      setShowPasswordReset(false);
      // Show success message
      setSuccessMessage(t("registerForm.passwordResetSent"));
      // Clear the message after 5 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err) {
      setError(tx(getAuthErrorMessage(err, t("errors.registerFailed"))));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignInRedirect() {
    setError(null);
    if (!isOnline) {
      setError(t("common.offlineAuth"));
      return;
    }
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
    <form className="mt-7 grid gap-5">
      {step === "info" && (
        <>
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

            {/* Auth method toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`button ${authMethod === "google" ? "button-primary" : "button-secondary"} py-2`}
                onClick={() => setAuthMethod("google")}
              >
                Google
              </button>
              <button
                type="button"
                className={`button ${authMethod === "email" ? "button-primary" : "button-secondary"} py-2`}
                onClick={() => setAuthMethod("email")}
              >
                Email
              </button>
            </div>

            {/* Email/password fields if email method is selected */}
            {authMethod === "email" && (
              <>
                <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)]">
                  {t("registerForm.fullName")}
                  <input
                    className="input"
                    onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))}
                    placeholder={t("registerForm.placeholderFullName")}
                    required
                    value={form.fullName}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)]">
                  {t("registerForm.email")}
                  <input
                    type="email"
                    className="input"
                    onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
                    placeholder={t("registerForm.placeholderEmail")}
                    required
                    value={form.email}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)]">
                  {t("registerForm.password")}
                  <input
                    type="password"
                    className="input"
                    onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
                    placeholder={t("registerForm.placeholderPassword")}
                    required
                    value={form.password}
                  />
                </label>
              </>
            )}
          </div>

          {!isFirebaseConfigured && (
            <p className="alert-warn">
              {t("registerForm.warnEnv")}
            </p>
          )}

          {!isOnline && <p className="alert-warn">{t("common.offlineAuth")}</p>}

          {error && <p className="alert-error">{error}</p>}

          {successMessage && <p className="alert-success">{successMessage}</p>}

          {/* Show password reset option if needed */}
          {showPasswordReset && (
            <button
              className="button-secondary w-full py-3"
              disabled={isSubmitting}
              onClick={handleSendPasswordReset}
              type="button"
            >
              {t("registerForm.resetPassword")}
            </button>
          )}

          {!showPasswordReset && (
            <button
              className="button-primary w-full flex items-center justify-center gap-3 py-3.5"
              disabled={isSubmitting || !isFirebaseConfigured || !isOnline}
              onClick={handleSendVerification}
              type="button"
            >
              {isSubmitting ? (
                t("registerForm.submitting")
              ) : authMethod === "google" ? (
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
              ) : (
                <span className="font-semibold">{t("registerForm.sendVerification")}</span>
              )}
            </button>
          )}

          {error?.includes("blocked") && authMethod === "google" && (
            <button
              className="button-secondary w-full py-3"
              disabled={!isOnline}
              onClick={handleGoogleSignInRedirect}
              type="button"
            >
              {t("enterForm.useRedirectMethod", { defaultValue: "Sign in with Redirect" })}
            </button>
          )}
        </>
      )}

      {step === "verify" && (
        <>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[color:var(--accent-dim)] mb-5">
              <svg className="w-8 h-8 text-[color:var(--accent)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25H4.5a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.167a2.25 2.25 0 0 1-2.358 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
            </div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.26em] text-[color:var(--muted)]">
              {t("registerPage.eyebrow")}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-3xl">
              {t("registerForm.verifyEmail")}
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-[color:var(--soft-foreground)] sm:text-[0.95rem] max-w-md mx-auto">
              {t("registerForm.verifyEmailDescription", { email: form.email })}
            </p>
          </div>

          {error && <p className="alert-error">{error}</p>}

          <div className="grid gap-3">
            <button
              className="button-primary w-full py-3.5"
              disabled={isSubmitting || !isFirebaseConfigured || !isOnline}
              onClick={handleVerifyAndCreate}
              type="button"
            >
              {isSubmitting ? t("registerForm.submitting") : t("registerForm.createGroupNow")}
            </button>
            <button
              className="button-secondary w-full py-3"
              disabled={isSubmitting}
              onClick={handleResendVerification}
              type="button"
            >
              {t("registerForm.resendVerification")}
            </button>
          </div>
        </>
      )}

      {step === "created" && (
        <>
          <div className="alert-success">
            <p className="font-semibold">{t("registerForm.successTitle")}</p>
          </div>

          <div className="grid gap-3">
            <Link href="/admin" className="button-primary w-full text-center">
              {t("registerForm.openDashboard")}
            </Link>
            <p className="text-center text-xs text-[color:var(--soft-foreground)]">
              {t("registerForm.postSignupNote")}
            </p>
          </div>
        </>
      )}
    </form>
  );
}
