"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase/client";
import { doc, getDoc } from "firebase/firestore";
import { groupsCollection } from "@/lib/firebase/paths";
import { getAdminProfile } from "@/lib/firebase/repositories";
import { useAuthStore } from "@/store/auth-store";
import type { Group } from "@/types/domain";

const navItems = [
  { href: "/admin/members", label: "Members", hint: "Add, edit, remove members", metric: "01" },
  { href: "/admin/add-money", label: "Add Money", hint: "Record member deposits", metric: "02" },
  { href: "/admin/edit-meals", label: "Edit Meals", hint: "Update daily meal counts", metric: "03" },
  { href: "/admin/costs", label: "Costs", hint: "Log bazar and expenses", metric: "04" },
  { href: "/admin/create-chart", label: "Create Chart", hint: "Start a new monthly sheet", metric: "05" },
  { href: "/admin/notices", label: "Notices", hint: "View group updates", metric: "06" },
];

export default function AdminPage() {
  const { admin, isLoaded } = useAuthStore();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasCopiedToken, setHasCopiedToken] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadGroup() {
      if (!admin) { setGroup(null); return; }
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
        setLoadError(error instanceof Error ? error.message : "Failed to load group details.");
      }
    }

    void loadGroup();
    return () => { active = false; };
  }, [admin]);

  const groupInitials = group?.name
    ? group.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")
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
      setLoadError("Could not copy the token automatically. Select it and copy manually.");
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-[color:var(--soft-foreground)]">Loading…</p>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--panel)] p-6 shadow-[var(--shadow)] sm:p-8">
        <p className="admin-section-label">Not signed in</p>
        <h1 className="mt-2 text-2xl font-semibold">Admin access required</h1>
        <p className="mt-2 text-sm text-[color:var(--soft-foreground)]">
          Sign in to manage your group.
        </p>
        <Link className="button-primary mt-5 inline-flex" href="/admin/login">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {loadError && <p className="alert-error">{loadError}</p>}

      <section className="admin-dashboard-hero">
        <div className="min-w-0">
          <p className="admin-section-label">Admin Workspace</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {group?.name ?? "Manage your group"}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[color:var(--soft-foreground)]">
            Manage members, meals, costs, deposits, notices, and monthly reports from one place.
          </p>
        </div>
        <button onClick={handleLogout} type="button" className="button-secondary shrink-0">
          Sign out
        </button>
      </section>

      <section className="admin-token-panel">
        <div className="flex min-w-0 items-center gap-3">
          <div className="admin-token-mark">{groupInitials}</div>
          <div className="min-w-0">
            <p className="admin-section-label">Group Token</p>
            <p className="mt-1 truncate font-mono text-lg font-semibold text-[color:var(--foreground)]">
              {group?.token ?? "Loading…"}
            </p>
            <p className="mt-0.5 text-xs text-[color:var(--soft-foreground)]">
              Share this token with members so they can enter the group.
            </p>
          </div>
        </div>
        <button
          className="button-primary w-full sm:w-auto"
          disabled={!group?.token}
          onClick={() => void handleCopyToken()}
          type="button"
        >
          {hasCopiedToken ? "✓ Token copied" : "Copy token"}
        </button>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="admin-panel-card">
            <span className="admin-panel-card-index">{item.metric}</span>
            <p className="admin-panel-card-title">{item.label}</p>
            <p className="admin-panel-card-hint">{item.hint}</p>
            <span className="admin-panel-card-arrow">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
