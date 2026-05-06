"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  createMember,
  deleteMember,
  getAdminProfile,
  listMembers,
  updateMember,
} from "@/lib/firebase/repositories";
import { toDateInputValue } from "@/lib/utils/date";
import type { AdminProfile, Member } from "@/types/domain";

type MemberFormState = {
  fullName: string;
  joinDate: string;
  phoneNumber: string;
};

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
    if (configurationError || !auth) {
      return;
    }

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

        if (!profile) {
          throw new Error("No admin profile was found for the current user.");
        }

        const currentMembers = await listMembers(profile.groupId);
        setAdminProfile(profile);
        setMembers(currentMembers);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load members.",
        );
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [configurationError]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return members;
    }

    return members.filter((member) => {
      return (
        member.fullName.toLowerCase().includes(query) ||
        member.phoneNumber.toLowerCase().includes(query)
      );
    });
  }, [members, search]);

  function resetForm() {
    setForm(initialForm);
    setEditingMemberId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!adminProfile) {
      setError("Admin profile is required before managing members.");
      return;
    }

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

        setMembers((current) =>
          current
            .map((member) => (member.id === updated.id ? updated : member))
            .sort((left, right) => left.fullName.localeCompare(right.fullName)),
        );
      } else {
        const created = await createMember({
          groupId: adminProfile.groupId,
          fullName: form.fullName.trim(),
          joinDate: form.joinDate,
          phoneNumber: form.phoneNumber.trim(),
        });

        setMembers((current) =>
          [...current, created].sort((left, right) =>
            left.fullName.localeCompare(right.fullName),
          ),
        );
      }

      resetForm();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Failed to save member.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(memberId: string) {
    if (!adminProfile) {
      return;
    }

    setError(null);

    try {
      await deleteMember(adminProfile.groupId, memberId);
      setMembers((current) => current.filter((member) => member.id !== memberId));

      if (editingMemberId === memberId) {
        resetForm();
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to remove member.",
      );
    }
  }

  function startEdit(member: Member) {
    setEditingMemberId(member.id);
    setForm({
      fullName: member.fullName,
      joinDate: member.joinDate,
      phoneNumber: member.phoneNumber,
    });
  }

  if (isLoading) {
    return <p className="mt-8 text-sm text-[color:var(--soft-foreground)]">Loading members...</p>;
  }

  return (
    <div className="mt-8 grid gap-6">
      {error ? (
        <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form
        className="grid gap-4 rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)] p-5"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-medium">
            Full name
            <input
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
              onChange={(event) =>
                setForm((current) => ({ ...current, fullName: event.target.value }))
              }
              placeholder="Md. Rahim"
              value={form.fullName}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Join date
            <input
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
              onChange={(event) =>
                setForm((current) => ({ ...current, joinDate: event.target.value }))
              }
              type="date"
              value={form.joinDate}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Phone number
            <input
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
              onChange={(event) =>
                setForm((current) => ({ ...current, phoneNumber: event.target.value }))
              }
              placeholder="01XXXXXXXXX"
              value={form.phoneNumber}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="button-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!adminProfile || isSubmitting}
            type="submit"
          >
            {isSubmitting
              ? editingMemberId
                ? "Updating member..."
                : "Adding member..."
              : editingMemberId
                ? "Update member"
                : "Add member"}
          </button>

          {editingMemberId ? (
            <button className="button-secondary" onClick={resetForm} type="button">
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Members
            </p>
            <p className="mt-2 text-lg font-semibold">
              {filteredMembers.length} shown / {members.length} total
            </p>
          </div>

          <input
            className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)] sm:w-72"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search member or phone"
            value={search}
          />
        </div>

        <div className="mt-5 grid gap-3">
          {filteredMembers.length ? (
            filteredMembers.map((member) => (
              <article
                key={member.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-4"
              >
                <div>
                  <p className="text-lg font-semibold">{member.fullName}</p>
                  <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
                    Joined {member.joinDate}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
                    Phone {member.phoneNumber}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    className="button-secondary"
                    onClick={() => startEdit(member)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() => void handleDelete(member.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="text-sm text-[color:var(--soft-foreground)]">
              No members matched your search.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
