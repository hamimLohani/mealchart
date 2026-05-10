"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useT } from "@/i18n/use-t";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { findMemberGroupByEmail, listGroups, getAdminProfile, findAdminProfileByEmail, migrateAdminProfile, submitJoinRequest } from "@/lib/firebase/repositories";
import type { Group } from "@/types/domain";

export function AdminLoginForm() {
  const router = useRouter();
  const { t, tx } = useT();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);

  // Join Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  async function handleGoogleSignIn() {
    setError(null);
    if (!isFirebaseConfigured || !auth) {
      setError(t("errors.firebaseNotConfigured"));
      return;
    }

    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user.email) throw new Error("No email found from Google.");
      const userEmail = user.email.toLowerCase();

      const groupId = await findMemberGroupByEmail(userEmail);
      
      if (groupId) {
        router.push(`/group/${groupId}`);
      } else {
        // Not a member, check if they are an Admin
        let adminProfile = await getAdminProfile(user.uid);
        
        // If not found by UID, try finding by email (auto-repair link)
        if (!adminProfile && userEmail) {
          const profileByEmail = await findAdminProfileByEmail(userEmail);
          if (profileByEmail) {
            await migrateAdminProfile(profileByEmail.id, user.uid);
            adminProfile = profileByEmail;
          }
        }

        if (adminProfile) {
          router.push("/admin");
        } else {
          // Not a member or admin yet: show the join request form
          setFullName(user.displayName || "");
          setEmail(userEmail);
          setIsLoadingGroups(true);
          setShowJoinForm(true);
          listGroups()
            .then(setGroups)
            .catch(err => {
              console.error("Failed to load groups:", err);
              setError(`Failed to load groups list: ${err instanceof Error ? err.message : "Unknown error"}`);
            })
            .finally(() => setIsLoadingGroups(false));
        }
      }
    } catch (err) {
      const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code?: string }).code) : "";
      if (code === "auth/popup-closed-by-user") {
        setError(null);
      } else if (code === "permission-denied") {
        setError(`${t("errors.permissionDenied")} (${code}: ${err instanceof Error ? err.message : "unknown"})`);
      } else {
        setError(tx(err instanceof Error ? err.message : t("adminLogin.errFailed")));
      }
    } finally {
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

    setIsSubmitting(true);

    try {
      await submitJoinRequest(selectedGroupId, fullName, email);
      setShowJoinForm(false);
      setSuccessMsg(t("enterForm.joinRequestSuccess"));
    } catch (err) {
      setError(tx(err instanceof Error ? err.message : t("enterForm.joinRequestError")));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (showJoinForm) {
    return (
      <form className="grid gap-5" onSubmit={handleJoinSubmit}>
        <div className="flex items-start gap-3.5 rounded-[var(--radius-sm)] border border-[color:var(--accent-dim)] bg-gradient-to-r from-[color:var(--accent-dim)] to-transparent p-4">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--accent)] text-white text-sm">✉</div>
          <div>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">{t("enterForm.requestingToJoin")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--soft-foreground)]">{t("enterForm.joinHelp")}</p>
          </div>
        </div>

        <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)] opacity-80">
          {t("enterForm.fullName")}
          <input className="input cursor-not-allowed" value={fullName} disabled />
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-[color:var(--foreground)] opacity-80">
          <span className="flex items-center gap-1.5">
            {t("enterForm.emailLabel")}
            <span className="inline-flex items-center rounded-full bg-[color:var(--success-bg)] border border-[color:var(--success-border)] px-2 py-px text-[0.6rem] font-bold text-[color:var(--success-text)]">✓ Google</span>
          </span>
          <input className="input cursor-not-allowed" value={email} disabled />
        </label>

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
        </label>

        {error && <p className="alert-error">{error}</p>}

        <div className="grid gap-2.5 mt-1">
          <button className="button-primary w-full py-3" disabled={isSubmitting} type="submit">
            {isSubmitting ? t("enterForm.submittingRequest") : t("enterForm.submitJoinRequest")}
          </button>
          <button className="w-full py-2.5 text-sm font-medium text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors" onClick={() => setShowJoinForm(false)} type="button">
            ← {t("common.back")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid gap-5">
      {successMsg && (
        <div className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[color:var(--success-border)] bg-[color:var(--success-bg)] p-4">
          <span className="text-lg leading-none mt-0.5">🎉</span>
          <p className="text-sm font-medium text-[color:var(--success-text)]">{successMsg}</p>
        </div>
      )}

      {error && <p className="alert-error">{error}</p>}

      <button
        className="button-primary w-full flex items-center justify-center gap-3 py-3.5 text-[0.95rem]"
        disabled={isSubmitting || !isFirebaseConfigured}
        onClick={handleGoogleSignIn}
        type="button"
      >
        <svg className="h-5 w-5 bg-white rounded-full p-0.5 shrink-0" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <span className="font-semibold">
          {isSubmitting ? t("adminLoginForm.signingIn") : t("enterForm.signInWithGoogle")}
        </span>
      </button>

      <p className="text-center text-[0.7rem] text-[color:var(--muted)] leading-relaxed px-2">
        {t("enterForm.joinHint")}
      </p>
    </div>
  );
}
