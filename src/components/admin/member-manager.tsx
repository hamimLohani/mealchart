"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useT } from "@/i18n/use-t";
import { createMember, deleteMember, listMembers, updateMember, listJoinRequests, approveJoinRequest, rejectJoinRequest, getGroupById } from "@/lib/firebase/repositories";
import { toDateInputValue } from "@/lib/utils/date";
import type { AdminProfile, Member, JoinRequest } from "@/types/domain";
import { sendWelcomeEmail, sendRemovalEmail } from "@/lib/email/actions";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import { AdminLoadingState } from "@/components/admin/admin-loading-state";
import { useCurrentAdminProfile } from "@/lib/hooks/use-current-admin-profile";

type MemberFormState = { fullName: string; joinDate: string; email: string };
const initialForm: MemberFormState = {
  fullName: "",
  joinDate: toDateInputValue(new Date()),
  email: "",
};

export function MemberManager() {
  const { t, tx } = useT();
  const configurationError =
    !isFirebaseConfigured || !auth
      ? "Firebase is not configured yet. Add your keys in .env.local first."
      : null;

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [form, setForm] = useState<MemberFormState>(initialForm);
  const [search, setSearch] = useState("");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(configurationError);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const { adminProfile: currentAdminProfile, isLoading: profileLoading, error: profileError } = useCurrentAdminProfile();
  const activeAdminProfile =
    currentAdminProfile && adminProfile?.id === currentAdminProfile.id ? adminProfile : null;
  const visibleMembers = useMemo(
    () => (activeAdminProfile ? members : []),
    [activeAdminProfile, members],
  );
  const visibleJoinRequests = useMemo(
    () => (activeAdminProfile ? joinRequests : []),
    [activeAdminProfile, joinRequests],
  );
  const resolvedError =
    error ??
    (profileError
      ? profileError instanceof Error
        ? profileError.message
        : "Failed to load members."
      : !profileLoading && !currentAdminProfile && !configurationError
        ? "Log in as an admin to manage members."
        : null);

  useGlobalLoading(
    "member-manager",
    isLoading || profileLoading || isSubmitting || isRemoving,
    isLoading
      ? t("memberMgr.loadingList")
      : isRemoving
        ? t("memberMgr.submittingRemove")
        : editingMemberId
          ? t("memberMgr.submittingUpdate")
          : t("memberMgr.submittingAdd"),
  );

  useEffect(() => {
    if (configurationError || !auth) return;
    if (profileLoading) return;
    if (profileError || !currentAdminProfile) return;

    let active = true;
    void (async () => {
      try {
        if (!active) return;
        setIsLoading(true);
        setError(null);
        const [currentMembers, currentRequests, group] = await Promise.all([
          listMembers(currentAdminProfile.groupId),
          listJoinRequests(currentAdminProfile.groupId),
          getGroupById(currentAdminProfile.groupId),
        ]);
        if (!active) return;
        setAdminProfile(currentAdminProfile);
        setGroupName(group?.name ?? "");
        setMembers(currentMembers);
        setJoinRequests(currentRequests);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load members.");
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [configurationError, currentAdminProfile, profileError, profileLoading]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return visibleMembers;
    return visibleMembers.filter((m) =>
      m.fullName.toLowerCase().includes(query) || m.email.toLowerCase().includes(query)
    );
  }, [search, visibleMembers]);

  function resetForm() {
    setForm(initialForm);
    setEditingMemberId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!activeAdminProfile) { setError("Admin profile is required before managing members."); return; }
    if (!form.fullName.trim() || !form.joinDate.trim() || !form.email.trim()) {
      setError("Full name, join date, and email are required.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingMemberId) {
        const updated = await updateMember({
          groupId: activeAdminProfile.groupId,
          memberId: editingMemberId,
          fullName: form.fullName.trim(),
          joinDate: form.joinDate,
          email: form.email.trim(),
        });
        setMembers((c) =>
          c.map((m) => (m.id === updated.id ? updated : m)).sort((a, b) => a.fullName.localeCompare(b.fullName))
        );
      } else {
        const created = await createMember({
          groupId: activeAdminProfile.groupId,
          fullName: form.fullName.trim(),
          joinDate: form.joinDate,
          email: form.email.trim(),
        });
        setMembers((c) => [...c, created].sort((a, b) => a.fullName.localeCompare(b.fullName)));

        const emailResult = await sendWelcomeEmail(
          created.email,
          created.fullName,
          groupName || activeAdminProfile.groupId,
        );
        if (!emailResult.success) {
          setError(`Member saved, but welcome email failed: ${emailResult.error}`);
        }
      }
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save member.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(memberId: string) {
    if (!activeAdminProfile) return;
    setError(null);
    setIsRemoving(true);
    try {
      const memberToRemove = members.find(m => m.id === memberId);
      await deleteMember(activeAdminProfile.groupId, memberId);
      setMembers((c) => c.filter((m) => m.id !== memberId));
      if (editingMemberId === memberId) resetForm();

      if (memberToRemove && memberToRemove.email) {
        void sendRemovalEmail(
          memberToRemove.email,
          memberToRemove.fullName,
          groupName || activeAdminProfile.groupId
        ).then(result => {
          if (!result.success) {
            console.error("Failed to send removal email:", result.error);
          }
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove member.");
    } finally {
      setIsRemoving(false);
    }
  }

  function startEdit(member: Member) {
    setEditingMemberId(member.id);
    setForm({ fullName: member.fullName, joinDate: member.joinDate, email: member.email });
  }

  async function handleApproveRequest(req: JoinRequest) {
    if (!activeAdminProfile) return;
    setIsSubmitting(true);
    try {
      await approveJoinRequest(activeAdminProfile.groupId, req.id, req.fullName, req.email);
      setJoinRequests(c => c.filter(r => r.id !== req.id));
      const currentMembers = await listMembers(activeAdminProfile.groupId);
      setMembers(currentMembers);

      const emailResult = await sendWelcomeEmail(
        req.email,
        req.fullName,
        groupName || activeAdminProfile.groupId,
      );
      if (!emailResult.success) {
        setError(`Member approved, but welcome email failed: ${emailResult.error}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRejectRequest(req: JoinRequest) {
    if (!activeAdminProfile) return;
    try {
      await rejectJoinRequest(activeAdminProfile.groupId, req.id);
      setJoinRequests(c => c.filter(r => r.id !== req.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject request.");
    }
  }


  if (isLoading) {
    return <AdminLoadingState message={t("memberMgr.loadingList")} />;
  }

  return (
    <div className="mt-6 grid gap-4">
      {resolvedError && <p className="alert-error">{tx(resolvedError)}</p>}

      <form
        className="grid gap-4 rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-4 shadow-[var(--shadow-sm)]"
        onSubmit={handleSubmit}
      >
        <p className="admin-section-label">{editingMemberId ? t("memberMgr.editTitle") : t("memberMgr.addTitle")}</p>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium">
            {t("memberMgr.fullName")}
            <input
              className="input"
              onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))}
              placeholder="Md. Rahim"
              value={form.fullName}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("memberMgr.joinDate")}
            <input
              className="input"
              onChange={(e) => setForm((c) => ({ ...c, joinDate: e.target.value }))}
              placeholder={toDateInputValue(new Date())}
              type="date"
              value={form.joinDate}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("memberMgr.email")}
            <input
              className="input disabled:opacity-50"
              onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
              placeholder="user@example.com"
              type="email"
              value={form.email}
              disabled={!!editingMemberId}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="button-primary" disabled={!activeAdminProfile || isSubmitting} type="submit">
            {isSubmitting
              ? editingMemberId ? t("memberMgr.submittingUpdate") : t("memberMgr.submittingAdd")
              : editingMemberId ? t("memberMgr.submitUpdate") : t("memberMgr.submitAdd")}
          </button>
          {editingMemberId && (
            <button className="button-secondary" onClick={resetForm} type="button">
              {t("common.cancel")}
            </button>
          )}
        </div>
      </form>

      {visibleJoinRequests.length > 0 && (
        <div className="rounded-[var(--radius)] border-2 border-[color:var(--accent)] bg-[color:var(--panel)] p-4 shadow-[0_0_0_4px_var(--accent-dim)]">
          <p className="admin-section-label">Pending Join Requests</p>
          <div className="mt-4 grid gap-2.5">
            {visibleJoinRequests.map((req) => (
              <article
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{req.fullName}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--muted)]">{req.email}</p>
                </div>
                <div className="flex gap-2">
                  <button className="button-primary" onClick={() => void handleApproveRequest(req)} type="button">
                    Approve
                  </button>
                  <button className="button-danger" onClick={() => void handleRejectRequest(req)} type="button">
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-4 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="admin-section-label">{t("memberMgr.listTitle")}</p>
            <p className="mt-1.5 text-lg font-semibold">
              {t("memberMgr.listSummary", {
                shown: String(filteredMembers.length),
                total: String(visibleMembers.length),
              })}
            </p>
          </div>
          <input
            className="input w-full sm:w-64"
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("memberMgr.searchPlaceholder")}
            value={search}
          />
        </div>

        <div className="mt-4 grid gap-2.5">
          {visibleMembers.length === 0 ? (
            <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">
              {t("admin.noMembersYet")}
            </p>
          ) : filteredMembers.length ? (
            filteredMembers.map((member) => (
              <article
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{member.fullName}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                    {t("memberMgr.joinedLine")} {member.joinDate} · {member.email}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="button-secondary" onClick={() => startEdit(member)} type="button">
                    {t("memberMgr.edit")}
                  </button>
                  <button className="button-danger" onClick={() => void handleDelete(member.id)} type="button">
                    {t("memberMgr.remove")}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">
              {t("memberMgr.noSearchMatch")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
