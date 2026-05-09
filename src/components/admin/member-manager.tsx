"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { createMember, deleteMember, getAdminProfile, listMembers, updateMember } from "@/lib/firebase/repositories";
import { toDateInputValue } from "@/lib/utils/date";
import type { AdminProfile, Member } from "@/types/domain";

type MemberFormState = { fullName: string; joinDate: string; phoneNumber: string };
const initialForm: MemberFormState = {
  fullName: "",
  joinDate: toDateInputValue(new Date()),
  phoneNumber: "",
};

export function MemberManager() {
  const configurationError =
    !isFirebaseConfigured || !auth
      ? "Firebase is not configured yet. Add your keys in .env.local first."
      : null;

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState<MemberFormState>(initialForm);
  const [search, setSearch] = useState("");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(configurationError);
  const [isLoading, setIsLoading] = useState(!configurationError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (configurationError || !auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAdminProfile(null);
        setMembers([]);
        setError("Log in as an admin to manage members.");
        setIsLoading(false);
        return;
      }
      try {
        setError(null);
        const profile = await getAdminProfile(user.uid);
        if (!profile) throw new Error("No admin profile was found for the current user.");
        const currentMembers = await listMembers(profile.groupId);
        setAdminProfile(profile);
        setMembers(currentMembers);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load members.");
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [configurationError]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter((m) =>
      m.fullName.toLowerCase().includes(query) || m.phoneNumber.toLowerCase().includes(query)
    );
  }, [members, search]);

  function resetForm() {
    setForm(initialForm);
    setEditingMemberId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!adminProfile) { setError("Admin profile is required before managing members."); return; }
    if (!form.fullName.trim() || !form.joinDate.trim() || !form.phoneNumber.trim()) {
      setError("Full name, join date, and phone number are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingMemberId) {
        const updated = await updateMember({
          groupId: adminProfile.groupId,
          memberId: editingMemberId,
          fullName: form.fullName.trim(),
          joinDate: form.joinDate,
          phoneNumber: form.phoneNumber.trim(),
        });
        setMembers((c) =>
          c.map((m) => (m.id === updated.id ? updated : m)).sort((a, b) => a.fullName.localeCompare(b.fullName))
        );
      } else {
        const created = await createMember({
          groupId: adminProfile.groupId,
          fullName: form.fullName.trim(),
          joinDate: form.joinDate,
          phoneNumber: form.phoneNumber.trim(),
        });
        setMembers((c) => [...c, created].sort((a, b) => a.fullName.localeCompare(b.fullName)));
      }
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save member.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(memberId: string) {
    if (!adminProfile) return;
    setError(null);
    try {
      await deleteMember(adminProfile.groupId, memberId);
      setMembers((c) => c.filter((m) => m.id !== memberId));
      if (editingMemberId === memberId) resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove member.");
    }
  }

  function startEdit(member: Member) {
    setEditingMemberId(member.id);
    setForm({ fullName: member.fullName, joinDate: member.joinDate, phoneNumber: member.phoneNumber });
  }

  if (isLoading) {
    return <p className="mt-8 text-sm text-[color:var(--soft-foreground)]">Loading members…</p>;
  }

  return (
    <div className="mt-6 grid gap-5">
      {error && <p className="alert-error">{error}</p>}

      <form
        className="grid gap-4 rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]"
        onSubmit={handleSubmit}
      >
        <p className="admin-section-label">{editingMemberId ? "Edit Member" : "Add Member"}</p>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Full name
            <input
              className="input"
              onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))}
              placeholder="Md. Rahim"
              value={form.fullName}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Join date
            <input
              className="input"
              onChange={(e) => setForm((c) => ({ ...c, joinDate: e.target.value }))}
              placeholder={toDateInputValue(new Date())}
              type="date"
              value={form.joinDate}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Phone number
            <input
              className="input"
              onChange={(e) => setForm((c) => ({ ...c, phoneNumber: e.target.value }))}
              placeholder="01XXXXXXXXX"
              value={form.phoneNumber}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="button-primary" disabled={!adminProfile || isSubmitting} type="submit">
            {isSubmitting
              ? editingMemberId ? "Updating…" : "Adding…"
              : editingMemberId ? "Update member" : "Add member"}
          </button>
          {editingMemberId && (
            <button className="button-secondary" onClick={resetForm} type="button">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="admin-section-label">Members</p>
            <p className="mt-1.5 text-lg font-semibold">
              {filteredMembers.length} shown
              <span className="ml-1 text-sm font-normal text-[color:var(--muted)]">/ {members.length} total</span>
            </p>
          </div>
          <input
            className="input w-full sm:w-64"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member or phone…"
            value={search}
          />
        </div>

        <div className="mt-4 grid gap-2.5">
          {filteredMembers.length ? (
            filteredMembers.map((member) => (
              <article
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{member.fullName}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                    Joined {member.joinDate} · {member.phoneNumber}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="button-secondary" onClick={() => startEdit(member)} type="button">
                    Edit
                  </button>
                  <button className="button-danger" onClick={() => void handleDelete(member.id)} type="button">
                    Remove
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">
              No members matched your search.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
