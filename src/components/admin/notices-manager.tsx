"use client";

import { FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useT } from "@/i18n/use-t";
import {
  createNotice,
  deleteNotice,
  listCharts,
  listNoticesForChart,
  updateNotice,
} from "@/lib/firebase/repositories";
import { getAdminProfileForUser } from "@/lib/auth/sign-in-routing";
import type { AdminProfile, Chart, Notice } from "@/types/domain";

export function NoticesManager() {
  const { t, tx, language } = useT();
  const locale = language === "bn" ? "bn-BD" : undefined;
  const configError = !isFirebaseConfigured || !auth ? "Firebase is not configured yet." : null;

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [error, setError] = useState<string | null>(configError);
  const [isLoading, setIsLoading] = useState(!configError);

  const [selectedChart, setSelectedChart] = useState<Chart | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (configError || !auth) return;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setError("Log in as admin to manage notices."); setIsLoading(false); return; }
      try {
        const profile = await getAdminProfileForUser(user);
        if (!profile) throw new Error("No admin profile found.");
        const currentCharts = await listCharts(profile.groupId);
        setAdminProfile(profile);
        setCharts(currentCharts);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data.");
      } finally { setIsLoading(false); }
    });
    return unsub;
  }, [configError]);

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
    if (!title.trim() || !body.trim()) { setError("Title and body are required."); return; }
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
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save notice.");
    } finally { setIsSubmitting(false); }
  }

  async function handleDelete(noticeId: string) {
    if (!adminProfile || !selectedChart) return;
    if (selectedChart.locked) { setError(t("noticeMgr.monthLocked")); return; }
    try {
      await deleteNotice(adminProfile.groupId, selectedChart.id, noticeId);
      setNotices((prev) => prev.filter((n) => n.id !== noticeId));
      if (editingId === noticeId) cancelEdit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete notice.");
    }
  }

  if (isLoading) return <p className="mt-8 text-sm text-[color:var(--soft-foreground)]">{t("common.loading")}</p>;

  if (!selectedChart) {
    return (
      <div className="mt-6 grid gap-5">
        {error && <p className="alert-error">{tx(error)}</p>}

        <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)]">
          <p className="admin-section-label">{t("admin.selectMonth")}</p>
          <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">
            Select a month to manage notices for that period.
          </p>
          {charts.length === 0 ? (
            <p className="mt-4 py-6 text-center text-sm text-[color:var(--soft-foreground)]">
              {t("admin.noChartsMeals")}
            </p>
          ) : (
            <div className="mt-4 grid gap-2">
              {charts.map((chart, i) => (
                <button
                  key={chart.id}
                  type="button"
                  onClick={() => setSelectedChart(chart)}
                  className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3.5 text-left transition hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-dim)]"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{chart.label}</p>
                      {i === 0 && <span className="badge-accent">{t("common.active")}</span>}
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
    <div className="mt-6 grid gap-5">
      {error && <p className="alert-error">{tx(error)}</p>}

      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3">
        <div>
          <p className="admin-section-label">Notices</p>
          <p className="mt-0.5 font-semibold">{selectedChart.label}</p>
          {selectedChart.locked && (
            <p className="mt-1 text-xs font-semibold text-[color:var(--danger)]">{t("noticeMgr.monthLocked")}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setSelectedChart(null); setNotices([]); cancelEdit(); }}
          className="button-secondary shrink-0"
        >
          {t("costs.backMonths")}
        </button>
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
        <div className="flex gap-3">
          <button className="button-primary" disabled={!adminProfile || isSubmitting || selectedChart.locked} type="submit">
            {isSubmitting ? t("admin.saving") : editingId ? t("common.update") : t("noticeMgr.submitAdd")}
          </button>
          {editingId && (
            <button className="button-secondary" type="button" onClick={cancelEdit}>{t("common.cancel")}</button>
          )}
        </div>
      </form>

      <div className="grid gap-3">
        {noticesLoading && (
          <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">{t("common.loading")}</p>
        )}
        {!noticesLoading && notices.length === 0 && (
          <p className="py-4 text-center text-sm text-[color:var(--soft-foreground)]">{t("noticeMgr.empty")}</p>
        )}
        {notices.map((notice) => (
          <div
            key={notice.id}
            className="rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--panel)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{notice.title}</p>
                  {notice.systemGenerated && (
                    <span className="badge-accent">{t("common.auto")}</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{notice.body}</p>
                <p className="mt-1.5 text-xs text-[color:var(--muted)]">
                  {new Date(notice.createdAt).toLocaleString(locale)}
                </p>
              </div>
              {!notice.systemGenerated && (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => startEdit(notice)}
                    type="button"
                    disabled={selectedChart.locked}
                    className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:var(--soft-foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:opacity-50"
                  >
                    {t("memberMgr.edit")}
                  </button>
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
  );
}
