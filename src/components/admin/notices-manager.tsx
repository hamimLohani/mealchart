"use client";

import { FormEvent, useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useT } from "@/i18n/use-t";
import {
  createNotice,
  deleteNotice,
  listCharts,
  listNoticesForChart,
  updateNotice,
  listMembers,
  getMealsForChart,
  listCostsForChart,
  listDepositsForChart,
  getGroupById,
  getGroupWhatsappConfig,
} from "@/lib/firebase/repositories";
import { currentMonthKey, pickCurrentMonthChart } from "@/lib/utils/date";
import type { AdminProfile, Chart, Group, Notice, WhatsappConfig } from "@/types/domain";
import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import { AdminLoadingState } from "@/components/admin/admin-loading-state";
import { useCurrentAdminProfile } from "@/lib/hooks/use-current-admin-profile";
import { sendReminderEmails } from "@/lib/email/actions";
import { getFriendlyEmailError } from "@/lib/utils/email-error";
import { useToast } from "@/lib/hooks/use-toast";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { WhatsAppSettings } from "@/components/admin/whatsapp-settings";

export function NoticesManager() {
  const { t, tx, language } = useT();
  const { success: showSuccess, error: showError } = useToast();
  const locale = language === "bn" ? "bn-BD" : undefined;
  const configError = !isFirebaseConfigured || !auth ? "Firebase is not configured yet." : null;

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsappConfig | null>(null);
  const [groupName, setGroupName] = useState("");
  const [charts, setCharts] = useState<Chart[]>([]);
  const [error, setError] = useState<string | null>(configError);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [isSendingWA, setIsSendingWA] = useState<string | null>(null); // holds noticeId being sent

  const [selectedChart, setSelectedChart] = useState<Chart | null>(null);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { adminProfile: currentAdminProfile, isLoading: profileLoading, error: profileError } = useCurrentAdminProfile();
  const resolvedError =
    error ??
    (profileError
      ? profileError instanceof Error
        ? profileError.message
        : "Failed to load data."
      : !profileLoading && !currentAdminProfile && !configError
        ? "Log in as admin to manage notices."
        : null);

  function formatNoticeDate(createdAt: unknown) {
    if (!createdAt) return "";
    try {
      // Handle Firebase Timestamp
      if (
        typeof createdAt === "object" &&
        createdAt !== null &&
        "toDate" in createdAt &&
        typeof (createdAt as { toDate?: unknown }).toDate === "function"
      ) {
        return (createdAt as { toDate: () => Date }).toDate().toLocaleString(locale);
      }
      // Handle numeric timestamp (seconds/ms)
      if (typeof createdAt === "number") {
        return new Date(createdAt).toLocaleString(locale);
      }
      // Handle ISO string or date object
      if (typeof createdAt === "string" || createdAt instanceof Date) {
        return new Date(createdAt).toLocaleString(locale);
      }
      return "";
    } catch {
      return "";
    }
  }

  useGlobalLoading(
    "notices-manager",
    isLoading || profileLoading || noticesLoading || isSubmitting || isSendingReminders,
    isLoading ? t("common.loading") : isSubmitting ? t("admin.saving") : isSendingReminders ? t("notices.sendingReminders") : t("common.loading"),
  );

  useEffect(() => {
    if (configError || !auth) return;
    if (profileLoading) return;
    if (profileError) return;
    if (!currentAdminProfile) return;
    let active = true;
    void (async () => {
      try {
        if (!active) return;
        setIsLoading(true);
        const [currentCharts, g, wConfig] = await Promise.all([
          listCharts(currentAdminProfile.groupId),
          getGroupById(currentAdminProfile.groupId),
          getGroupWhatsappConfig(currentAdminProfile.groupId),
        ]);
        if (!active) return;
        setAdminProfile(currentAdminProfile);
        setWhatsappConfig(wConfig);
        setGroupName(g?.name ?? "");
        setCharts(currentCharts);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load data.");
      } finally { if (active) setIsLoading(false); }
    })();
    return () => { active = false; };
  }, [configError, currentAdminProfile, profileError, profileLoading]);

  useEffect(() => {
    if (selectedChart || isMonthPickerOpen || charts.length === 0) return;
    let active = true;
    const nextChart = pickCurrentMonthChart(charts);
    setTimeout(() => {
      if (active) setSelectedChart(nextChart);
    }, 0);
    return () => {
      active = false;
    };
  }, [charts, isMonthPickerOpen, selectedChart]);

  useEffect(() => {
    if (!adminProfile || !selectedChart) return;
    let active = true;

    const fetchNotices = async () => {
      setNoticesLoading(true);
      setNotices([]);
      try {
        const list = await listNoticesForChart(adminProfile.groupId, selectedChart.id);
        if (active) setNotices(list);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load notices.");
      } finally {
        if (active) setNoticesLoading(false);
      }
    };

    void fetchNotices();

    return () => { active = false; };
  }, [adminProfile, selectedChart]);

  function startEdit(notice: Notice) {
    if (selectedChart?.locked) return;
    setEditingId(notice.id);
    setTitle(notice.title);
    setBody(notice.body);
  }

  function cancelEdit() {
    setEditingId(null); setTitle(""); setBody("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!adminProfile || !selectedChart) return;
    if (selectedChart.locked) { setError(t("noticeMgr.monthLocked")); return; }
    if (!title.trim() || !body.trim()) { setError(t("errors.noticeFieldsRequired")); return; }
    setError(null); setIsSubmitting(true);
    try {
      if (editingId) {
        await updateNotice({
          groupId: adminProfile.groupId,
          chartId: selectedChart.id,
          noticeId: editingId,
          title: title.trim(),
          body: body.trim(),
        });
        setNotices((prev) => prev.map((n) => n.id === editingId ? { ...n, title: title.trim(), body: body.trim() } : n));
        cancelEdit();
      } else {
        const created = await createNotice({
          groupId: adminProfile.groupId,
          chartId: selectedChart.id,
          title: title.trim(),
          body: body.trim(),
        });
        setNotices((prev) => {
          if (prev.some((n) => n.id === created.id)) return prev;
          return [created, ...prev];
        });
        setTitle(""); setBody("");

        // Auto-send to WhatsApp if integration is configured & enabled
        if (whatsappConfig?.whatsappEnabled) {
          void sendNoticeToWhatsApp(
            whatsappConfig,
            title.trim(),
            body.trim(),
            null,  // no noticeId spinner needed for auto-send
            true,  // isAutoSend — show auto-sent toast
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.saveNoticeFailed"));
    } finally { setIsSubmitting(false); }
  }

  async function sendNoticeToWhatsApp(
    config: WhatsappConfig,
    noticeTitle: string,
    noticeBody: string,
    noticeId: string | null,
    isAutoSend = false,
  ) {
    if (noticeId) setIsSendingWA(noticeId);
    try {
      const { sendWhatsAppNoticeAction } = await import("@/lib/whatsapp/actions");
      const data = await sendWhatsAppNoticeAction(config, noticeTitle, noticeBody);
      if (data.success) {
        showSuccess(isAutoSend ? t("whatsapp.autoSent") : t("whatsapp.sendSuccess"));
      } else {
        showError(data.error ?? t("whatsapp.testError"));
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : t("whatsapp.testError"));
    } finally {
      if (noticeId) setIsSendingWA(null);
    }
  }

  async function handleDelete(noticeId: string) {
    if (!adminProfile || !selectedChart) return;
    if (selectedChart.locked) { setError(t("noticeMgr.monthLocked")); return; }
    try {
      await deleteNotice(adminProfile.groupId, selectedChart.id, noticeId);
      setNotices((prev) => prev.filter((n) => n.id !== noticeId));
      if (editingId === noticeId) cancelEdit();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.deleteNoticeFailed"));
    }
  }

  function handleSendReminders() {
    setShowSendConfirm(true);
  }

  async function actuallySendReminders() {
    if (!adminProfile || !selectedChart) return;
    setIsSendingReminders(true);
    setError(null);
    try {
      const [members, meals, costs, deposits] = await Promise.all([
        listMembers(adminProfile.groupId),
        getMealsForChart(adminProfile.groupId, selectedChart),
        listCostsForChart(adminProfile.groupId, selectedChart.id),
        listDepositsForChart(adminProfile.groupId, selectedChart.id),
      ]);

      const emailResult = await sendReminderEmails({
        groupName,
        chartLabel: selectedChart.label,
        members,
        meals,
        costs,
        deposits,
      });

      if (!emailResult.success) {
        const friendlyError = getFriendlyEmailError(emailResult.error || "");
        setError(friendlyError);
        showError(friendlyError);
      } else if (emailResult.failedCount && emailResult.failedCount > 0) {
        const statusMsg = `Sent ${emailResult.sentCount} reminders, ${emailResult.failedCount} failed.`;
        setError(statusMsg);
        showError(statusMsg);
      } else {
        showSuccess(`Sent ${emailResult.sentCount} reminder emails!`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send reminders.";
      setError(msg);
      showError(msg);
    } finally {
      setIsSendingReminders(false);
      setShowSendConfirm(false);
    }
  }

  if (isLoading) return <AdminLoadingState message={t("common.loading")} />;

  if (!selectedChart) {
    return (
      <div className="mt-6 grid gap-5">
        {resolvedError && <p className="alert-error">{tx(resolvedError)}</p>}

        <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]">
          <p className="admin-section-label">{t("admin.selectMonth")}</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
            {t("notices.selectHelp")}
          </p>
          {charts.length === 0 ? (
            <p className="mt-4 py-6 text-center text-sm font-bold text-[color:var(--danger)]">
              {t("admin.noChartsMeals")}
            </p>
          ) : (
            <div className="mt-4 grid gap-2">
              {charts.map((chart) => (
                <button
                  key={chart.id}
                  type="button"
                  onClick={() => {
                    setIsMonthPickerOpen(false);
                    setSelectedChart(chart);
                  }}
                  className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3.5 text-left transition hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-dim)]"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{chart.label}</p>
                      {chart.monthKey === currentMonthKey() && <span className="badge-accent">{t("common.active")}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-[color:var(--muted)]">{chart.monthKey}</p>
                  </div>
                  <span className="text-[color:var(--accent)]">→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 grid gap-5">
        {resolvedError && <p className="alert-error">{tx(resolvedError)}</p>}

        {/* WhatsApp Integration Settings */}
        {adminProfile && (
          <WhatsAppSettings groupId={adminProfile.groupId} />
        )}

        <div className="flex flex-col gap-3 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="admin-section-label">{t("adminNav.notices")}</p>
            <p className="mt-0.5 font-semibold">{selectedChart.label}</p>
            {selectedChart.locked && (
              <p className="mt-1 text-xs font-semibold text-[color:var(--danger)]">{t("noticeMgr.monthLocked")}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
            <button
              type="button"
              onClick={handleSendReminders}
              disabled={isSendingReminders}
              className="button-primary w-full sm:w-auto"
            >
              {isSendingReminders ? t("notices.sendingReminders") : t("notices.sendReminders")}
            </button>
            <button
              type="button"
              onClick={() => { setIsMonthPickerOpen(true); setSelectedChart(null); setNotices([]); cancelEdit(); }}
              className="button-secondary w-full sm:w-auto"
            >
              {t("costs.backMonths")}
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-4 rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]"
        >
          <p className="admin-section-label">{editingId ? t("noticeMgr.editFormTitle") : t("noticeMgr.addFormTitle")}</p>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("admin.noticeTitle")}
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("noticeMgr.placeholderTitle")} required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("admin.noticeBody")}
            <textarea className="input min-h-[80px] resize-y" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("noticeMgr.placeholderBody")} required />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <button className="button-primary w-full sm:w-auto" disabled={!adminProfile || isSubmitting || selectedChart.locked} type="submit">
              {isSubmitting ? t("admin.saving") : editingId ? t("common.update") : t("noticeMgr.submitAdd")}
            </button>
            {editingId && (
              <button className="button-secondary w-full sm:w-auto" type="button" onClick={cancelEdit}>{t("common.cancel")}</button>
            )}
          </div>
        </form>

        <div className="grid gap-3">
          {noticesLoading && (
            <AdminLoadingState compact message={t("common.loading")} />
          )}
          {!noticesLoading && notices.length === 0 && (
            <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">{t("noticeMgr.empty")}</p>
          )}
          {notices.map((notice) => (
            <div
              key={notice.id}
              className="rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--panel)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[color:var(--foreground)]">{tx(notice.title)}</p>
                    {notice.systemGenerated && (
                      <span className="badge-accent">{t("common.auto")}</span>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--soft-foreground)]">
                    {tx(notice.body)}
                  </p>
                  <p className="mt-1.5 text-xs text-[color:var(--muted)]">
                    {formatNoticeDate(notice.createdAt)}
                  </p>
                </div>
                {!notice.systemGenerated && (
                  <div className="mt-2 flex w-full flex-col gap-2 sm:mt-0 sm:w-auto sm:flex-row sm:shrink-0">
                    <button
                      onClick={() => startEdit(notice)}
                      type="button"
                      disabled={selectedChart.locked}
                      className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:var(--soft-foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:opacity-50"
                    >
                      {t("memberMgr.edit")}
                    </button>
                    {whatsappConfig?.whatsappEnabled && (
                      <button
                        type="button"
                        disabled={isSendingWA === notice.id}
                        onClick={() =>
                          void sendNoticeToWhatsApp(
                            whatsappConfig,
                            notice.title,
                            notice.body,
                            notice.id,
                          )
                        }
                        className="rounded-full border border-[color:var(--accent-border,var(--accent))] px-3 py-1 text-xs font-semibold text-[color:var(--accent)] transition hover:bg-[color:var(--accent)] hover:text-white disabled:opacity-50"
                      >
                        {isSendingWA === notice.id
                          ? t("whatsapp.sendingNotice")
                          : t("whatsapp.resend")}
                      </button>
                    )}
                    <button
                      onClick={() => void handleDelete(notice.id)}
                      type="button"
                      disabled={selectedChart.locked}
                      className="rounded-full border border-[color:var(--danger-border)] px-3 py-1 text-xs font-semibold text-[color:var(--danger)] transition hover:bg-[color:var(--danger)] hover:text-white disabled:opacity-50"
                    >
                      {t("admin.delete")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {showSendConfirm && (
        <ConfirmModal
          open={showSendConfirm}
          title={t("notices.confirmSendTitle")}
          description={t("notices.confirmSendDescription")}
          confirmLabel={t("notices.sendReminders")}
          cancelLabel={t("common.cancel")}
          isProcessing={isSendingReminders}
          processingLabel={t("notices.sendingReminders")}
          onCancel={() => setShowSendConfirm(false)}
          onConfirm={async () => {
            await actuallySendReminders();
          }}
        />
      )}
    </>
  );
}
