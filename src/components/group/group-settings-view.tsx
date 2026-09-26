"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useT } from "@/i18n/use-t";
import { useToast } from "@/lib/hooks/use-toast";
import { useUiStore } from "@/store/ui-store";
import { useAuthStore } from "@/store/auth-store";
import { useGroup, useMembers, useAdminProfiles } from "@/lib/hooks/use-data";
import { useCurrentAdminProfile } from "@/lib/hooks/use-current-admin-profile";
import Link from "next/link";

import { AdminLoadingState } from "@/components/admin/admin-loading-state";

export function GroupSettingsView({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { t } = useT();
  const { toast } = useToast();
  const { language, setLanguage, theme, setTheme } = useUiStore();
  const { admin: currentUser, isLoaded } = useAuthStore();
  const { data: group, isLoading: groupLoading } = useGroup(groupId);
  const { data: members = [] } = useMembers(groupId);
  const { data: adminProfiles = [] } = useAdminProfiles(groupId);
  const { adminProfile } = useCurrentAdminProfile();

  const [isSigningOut, setIsSigningOut] = useState(false);

  const currentEmail = currentUser?.email?.trim().toLowerCase();
  const signedInMember = useMemo(() => {
    if (!currentEmail || members.length === 0) return null;
    return members.find((m) => m.email.trim().toLowerCase() === currentEmail) ?? null;
  }, [currentEmail, members]);

  const isGroupAdmin = adminProfile?.groupId === groupId;
  const isOwner = isGroupAdmin && (adminProfile?.role === "owner" || group?.adminId === currentUser?.uid);

  async function handleSignOut() {
    if (!auth) return;
    setIsSigningOut(true);
    try {
      await signOut(auth);
      useAuthStore.getState().setAdmin(null);
      toast(t("adminNav.signOut"), "success");
      router.push("/");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to sign out.", "error");
      setIsSigningOut(false);
    }
  }

  if (!isLoaded || groupLoading) {
    return <AdminLoadingState message={t("adminDash.loading")} />;
  }

  if (!currentUser) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--panel)] p-6 shadow-sm sm:p-8">
        <p className="admin-section-label">{t("adminDash.notSignedIn")}</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{t("adminDash.accessRequired")}</h1>
        <p className="mt-2 text-sm text-[color:var(--soft-foreground)]">{t("adminDash.signInToManage")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/admin/login" className="button-primary text-xs">
            {t("adminNav.login")}
          </Link>
          <Link href={`/group/${groupId}`} className="button-secondary text-xs">
            {t("groupNav.home")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div>
        <p className="admin-section-label">{group?.name ?? groupId}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("adminNav.settings")}
        </h1>
        <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
          {t("adminSettings.preferencesSubtitle")}
        </p>
      </div>

      {/* App Preferences */}
      <section className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-xs sm:p-6">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚙️</span>
          <h2 className="text-base font-semibold">{t("adminSettings.preferencesSection")}</h2>
        </div>
        <p className="mt-1 text-xs text-[color:var(--soft-foreground)]">
          {t("adminSettings.preferencesSubtitle")}
        </p>

        <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
          {/* Language Toggle */}
          <div className="flex flex-col justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[color:var(--muted)]">
                  {t("adminSettings.languageLabel")}
                </span>
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
                <span className="text-xs font-semibold text-[color:var(--muted)]">
                  {t("adminSettings.themeLabel")}
                </span>
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
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                  theme === "light"
                    ? "bg-[color:var(--accent)] text-white shadow-xs"
                    : "text-[color:var(--soft-foreground)] hover:text-[color:var(--foreground)]"
                }`}
              >
                ☀️ {t("adminSettings.themeLight")}
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                  theme === "dark"
                    ? "bg-[color:var(--accent)] text-white shadow-xs"
                    : "text-[color:var(--soft-foreground)] hover:text-[color:var(--foreground)]"
                }`}
              >
                🌙 {t("adminSettings.themeDark")}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Account / User Section */}
      <section className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-xs sm:p-6">
        <div className="flex items-center gap-2">
          <span className="text-lg">👤</span>
          <h2 className="text-base font-semibold">{t("adminSettings.sessionLabel")}</h2>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-4">
            <p className="text-xs font-semibold text-[color:var(--muted)]">{t("adminSettings.adminEmail")}</p>
            <p className="mt-1 text-sm font-medium">{currentUser?.email ?? "—"}</p>
            {signedInMember && (
              <p className="mt-0.5 text-xs text-[color:var(--soft-foreground)]">{signedInMember.fullName}</p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--accent-dim)] px-2.5 py-0.5 text-xs font-semibold text-[color:var(--accent)]">
                {isOwner
                  ? `👑 ${t("memberMgr.owner")}`
                  : isGroupAdmin
                    ? `🛡️ ${t("memberMgr.temporaryAdmin")}`
                    : `👤 ${t("groupNav.panel")}`}
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-4">
            <div>
              <p className="text-xs font-semibold text-[color:var(--muted)]">{t("adminSettings.signOutBtn")}</p>
              <p className="mt-1 text-xs text-[color:var(--soft-foreground)]">
                {t("adminSettings.sessionDesc")}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="button-secondary !py-1.5 !px-3 text-xs font-semibold"
              >
                {isSigningOut ? t("common.loading") : t("adminSettings.signOutBtn")}
              </button>
              {isGroupAdmin && (
                <Link
                  href="/admin/settings"
                  className="button-primary !py-1.5 !px-3 text-xs font-semibold flex items-center gap-1"
                >
                  <span>🛡️</span>
                  <span>{t("groupNav.adminPanel")}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
