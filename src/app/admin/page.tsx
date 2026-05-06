"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuthStore } from "@/store/auth-store";

const navItems = [
  { href: "/admin/members",     label: "Members",      hint: "Add, edit, remove members",        icon: "👥" },
  { href: "/admin/add-money",   label: "Add Money",    hint: "Record member deposits",            icon: "💰" },
  { href: "/admin/edit-meals",  label: "Edit Meals",   hint: "Update daily meal counts",          icon: "🍽️" },
  { href: "/admin/costs",       label: "Costs",        hint: "Log bazar and expenses",            icon: "🧾" },
  { href: "/admin/create-chart",label: "Create Chart", hint: "Start a new monthly sheet",         icon: "📊" },
  { href: "/admin/notices",     label: "Notices",      hint: "View group updates",                icon: "🔔" },
];

export default function AdminPage() {
  const { admin, isLoaded } = useAuthStore();
  const router = useRouter();

  async function handleLogout() {
    if (auth) await signOut(auth);
    router.push("/admin/login");
  }

  if (!isLoaded) {
    return <p className="py-10 text-center text-sm text-[color:var(--soft-foreground)]">Loading…</p>;
  }

  if (!admin) {
    return (
      <div className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
          Not signed in
        </p>
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
    <div className="grid gap-4">
      {/* Identity header — visible on all sizes */}
      <div className="flex items-center justify-between gap-3 rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent)] text-sm font-bold text-white">
            {admin.email?.[0]?.toUpperCase() ?? "A"}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
              Admin Panel
            </p>
            <p className="truncate text-sm font-medium text-[color:var(--foreground)]">
              {admin.email}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          type="button"
          className="shrink-0 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--soft-foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--foreground)]"
        >
          Logout
        </button>
      </div>

      {/* Nav grid — 2 columns on mobile, hidden on md+ (sidebar handles it) */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col gap-2 rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-4 active:scale-[0.97] transition-transform"
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-sm font-semibold text-[color:var(--foreground)]">{item.label}</span>
            <span className="text-xs leading-snug text-[color:var(--soft-foreground)]">{item.hint}</span>
          </Link>
        ))}
      </div>

      {/* Desktop welcome + quick links — hidden on mobile */}
      <div className="hidden md:grid md:gap-4">
        <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[linear-gradient(135deg,var(--panel),color-mix(in_srgb,var(--background)_80%,var(--accent)_20%))] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
            Welcome back
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Manage your group</h1>
          <p className="mt-1.5 text-sm text-[color:var(--soft-foreground)]">
            Use the sidebar to navigate between sections.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="admin-panel-card"
            >
              <p className="admin-panel-card-title">{item.label}</p>
              <p className="admin-panel-card-hint">{item.hint}</p>
              <span className="admin-panel-card-arrow">→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
