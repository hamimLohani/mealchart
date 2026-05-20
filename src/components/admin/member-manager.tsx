"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useT } from "@/i18n/use-t";
import { createMember, deleteMember, listMembers, updateMember, listJoinRequests, approveJoinRequest, rejectJoinRequest, getGroupById } from "@/lib/firebase/repositories";
import { toDateInputValue } from "@/lib/utils/date";
import type { AdminProfile, Member, JoinRequest } from "@/types/domain";
import { sendWelcomeEmail, sendRemovalEmail, verifyEmailExistence } from "@/lib/email/actions";
import { getFriendlyEmailError } from "@/lib/utils/email-error";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import { AdminLoadingState } from "@/components/admin/admin-loading-state";
import { useCurrentAdminProfile } from "@/lib/hooks/use-current-admin-profile";
import { useToast } from "@/lib/hooks/use-toast";

type MemberFormState = { fullName: string; joinDate: string; email: string };
const initialForm: MemberFormState = {
  fullName: "",
  joinDate: toDateInputValue(new Date()),
  email: "",
};

export function MemberManager() {
  const { t, tx } = useT();
  const { success: showSuccess, error: showError } = useToast();
  const paymentPhone = process.env.NEXT_PUBLIC_PAYMENT_PHONE || "01xxxxxxxxx";
  const configurationError =
    !isFirebaseConfigured || !auth
      ? "Firebase is not configured yet. Add your keys in .env.local first."
      : null;

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [paidMemberSlots, setPaidMemberSlots] = useState(0);
  const [totalMembersCreated, setTotalMembersCreated] = useState(0);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [form, setForm] = useState<MemberFormState>(initialForm);
  const [search, setSearch] = useState("");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(configurationError);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [copiedGroupId, setCopiedGroupId] = useState(false);
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
        setPaidMemberSlots(group?.paidMemberSlots ?? 0);
        setTotalMembersCreated(group?.totalMembersCreated ?? 0);
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
      // --- Email Existence Check (Option 3) ---
      const verification = await verifyEmailExistence(form.email.trim());
      if (!verification.exists) {
        const errorKey = verification.error === "The email domain does not exist." 
          ? "errors.emailDomainNotExist" 
          : "errors.emailNotExist";
          
        setError(`ERR_TRANS:${JSON.stringify({ 
          key: "errors.emailValidationFailed", 
          vars: { error: t(errorKey as any) } 
        })}`);
        setIsSubmitting(false);
        return;
      }
      // ---------------------------------------

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
        showSuccess(t("toast.memberUpdated"));
      } else {
        const created = await createMember({
          groupId: activeAdminProfile.groupId,
          fullName: form.fullName.trim(),
          joinDate: form.joinDate,
          email: form.email.trim(),
        });
        setMembers((c) => [...c, created].sort((a, b) => a.fullName.localeCompare(b.fullName)));
        showSuccess(t("toast.memberAdded"));
        
        // Update slots
       const group = await getGroupById(activeAdminProfile.groupId);
       setPaidMemberSlots(group?.paidMemberSlots ?? 0);
       setTotalMembersCreated(group?.totalMembersCreated ?? 0);

        const emailResult = await sendWelcomeEmail(
          created.email,
          created.fullName,
          groupName || activeAdminProfile.groupId,
        );
        if (!emailResult.success) {
          const friendlyError = getFriendlyEmailError(emailResult.error || "");
          setError(`ERR_TRANS:${JSON.stringify({ 
            key: "errors.emailWelcomeFailed", 
            vars: { error: friendlyError } 
          })}`);
        }
      }
      resetForm();
    } catch (e) {
      if (e instanceof Error && e.message === "LIMIT_REACHED_MEMBER") {
        setError("LIMIT_REACHED_MEMBER");
      } else {
        setError(e instanceof Error ? e.message : "Failed to save member.");
      }
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
      showSuccess(t("toast.memberRemoved"));

      if (memberToRemove && memberToRemove.email) {
        const emailResult = await sendRemovalEmail(
          memberToRemove.email,
          memberToRemove.fullName,
          groupName || activeAdminProfile.groupId
        );
        if (!emailResult.success) {
           const friendlyError = getFriendlyEmailError(emailResult.error || "");
           setError(`ERR_TRANS:${JSON.stringify({ 
             key: "errors.emailRemovalFailed", 
             vars: { error: friendlyError } 
           })}`);
         }
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

  async function handleCopyGroupId() {
    if (!activeAdminProfile?.groupId) return;
    try {
      await navigator.clipboard.writeText(activeAdminProfile.groupId);
      setCopiedGroupId(true);
      setTimeout(() => setCopiedGroupId(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  async function handleApproveRequest(req: JoinRequest) {
    if (!activeAdminProfile) return;
    setIsSubmitting(true);
    try {
      // --- Email Existence Check (Option 3) ---
      const verification = await verifyEmailExistence(req.email.trim());
      if (!verification.exists) {
        const errorKey = verification.error === "The email domain does not exist." 
          ? "errors.emailDomainNotExist" 
          : "errors.emailNotExist";

        setError(`ERR_TRANS:${JSON.stringify({ 
          key: "errors.cannotApprove", 
          vars: { error: t(errorKey as any) } 
        })}`);
        setIsSubmitting(false);
        return;
      }
      // ---------------------------------------

      await approveJoinRequest(activeAdminProfile.groupId, req.id, req.fullName, req.email);
      setJoinRequests(c => c.filter(r => r.id !== req.id));
      const currentMembers = await listMembers(activeAdminProfile.groupId);
      setMembers(currentMembers);
      showSuccess(t("toast.memberAdded"));

      // Update slots
      const group = await getGroupById(activeAdminProfile.groupId);
      setPaidMemberSlots(group?.paidMemberSlots ?? 0);
      setTotalMembersCreated(group?.totalMembersCreated ?? 0);

      const emailResult = await sendWelcomeEmail(
        req.email,
        req.fullName,
        groupName || activeAdminProfile.groupId,
      );
      if (!emailResult.success) {
        const friendlyError = getFriendlyEmailError(emailResult.error || "");
        setError(`ERR_TRANS:${JSON.stringify({ 
          key: "errors.emailApprovalFailed", 
          vars: { error: friendlyError } 
        })}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message === "LIMIT_REACHED_MEMBER") {
        setError("LIMIT_REACHED_MEMBER");
      } else {
        setError(e instanceof Error ? e.message : "Failed to approve request.");
      }
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
      {resolvedError && (
        <div className={resolvedError === "LIMIT_REACHED_MEMBER" ? "alert-warning" : "alert-error"}>
          {resolvedError === "LIMIT_REACHED_MEMBER" ? (
            <div className="flex flex-col gap-2">
              <p className="font-bold">{t("usage.memberStatus")}</p>
              <p className="font-bold text-[color:var(--danger)]">
                {t("errors.limitReachedMember", { 
                  phone: paymentPhone, 
                  groupId: activeAdminProfile?.groupId || "",
                  groupName 
                })}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--panel-solid)] px-3 py-1 shadow-sm">
                  <span className="text-[0.6rem] font-bold uppercase tracking-wider text-[color:var(--muted)]">Ref:</span>
                  <code className="text-xs font-mono font-bold text-[color:var(--foreground)]">{activeAdminProfile?.groupId}</code>
                </div>
                <button
                  type="button"
                  onClick={handleCopyGroupId}
                  className={`button-secondary !py-1 !px-3 text-xs transition-all duration-200 ${copiedGroupId ? '!border-[color:var(--success-border)] !bg-[color:var(--success-bg)] !text-[color:var(--success-text)]' : ''}`}
                >
                  {copiedGroupId ? (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      {t("common.copied")}
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0c0 .414-.336.75-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                      </svg>
                      {t("common.copy")}
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            tx(resolvedError)
          )}
        </div>
      )}

      <div className="rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] p-4">
        <div className="flex items-center justify-between">
          <p className="admin-section-label">{t("usage.memberStatus")}</p>
          <span className="text-xs font-medium bg-[color:var(--accent)] text-white px-2 py-1 rounded-full">
            {t("usage.paidSlots", { n: String(paidMemberSlots) })}
          </span>
        </div>
        <p className="mt-2 text-sm text-[color:var(--soft-foreground)]">
          {t("usage.freeLimitMember", { used: String(Math.min(totalMembersCreated, 4)) })}
          {totalMembersCreated > 4 && t("usage.paidMembers", { n: String(totalMembersCreated - 4) })}
        </p>
      </div>

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
          <p className="admin-section-label">{t("memberMgr.pendingRequests")}</p>
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
                    {t("memberMgr.approve")}
                  </button>
                  <button className="button-danger" onClick={() => void handleRejectRequest(req)} type="button">
                    {t("memberMgr.reject")}
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
