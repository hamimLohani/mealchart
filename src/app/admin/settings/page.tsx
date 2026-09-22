"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useT } from "@/i18n/use-t";
import { useToast } from "@/lib/hooks/use-toast";
import { useAuthStore } from "@/store/auth-store";
import { useCurrentAdminProfile } from "@/lib/hooks/use-current-admin-profile";
import { useGroup, useMembers, useAdminProfiles } from "@/lib/hooks/use-data";
import { deleteEntireGroupAndAccount, deleteAdminProfile } from "@/lib/firebase/repositories";
import { sendAccountDeletionEmails } from "@/lib/email/actions";
import { AdminLoadingState } from "@/components/admin/admin-loading-state";
import { useUiStore } from "@/store/ui-store";

export default function AdminSettingsPage() {
  const router = useRouter();
  const { t } = useT();
  const { toast } = useToast();
  const { language, setLanguage, theme, setTheme } = useUiStore();
  const { admin, isLoaded } = useAuthStore();
  const { adminProfile, isLoading: profileLoading } = useCurrentAdminProfile();
  const { data: group, isLoading: groupLoading } = useGroup(adminProfile?.groupId);
  const { data: members = [] } = useMembers(group?.id);
  const { data: adminProfiles = [] } = useAdminProfiles(group?.id);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [password, setPassword] = useState("");
  const [isGoogleVerified, setIsGoogleVerified] = useState(false);
  const [isVerifyingGoogle, setIsVerifyingGoogle] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionStep, setDeletionStep] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const isOwner = adminProfile?.role === "owner" || (group && group.adminId === admin?.uid);
  const isPasswordUser = useMemo(() => {
    return auth?.currentUser?.providerData.some((p) => p.providerId === "password") ?? false;
  }, []);
  const isGoogleUser = useMemo(() => {
    return auth?.currentUser?.providerData.some((p) => p.providerId === "google.com") ?? false;
  }, []);

  const expectedConfirmText = group?.name?.trim() ?? "DELETE";
  const isTextMatch = confirmInput.trim() === expectedConfirmText;
  const canSubmit = isOwner && isTextMatch && (!isPasswordUser || password.length > 0) && (!isGoogleUser || isGoogleVerified);

  const handleCopyToken = () => {
    if (!group?.token) return;
    navigator.clipboard.writeText(group.token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleGoogleVerify = async () => {
    if (!auth?.currentUser) return;
    setIsVerifyingGoogle(true);
    try {
      const provider = new GoogleAuthProvider();
      await reauthenticateWithPopup(auth.currentUser, provider);
      setIsGoogleVerified(true);
      toast(t("adminSettings.googleVerified"), "success");
    } catch (err) {
      console.error("Google re-auth failed:", err);
      toast(err instanceof Error ? err.message : t("adminSettings.reauthRequired"), "error");
    } finally {
      setIsVerifyingGoogle(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!isOwner) {
      toast(t("adminSettings.onlyOwnerCanDeleteNotice"), "error");
      return;
    }
    if (!canSubmit || !auth?.currentUser || !group || !admin) return;

    setIsDeleting(true);

    try {
      // 1. Re-authenticate password user if needed
      if (isPasswordUser) {
        if (!auth.currentUser.email) throw new Error("No user email found.");
        const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
        try {
          await reauthenticateWithCredential(auth.currentUser, credential);
        } catch {
          toast(t("adminSettings.wrongPassword"), "error");
          setIsDeleting(false);
          return;
        }
      }

      // 2. Prepare recipient list
      const recipientMap = new Map<string, { email: string; name?: string; role?: string }>();
      members.forEach((m) => {
        if (m.email) {
          recipientMap.set(m.email.trim().toLowerCase(), {
            email: m.email.trim().toLowerCase(),
            name: m.fullName,
            role: "member",
          });
        }
      });
      adminProfiles.forEach((a) => {
        if (a.email) {
          const norm = a.email.trim().toLowerCase();
          recipientMap.set(norm, {
            email: norm,
            name: a.fullName,
            role: a.role || "admin",
          });
        }
      });
      if (admin?.email) {
        const normAdmin = admin.email.trim().toLowerCase();
        recipientMap.set(normAdmin, {
          email: normAdmin,
          name: adminProfile?.fullName || admin.displayName || "Admin",
          role: isOwner ? "owner" : "admin",
        });
      }

      // 3. Send notification emails
      setDeletionStep(t("adminSettings.statusSendingEmails"));
      await sendAccountDeletionEmails({
        groupName: group.name,
        adminName: adminProfile?.fullName || admin.displayName || "Admin",
        adminEmail: admin.email || "",
        recipients: Array.from(recipientMap.values()),
      });

      // 4. Wipe data in Firestore
      setDeletionStep(t("adminSettings.statusDeletingData"));
      await deleteEntireGroupAndAccount(group.id, admin.uid);

      // 5. Delete Firebase Auth user
      setDeletionStep(t("adminSettings.statusDeletingAccount"));
      const userToDelete = auth.currentUser;
      await deleteUser(userToDelete);

      // 6. Sign out locally & cleanup
      await signOut(auth);
      useAuthStore.getState().setAdmin(null);
      toast(t("adminSettings.deleteSuccess"), "success");
      router.push("/");
    } catch (err) {
      console.error("Account deletion failed:", err);
      toast(err instanceof Error ? err.message : t("adminSettings.deleteFailed"), "error");
      setIsDeleting(false);
      setDeletionStep(null);
    }
  };

  if (!isLoaded || profileLoading || groupLoading) {
    return <AdminLoadingState message={t("adminDash.loading")} />;
  }

  if (!admin || !group) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--panel)] p-6 shadow-sm">
        <p className="admin-section-label">{t("adminDash.notSignedIn")}</p>
        <h1 className="mt-2 text-xl font-semibold">{t("adminDash.accessRequired")}</h1>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div>
        <p className="admin-section-label">{t("adminNav.settings")}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("adminSettings.title")}
        </h1>
        <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
          {t("adminSettings.subtitle")}
        </p>
      </div>

      {/* App Preferences & Session Section */}
      <section className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-xs sm:p-6">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚙️</span>
          <h2 className="text-base font-semibold">{t("adminSettings.preferencesSection")}</h2>
        </div>
        <p className="mt-1 text-xs text-[color:var(--soft-foreground)]">
          {t("adminSettings.preferencesSubtitle")}
        </p>

        <div className="mt-4 grid gap-3.5 sm:grid-cols-3">
          {/* Language Toggle */}
          <div className="flex flex-col justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[color:var(--muted)]">{t("adminSettings.languageLabel")}</span>
                <span className="rounded bg-[color:var(--panel)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--accent)] uppercase">
                  {language}
                </span>
              </div>
              <p className="mt-1 text-xs text-[color:var(--soft-foreground)]">
                {t("adminSettings.languageDesc")}
              </p>
            </div>
            <div className="mt-3 flex rounded-lg border border-[color:var(--border)] bg-[color:var(--panel)] p-1">
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                  language === "en"
                    ? "bg-[color:var(--accent)] text-white shadow-xs"
                    : "text-[color:var(--soft-foreground)] hover:text-[color:var(--foreground)]"
                }`}
              >
                EN (English)
              </button>
              <button
                type="button"
                onClick={() => setLanguage("bn")}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                  language === "bn"
                    ? "bg-[color:var(--accent)] text-white shadow-xs"
                    : "text-[color:var(--soft-foreground)] hover:text-[color:var(--foreground)]"
                }`}
              >
                বাং (বাংলা)
              </button>
            </div>
          </div>

          {/* Theme Toggle */}
          <div className="flex flex-col justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[color:var(--muted)]">{t("adminSettings.themeLabel")}</span>
                <span className="rounded bg-[color:var(--panel)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--accent)] capitalize">
                  {theme === "light" ? "☀️ Light" : "🌙 Dark"}
                </span>
              </div>
              <p className="mt-1 text-xs text-[color:var(--soft-foreground)]">
                {t("adminSettings.themeDesc")}
              </p>
            </div>
            <div className="mt-3 flex rounded-lg border border-[color:var(--border)] bg-[color:var(--panel)] p-1">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition ${
                  theme === "light"
                    ? "bg-[color:var(--accent)] text-white shadow-xs"
                    : "text-[color:var(--soft-foreground)] hover:text-[color:var(--foreground)]"
                }`}
              >
                <span>☀️</span>
                <span>{t("adminSettings.themeLight")}</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition ${
                  theme === "dark"
                    ? "bg-[color:var(--accent)] text-white shadow-xs"
                    : "text-[color:var(--soft-foreground)] hover:text-[color:var(--foreground)]"
                }`}
              >
                <span>🌙</span>
                <span>{t("adminSettings.themeDark")}</span>
              </button>
            </div>
          </div>

          {/* Session / Sign Out */}
          <div className="flex flex-col justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[color:var(--muted)]">{t("adminSettings.sessionLabel")}</span>
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" title="Active session" />
              </div>
              <p className="mt-1 text-xs text-[color:var(--soft-foreground)]">
                {t("adminSettings.sessionDesc")}
              </p>
            </div>
            <div className="mt-3">
              <button
                type="button"
                onClick={async () => {
                  if (!auth) return;
                  await signOut(auth);
                  router.push("/enter-group");
                }}
                className="button-secondary !py-1.5 !px-3 text-xs font-semibold flex items-center justify-center gap-2 w-full hover:border-[color:var(--accent)]"
              >
                <svg className="h-4 w-4 text-[color:var(--soft-foreground)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 8v8" />
                </svg>
                <span>{t("adminSettings.signOutBtn")}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Profile Section */}
      <section className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-xs sm:p-6">
        <h2 className="text-base font-semibold">{t("adminSettings.profileSection")}</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-3.5">
            <p className="text-xs font-semibold text-[color:var(--muted)]">{t("adminSettings.adminName")}</p>
            <p className="mt-1 text-sm font-medium">{adminProfile?.fullName || admin.displayName || "Admin"}</p>
          </div>

          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-3.5">
            <p className="text-xs font-semibold text-[color:var(--muted)]">{t("adminSettings.adminEmail")}</p>
            <p className="mt-1 text-sm font-medium">{admin.email}</p>
          </div>

          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-3.5">
            <p className="text-xs font-semibold text-[color:var(--muted)]">{t("adminSettings.adminRole")}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--accent)] text-white px-2.5 py-0.5 text-xs font-semibold">
                {isOwner ? `👑 ${t("memberMgr.owner")}` : `🛡️ ${t("memberMgr.temporaryAdmin")}`}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-3.5">
            <p className="text-xs font-semibold text-[color:var(--muted)]">{t("adminSettings.groupName")}</p>
            <p className="mt-1 text-sm font-medium">{group.name}</p>
          </div>

          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-3.5 sm:col-span-2">
            <p className="text-xs font-semibold text-[color:var(--muted)]">{t("adminSettings.groupToken")}</p>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <code className="rounded bg-[color:var(--panel)] px-2 py-1 font-mono text-sm font-bold text-[color:var(--accent)]">
                {group.token}
              </code>
              <button
                type="button"
                onClick={handleCopyToken}
                className="button-secondary !py-1 !px-2.5 text-xs"
              >
                {copiedToken ? "✓ Copied" : "Copy Token"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Danger Zone: Restricted strictly to Group Owner */}
      {isOwner ? (
        <section className="rounded-[var(--radius-lg)] border-2 border-[color:var(--danger)] bg-[color:var(--panel)] p-5 shadow-xs sm:p-6">
          <div className="flex items-center gap-2 text-[color:var(--danger)]">
            <span className="text-lg">⚠️</span>
            <h2 className="text-base font-bold uppercase tracking-wider">{t("adminSettings.dangerZone")}</h2>
          </div>
          <p className="mt-1 text-xs text-[color:var(--soft-foreground)]">
            {t("adminSettings.dangerZoneSubtitle")}
          </p>

          <div className="mt-5 flex flex-col gap-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className="text-sm font-bold text-[color:var(--foreground)]">
                {t("adminSettings.deleteAccountBtn")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[color:var(--soft-foreground)]">
                {t("adminSettings.deleteOwnerDesc")}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setConfirmInput("");
                setPassword("");
                setIsGoogleVerified(false);
                setIsModalOpen(true);
              }}
              className="button-danger shrink-0 !py-2.5 !px-4 text-xs font-bold"
            >
              {t("adminSettings.deleteAccountBtn")}
            </button>
          </div>
        </section>
      ) : (
        <section className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-xs sm:p-6">
          <div className="flex items-center gap-2 text-[color:var(--muted)]">
            <span className="text-lg">🛡️</span>
            <h2 className="text-base font-semibold">{t("adminSettings.dangerZone")}</h2>
          </div>
          <div className="mt-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-4">
            <p className="text-xs font-medium text-[color:var(--soft-foreground)] leading-relaxed">
              {t("adminSettings.onlyOwnerCanDeleteNotice")}
            </p>
          </div>
        </section>
      )}

      {/* Confirmation Modal */}
      <AnimatePresence>
        {isModalOpen && isOwner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setIsModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--panel)] p-6 shadow-2xl"
            >
              <div className="flex items-center gap-2.5 text-[color:var(--danger)]">
                <span className="text-2xl">⚠️</span>
                <h3 className="text-lg font-bold">{t("adminSettings.modalTitle")}</h3>
              </div>

              <p className="mt-2 text-xs font-semibold text-[color:var(--danger)]">
                {t("adminSettings.modalWarning")}
              </p>

              <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-3 text-xs leading-relaxed text-[color:var(--soft-foreground)]">
                <p className="font-semibold text-[color:var(--foreground)]">
                  {t("adminSettings.deleteOwnerDesc")}
                </p>
                <p className="mt-2 text-[11px] text-[color:var(--muted)]">
                  Notification email will be sent to {members.length} member(s) and {adminProfiles.length} admin(s).
                </p>
              </div>

              {/* Confirmation Prompt */}
              <div className="mt-4 grid gap-3">
                <div>
                  <label className="text-xs font-semibold text-[color:var(--foreground)]">
                    {t("adminSettings.confirmTypeGroup").replace("{name}", group.name)}
                  </label>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    disabled={isDeleting}
                    placeholder={expectedConfirmText}
                    className="input-field mt-1 w-full text-xs font-mono"
                    autoFocus
                  />
                </div>

                {/* Password confirmation if password account */}
                {isPasswordUser && (
                  <div>
                    <label className="text-xs font-semibold text-[color:var(--foreground)]">
                      {t("adminSettings.passwordLabel")}
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isDeleting}
                      placeholder={t("adminSettings.passwordPlaceholder")}
                      className="input-field mt-1 w-full text-xs"
                    />
                  </div>
                )}

                {/* Google re-auth button if Google user */}
                {isGoogleUser && (
                  <div>
                    <label className="text-xs font-semibold text-[color:var(--foreground)]">
                      Google Authentication
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleGoogleVerify}
                        disabled={isGoogleVerified || isVerifyingGoogle || isDeleting}
                        className={`button-secondary !py-1.5 !px-3 text-xs font-semibold flex items-center gap-1.5 ${
                          isGoogleVerified ? "!border-[color:var(--accent)] !text-[color:var(--accent)]" : ""
                        }`}
                      >
                        <span>{isGoogleVerified ? "✓" : "🔒"}</span>
                        <span>{isGoogleVerified ? t("adminSettings.googleVerified") : t("adminSettings.reauthGoogleBtn")}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Progress message during deletion */}
              {deletionStep && (
                <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-[color:var(--accent)] bg-[color:var(--accent-dim)] p-3 text-xs font-bold text-[color:var(--accent)]">
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>{deletionStep}</span>
                </div>
              )}

              {/* Modal Actions */}
              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isDeleting}
                  className="button-secondary !py-2 !px-4 text-xs font-semibold"
                >
                  {t("adminSettings.cancelBtn")}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={!canSubmit || isDeleting}
                  className="button-danger !py-2 !px-4 text-xs font-bold disabled:opacity-50"
                >
                  {isDeleting ? "Deleting…" : t("adminSettings.confirmDeleteBtn")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
