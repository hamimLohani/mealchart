"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase/client";
import { doc, getDoc } from "firebase/firestore";
import { useT } from "@/i18n/use-t";
import { groupsCollection } from "@/lib/firebase/paths";
import { getAdminProfile } from "@/lib/firebase/repositories";
import { useAuthStore } from "@/store/auth-store";
import type { Group } from "@/types/domain";

const navItemKeys = [
  { href: "/admin/members", labelKey: "adminNav.members" as const, hintKey: "adminNav.membersHint" as const, metric: "01" },
  {
    href: "/admin/add-money",
    labelKey: "adminNav.addMoney" as const,
    hintKey: "adminNav.addMoneyHint" as const,
    metric: "02",
  },
  {
    href: "/admin/edit-meals",
    labelKey: "adminNav.editMeals" as const,
    hintKey: "adminNav.editMealsHint" as const,
    metric: "03",
  },
  { href: "/admin/costs", labelKey: "adminNav.costs" as const, hintKey: "adminNav.costsHint" as const, metric: "04" },
  {
    href: "/admin/create-chart",
    labelKey: "adminNav.createChart" as const,
    hintKey: "adminNav.createChartHint" as const,
    metric: "05",
  },
  {
    href: "/admin/notices",
    labelKey: "adminNav.notices" as const,
    hintKey: "adminNav.noticesHint" as const,
    metric: "06",
  },
];

export default function AdminPage() {
  const { admin, isLoaded } = useAuthStore();
  const router = useRouter();
  const { t, tx } = useT();
  const [group, setGroup] = useState<Group | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasCopiedToken, setHasCopiedToken] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadGroup() {
      if (!admin) {
        setGroup(null);
        return;
      }
      try {
        setLoadError(null);
        const profile = await getAdminProfile(admin.uid);
        if (!profile) throw new Error("No admin profile was found for this account.");
        if (!db) throw new Error("Firebase not configured.");
        const groupSnap = await getDoc(doc(db, groupsCollection, profile.groupId));
        const currentGroup = groupSnap.exists() ? ({ id: groupSnap.id, ...groupSnap.data() } as Group) : null;
        if (!currentGroup) throw new Error("No group was found for this admin profile.");
        if (!active) return;
        setGroup(currentGroup);
      } catch (error) {
        if (!active) return;
        setLoadError(tx(error instanceof Error ? error.message : t("errors.loadGroupDetails")));
      }
    }

    void loadGroup();
    return () => {
      active = false;
    };
  }, [admin, t, tx]);

  const groupInitials = group?.name
    ? group.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("")
    : "MC";

  async function handleLogout() {
    if (auth) await signOut(auth);
    router.push("/admin/login");
  }

  async function handleCopyToken() {
    if (!group?.token) return;
    try {
      await navigator.clipboard.writeText(group.token);
      setHasCopiedToken(true);
    } catch {
      setLoadError(t("adminDash.copyFailed"));
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-[color:var(--soft-foreground)]">{t("adminDash.loading")}</p>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--panel)] p-6 shadow-[var(--shadow)] sm:p-8">
        <p className="admin-section-label">{t("adminDash.notSignedIn")}</p>
        <h1 className="mt-2 text-2xl font-semibold">{t("adminDash.accessRequired")}</h1>
        <p className="mt-2 text-sm text-[color:var(--soft-foreground)]">{t("adminDash.signInToManage")}</p>
        <Link className="button-primary mt-5 inline-flex" href="/admin/login">
          {t("adminDash.goLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {loadError && <p className="alert-error">{loadError}</p>}

      <section className="admin-dashboard-hero">
        <div className="min-w-0">
          <p className="admin-section-label">{t("adminDash.workspace")}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {group?.name ?? t("adminDash.manageFallback")}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[color:var(--soft-foreground)]">
            {t("adminDash.subtitle")}
          </p>
        </div>
        <button onClick={handleLogout} type="button" className="button-secondary shrink-0">
          {t("adminDash.signOut")}
        </button>
      </section>

      <section className="admin-token-panel">
        <div className="flex min-w-0 items-center gap-3">
          <div className="admin-token-mark">{groupInitials}</div>
          <div className="min-w-0">
            <p className="admin-section-label">{t("adminDash.tokenLabel")}</p>
            <p className="mt-1 truncate font-mono text-lg font-semibold text-[color:var(--foreground)]">
              {group?.token ?? t("common.loading")}
            </p>
            <p className="mt-0.5 text-xs text-[color:var(--soft-foreground)]">{t("adminDash.tokenHelp")}</p>
          </div>
        </div>
        <button
          className="button-primary w-full sm:w-auto"
          disabled={!group?.token}
          onClick={() => void handleCopyToken()}
          type="button"
        >
          {hasCopiedToken ? t("adminDash.tokenCopied") : t("adminDash.copyToken")}
        </button>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {navItemKeys.map((item) => (
          <Link key={item.href} href={item.href} className="admin-panel-card">
            <span className="admin-panel-card-index">{item.metric}</span>
            <p className="admin-panel-card-title">{t(item.labelKey)}</p>
            <p className="admin-panel-card-hint">{t(item.hintKey)}</p>
            <span className="admin-panel-card-arrow">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
