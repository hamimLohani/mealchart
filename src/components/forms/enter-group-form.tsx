"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { submitJoinRequest, listGroups } from "@/lib/firebase/repositories";
import { resolveSignInDestination } from "@/lib/auth/sign-in-routing";
import { getAuthErrorMessage } from "@/lib/auth/errors";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import type { Group } from "@/types/domain";

type Step = "login" | "register" | "verify" | "join";

export function EnterGroupForm() {
  const router = useRouter();
  const { t, tx } = useT();
  const isOnline = useOnlineStatus();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [authMethod, setAuthMethod] = useState<"google" | "email">("google");

  // Form state for email/password login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Form state for email/password register
  const [registerFullName, setRegisterFullName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerSelectedGroupId, setRegisterSelectedGroupId] = useState("");
  const [isEmailVerified, setIsEmailVerified] = useState(false); // New state to track if email is verified
  const [hasCreatedAccount, setHasCreatedAccount] = useState(false); // New state to track if account is created

  // Load groups when user selects register step
  useEffect(() => {
    if (!isFirebaseConfigured || step !== "register") return;

    let active = true;
    const loadGroups = async () => {
      try {
        const groupsData = await listGroups();
        if (active) {
          setGroups(groupsData);
        }
      } catch (e) {
        console.error("Failed to load groups", e);
      }
    };
    loadGroups();
    return () => { active = false; };
  }, [step, isFirebaseConfigured]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  useGlobalLoading(
    "enter-group-form",
    isSubmitting || isLoadingGroups,
    isLoadingGroups ? t("enterForm.loadingGroups") : t("enterForm.submitting"),
  );

  const finishSignIn = useCallback(
    async (user: NonNullable<typeof auth>["currentUser"]) => {
      if (!user) return;

      setStep("join" as Step);
      const destination = await resolveSignInDestination(user);

      if (destination.kind === "member") {
        router.push(`/group/${destination.groupId}/member/${encodeURIComponent(destination.memberId)}`);
        return;
      }

      if (destination.kind === "admin") {
        router.push("/admin");
        return;
      }

      setFullName(destination.fullName);
      setEmail(destination.email);
      setGroups(destination.groups);
      setShowJoinForm(true);
    },
    [router],
  );

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;

    const firebaseAuth = auth;
    let active = true;
    async function completeRedirectSignIn() {
      setIsLoadingGroups(true);
      try {
        const result = await getRedirectResult(firebaseAuth);
        if (!active || !result?.user) return;
        await finishSignIn(result.user);
      } catch (err) {
        if (!active) return;
        setError(tx(getAuthErrorMessage(err, t("adminLogin.errFailed"))));
      } finally {
        if (!active) return;
        setIsLoadingGroups(false);
        setIsSubmitting(false);
      }
    }

    void completeRedirectSignIn();

    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        void finishSignIn(user);
      }
    });

    return () => {
      active = false;
      unsubscribeAuth();
    };
  }, [finishSignIn, isFirebaseConfigured, t, tx]);

  async function handleGoogleSignIn() {
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
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await finishSignIn(result.user);
    } catch (err) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: string }).code)
          : "";
      
      if (code === "auth/popup-closed-by-user") {
        setError(null);
      } else if (code === "auth/popup-blocked") {
        await handleGoogleSignInRedirect();
      } else if (code === "permission-denied") {
        setError(`${t("errors.permissionDenied")} [${step}] (${code}: ${err instanceof Error ? err.message : "unknown"})`);
      } else {
        setError(tx(getAuthErrorMessage(err, t("adminLogin.errFailed"))));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEmailSignIn() {
    setError(null);
    if (!isOnline) {
      setError(t("common.offlineAuth"));
      return;
    }
    if (!isFirebaseConfigured || !auth) {
      setError(t("errors.firebaseNotConfigured"));
      return;
    }

    if (!loginEmail || !loginPassword) {
      setError(t("enterForm.fieldsRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      await finishSignIn(result.user);
    } catch (err) {
      setError(tx(getAuthErrorMessage(err, t("adminLogin.errFailed"))));
    } finally {
      setIsSubmitting(false);
    }
  }

  // New function: handle Verify Email button
  async function handleVerifyEmail() {
    setError(null);
    setSuccessMsg(null);
    if (!isOnline) {
      setError(t("common.offlineAuth"));
      return;
    }
    if (!isFirebaseConfigured || !auth) {
      setError(t("errors.firebaseNotConfigured"));
      return;
    }
    if (!registerFullName || !registerEmail || !registerPassword) {
      setError(t("registerForm.fieldsRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      let userCredential;
      try {
        // Try to create a new user
        userCredential = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword);
      } catch (err) {
        const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code?: string }).code) : "";
        if (code === "auth/email-already-in-use") {
          // Email already exists, try to sign in
          userCredential = await signInWithEmailAndPassword(auth, registerEmail, registerPassword);
        } else {
          // Re-throw other errors
          throw err;
        }
      }

      await sendEmailVerification(userCredential.user);
      setHasCreatedAccount(true);
      setFullName(registerFullName);
      setEmail(registerEmail);
      setSelectedGroupId(registerSelectedGroupId);
      setSuccessMsg(t("registerForm.verificationSent"));
    } catch (err) {
      setError(tx(getAuthErrorMessage(err, t("errors.registerFailed"))));
    } finally {
      setIsSubmitting(false);
    }
  }

  // New function: handle Join Request button
  async function handleJoinRequest() {
    setError(null);
    setSuccessMsg(null);
    if (!auth?.currentUser) {
      setError(t("registerForm.noPendingUser"));
      return;
    }

    setIsSubmitting(true);
    try {
      await auth.currentUser.reload();
      if (!auth.currentUser.emailVerified) {
        setError(t("registerForm.emailNotVerified"));
        return;
      }

      // Check if user is already a member/admin
      const destination = await resolveSignInDestination(auth.currentUser);
      if (destination.kind === "member") {
        router.push(`/group/${destination.groupId}/member/${encodeURIComponent(destination.memberId)}`);
        return;
      }
      if (destination.kind === "admin") {
        router.push("/admin");
        return;
      }

      if (!selectedGroupId) {
        setError("Please select a group");
        return;
      }

      await submitJoinRequest(selectedGroupId, fullName, email);
      setSuccessMsg(t("enterForm.joinRequestSuccess"));
      setHasCreatedAccount(false);
      setIsEmailVerified(false);
      setStep("login");
    } catch (err) {
      setError(tx(getAuthErrorMessage(err, t("errors.registerFailed"))));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyAndJoin() {
    if (!auth?.currentUser) {
      setError(t("registerForm.noPendingUser"));
      return;
    }

    setIsSubmitting(true);
    try {
      await auth.currentUser.reload();
      if (!auth.currentUser.emailVerified) {
        setError(t("registerForm.emailNotVerified"));
        return;
      }

      // First check if they are already a member or admin
      const destination = await resolveSignInDestination(auth.currentUser);
      if (destination.kind === "member") {
        router.push(`/group/${destination.groupId}/member/${encodeURIComponent(destination.memberId)}`);
        return;
      }
      if (destination.kind === "admin") {
        router.push("/admin");
        return;
      }

      // If not, submit join request to the selected group
      if (!selectedGroupId) {
        setError("Please select a group");
        return;
      }
      await submitJoinRequest(selectedGroupId, fullName, email);
      setSuccessMsg(t("enterForm.joinRequestSuccess"));
      setShowJoinForm(false);
      setStep("login");
    } catch (err) {
      setError(tx(getAuthErrorMessage(err, t("errors.registerFailed"))));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendVerification() {
    if (!auth?.currentUser) return;
    setIsSubmitting(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setError(null);
      setSuccessMsg(t("registerForm.verificationSent"));
      setTimeout(() => setSuccessMsg(null), 5000);
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
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (err) {
      setError(tx(getAuthErrorMessage(err, t("errors.registerFailed"))));
      setIsSubmitting(false);
    }
  }

  async function handleJoinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!selectedGroupId) {
      setError("Please select a group.");
      return;
    }

    if (!isOnline) {
      setError(t("common.offlineAuth"));
      return;
    }

    setIsSubmitting(true);

    try {
      // If email is already present (because they clicked 'Sign in with Google' first)
      let requestEmail = email;
      
      // If no email, pop up Google auth now
      if (!requestEmail) {
        if (!isOnline) {
          throw new Error(t("common.offlineAuth"));
        }
        if (!isFirebaseConfigured || !auth) {
          throw new Error(t("errors.firebaseNotConfigured"));
        }
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        if (!user.email) throw new Error("No email found from Google.");
        requestEmail = user.email.toLowerCase();
        setEmail(user.email); // Save it for UI
      }

      await submitJoinRequest(selectedGroupId, fullName, requestEmail);
      setShowJoinForm(false);
      setSuccessMsg(t("enterForm.joinRequestSuccess"));
    } catch (err) {
      const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code?: string }).code) : "";
      if (code === "auth/popup-closed-by-user") {
        setError(null);
      } else {
        setError(tx(getAuthErrorMessage(err, t("enterForm.joinRequestError"))));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Join Request Form ──────────────────────────────
  if (showJoinForm) {
    return (
      <form className="grid gap-5" onSubmit={handleJoinSubmit}>
        {/* Header banner */}
        <div className="flex items-start gap-3.5 rounded-[var(--radius-sm)] border border-[color:var(--accent-dim)] bg-gradient-to-r from-[color:var(--accent-dim)] to-transparent p-4">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--accent)] text-white text-sm">
            ✉
          </div>
          <div>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {t("enterForm.requestingToJoin")}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--soft-foreground)]">
              {t("enterForm.joinHelp")}
            </p>
          </div>
        </div>

        {/* Full Name (read-only) */}
        <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)] opacity-80">
          {t("enterForm.fullName")}
          <input className="input cursor-not-allowed" value={fullName} disabled />
        </label>

        {/* Email (read-only) */}
        <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)] opacity-80">
          <span className="flex items-center gap-1.5">
            {t("enterForm.emailLabel")}
          </span>
          <input className="input cursor-not-allowed" value={email} disabled />
        </label>

        {/* Group Selection */}
        <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)]">
          {t("enterForm.selectGroup")}
          {isLoadingGroups ? (
            <div className="input flex items-center gap-2 text-[color:var(--muted)]">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[color:var(--muted)] border-t-transparent" />
              {t("enterForm.loadingGroups")}
            </div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-[color:var(--danger)]">{t("enterForm.noGroups")}</p>
          ) : (
            <select
              className="input bg-[color:var(--background)]"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              required
            >
              <option value="">-- {t("enterForm.selectGroup")} --</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
          <span className="text-[0.7rem] text-[color:var(--muted)]">
            {t("enterForm.groupSelectionHelp")}
          </span>
        </label>

        {!isOnline && <p className="alert-warn">{t("common.offlineAuth")}</p>}
        {error && <p className="alert-error">{error}</p>}

        <div className="grid gap-2.5 mt-1">
          <button className="button-primary w-full py-3" disabled={isSubmitting || !isOnline} type="submit">
            {isSubmitting ? t("enterForm.submittingRequest") : t("enterForm.submitJoinRequest")}
          </button>
          <button
            className="w-full py-2.5 text-sm font-medium text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors"
            onClick={() => {
              setShowJoinForm(false);
              setStep("login");
            }}
            type="button"
          >
            ← {t("common.back")}
          </button>
        </div>
      </form>
    );
  }

  // ── Verification Step ──────────────────────────────
  if (step === "verify") {
    return (
      <div className="grid gap-5">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[color:var(--accent-dim)] mb-5">
            <svg className="w-8 h-8 text-[color:var(--accent)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25H4.5a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.167a2.25 2.25 0 0 1-2.358 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {t("registerForm.verifyEmail")}
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-[color:var(--soft-foreground)]">
            {t("registerForm.verifyEmailDescription", { email: email })}
          </p>
        </div>

        {successMsg && <p className="alert-success">{successMsg}</p>}
        {error && <p className="alert-error">{error}</p>}

        <div className="grid gap-3">
          <button
            className="button-primary w-full py-3.5"
            disabled={isSubmitting || !isFirebaseConfigured || !isOnline}
            onClick={handleVerifyAndJoin}
            type="button"
          >
            {isSubmitting ? t("registerForm.submitting") : t("enterForm.signInWithEmail")}
          </button>
          <button
            className="button-secondary w-full py-3"
            disabled={isSubmitting}
            onClick={handleResendVerification}
            type="button"
          >
            {t("registerForm.resendVerification")}
          </button>
          <button
            className="w-full py-2.5 text-sm font-medium text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors"
            onClick={() => {
              setStep("login");
            }}
            type="button"
          >
            ← {t("common.back")}
          </button>
        </div>
      </div>
    );
  }

  // ── Main Login/Register Screen ──────────────────────────────
  return (
    <div className="grid gap-5">
      {!isFirebaseConfigured && <p className="alert-warn">{t("enterForm.warnEnv")}</p>}
      {!isOnline && <p className="alert-warn">{t("common.offlineAuth")}</p>}

      {/* Success message */}
      {successMsg && (
        <div className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[color:var(--success-border)] bg-[color:var(--success-bg)] p-4">
          <span className="text-lg leading-none mt-0.5">🎉</span>
          <p className="text-sm font-medium text-[color:var(--success-text)]">{successMsg}</p>
        </div>
      )}

      {error && <p className="alert-error">{error}</p>}

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

      {authMethod === "google" ? (
        /* Google Sign In */
        <button
          className="button-primary w-full flex items-center justify-center gap-3 py-3.5 text-[0.95rem]"
          disabled={isSubmitting || !isFirebaseConfigured || !isOnline}
          onClick={() => handleGoogleSignIn()}
          type="button"
        >
          <svg className="h-5 w-5 bg-white rounded-full p-0.5 shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span className="font-semibold">
            {isSubmitting ? t("enterForm.submitting") : t("enterForm.signInWithGoogle")}
          </span>
        </button>
      ) : (
        /* Email/Password Sign In or Register */
        <div className="grid gap-4">
          {/* Login vs Register toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`button ${step === "login" ? "button-primary" : "button-secondary"} py-2`}
              onClick={() => setStep("login")}
            >
              {t("enterForm.existingMember")}
            </button>
            <button
              type="button"
              className={`button ${step === "register" ? "button-primary" : "button-secondary"} py-2`}
              onClick={() => setStep("register")}
            >
              {t("enterForm.newToGroup")}
            </button>
          </div>

          {step === "login" ? (
            /* Login Form */
            <>
              <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)]">
                {t("enterForm.email")}
                <input
                  type="email"
                  className="input"
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder={t("enterForm.placeholderEmail")}
                  required
                  value={loginEmail}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)]">
                {t("enterForm.password")}
                <input
                  type="password"
                  className="input"
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder={t("enterForm.placeholderPassword")}
                  required
                  value={loginPassword}
                />
              </label>
              <button
                className="button-primary w-full py-3"
                disabled={isSubmitting || !isFirebaseConfigured || !isOnline}
                onClick={() => handleEmailSignIn()}
                type="button"
              >
                {isSubmitting ? t("enterForm.submitting") : t("enterForm.signInWithEmail")}
              </button>
            </>
          ) : (
            /* Register Form */
            <>
              <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)]">
                {t("registerForm.fullName")}
                <input
                  className="input"
                  onChange={(e) => setRegisterFullName(e.target.value)}
                  placeholder={t("registerForm.placeholderFullName")}
                  required
                  value={registerFullName}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)]">
                {t("registerForm.email")}
                <div className="flex gap-2">
                  <input
                    type="email"
                    className="input flex-grow"
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder={t("registerForm.placeholderEmail")}
                    required
                    value={registerEmail}
                  />
                  <button
                    type="button"
                    className="button-secondary py-3 px-4 shrink-0"
                    onClick={() => handleVerifyEmail()}
                    disabled={
                      isSubmitting ||
                      !isFirebaseConfigured ||
                      !isOnline ||
                      !registerFullName ||
                      !registerEmail ||
                      !registerPassword
                    }
                  >
                    {t("registerForm.sendVerification", { defaultValue: "Verify Email" })}
                  </button>
                </div>
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)]">
                {t("registerForm.password")}
                <input
                  type="password"
                  className="input"
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder={t("registerForm.placeholderPassword")}
                  required
                  value={registerPassword}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)]">
                {t("enterForm.selectGroup")}
                {groups.length === 0 ? (
                  <p className="text-sm text-[color:var(--danger)]">{t("enterForm.noGroups")}</p>
                ) : (
                  <select
                    className="input bg-[color:var(--background)]"
                    value={registerSelectedGroupId}
                    onChange={(e) => setRegisterSelectedGroupId(e.target.value)}
                    required
                  >
                    <option value="">-- {t("enterForm.selectGroup")} --</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                )}
                <span className="text-[0.7rem] text-[color:var(--muted)]">
                  {t("enterForm.groupSelectionHelp")}
                </span>
              </label>
              <button
                className="button-primary w-full py-3"
                disabled={
                  isSubmitting ||
                  !isFirebaseConfigured ||
                  !isOnline ||
                  !registerSelectedGroupId ||
                  !hasCreatedAccount
                }
                onClick={() => handleJoinRequest()}
                type="button"
              >
                {isSubmitting ? t("enterForm.submittingRequest", { defaultValue: "Submitting..." }) : "Join Request"}
              </button>
            </>
          )}
        </div>
      )}

      {error?.includes("blocked") && authMethod === "google" && (
        <button
          className="button-secondary w-full py-3"
          disabled={!isOnline}
          onClick={() => handleGoogleSignInRedirect()}
          type="button"
        >
          {t("enterForm.useRedirectMethod", { defaultValue: "Sign in with Redirect" })}
        </button>
      )}

      {/* Helper text */}
      <p className="text-center text-[0.7rem] text-[color:var(--muted)] leading-relaxed px-2">
        {step === "register" ? t("enterForm.joinHint") : t("enterForm.signInHint")}
      </p>
    </div>
  );
}
