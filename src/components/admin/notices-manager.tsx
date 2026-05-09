"use client";

import { FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useT } from "@/i18n/use-t";
import { createNotice, deleteNotice, getAdminProfile, listNotices, updateNotice } from "@/lib/firebase/repositories";
import type { AdminProfile, Notice } from "@/types/domain";

export function NoticesManager() {
  const { t, tx, language } = useT();
  const locale = language === "bn" ? "bn-BD" : undefined;
  const configError = !isFirebaseConfigured || !auth ? "Firebase is not configured yet." : null;

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(configError);
  const [isLoading, setIsLoading] = useState(!configError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (configError || !auth) return;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setError("Log in as admin to manage notices."); setIsLoading(false); return; }
      try {
        const profile = await getAdminProfile(user.uid);
        if (!profile) throw new Error("No admin profile found.");
        const list = await listNotices(profile.groupId);
        setAdminProfile(profile);
        setNotices(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load notices.");
      } finally { setIsLoading(false); }
    });
    return unsub;
  }, [configError]);

  function startEdit(notice: Notice) {
    setEditingId(notice.id);
    setTitle(notice.title);
    setBody(notice.body);
  }

  function cancelEdit() {
    setEditingId(null); setTitle(""); setBody("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!adminProfile) return;
    if (!title.trim() || !body.trim()) { setError("Title and body are required."); return; }
    setError(null); setIsSubmitting(true);
    try {
      if (editingId) {
        await updateNotice({ groupId: adminProfile.groupId, noticeId: editingId, title: title.trim(), body: body.trim() });
        setNotices((prev) => prev.map((n) => n.id === editingId ? { ...n, title: title.trim(), body: body.trim() } : n));
        cancelEdit();
      } else {
        const created = await createNotice({ groupId: adminProfile.groupId, title: title.trim(), body: body.trim() });
        setNotices((prev) => [created, ...prev]);
        setTitle(""); setBody("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save notice.");
    } finally { setIsSubmitting(false); }
  }

  async function handleDelete(noticeId: string) {
    if (!adminProfile) return;
    try {
      await deleteNotice(adminProfile.groupId, noticeId);
      setNotices((prev) => prev.filter((n) => n.id !== noticeId));
      if (editingId === noticeId) cancelEdit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete notice.");
    }
  }

  if (isLoading) return <p className="mt-8 text-sm text-[color:var(--soft-foreground)]">{t("common.loading")}</p>;

  return (
    <div className="mt-6 grid gap-5">
      {error && <p className="alert-error">{tx(error)}</p>}

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
          <button className="button-primary" disabled={!adminProfile || isSubmitting} type="submit">
            {isSubmitting ? t("admin.saving") : editingId ? t("common.update") : t("noticeMgr.submitAdd")}
          </button>
          {editingId && (
            <button className="button-secondary" type="button" onClick={cancelEdit}>{t("common.cancel")}</button>
          )}
        </div>
      </form>

      <div className="grid gap-3">
        {notices.length === 0 && (
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
                    className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:var(--soft-foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                  >
                    {t("memberMgr.edit")}
                  </button>
                  <button
                    onClick={() => void handleDelete(notice.id)}
                    type="button"
                    className="rounded-full border border-[color:var(--danger-border)] px-3 py-1 text-xs font-semibold text-[color:var(--danger)] transition hover:bg-[color:var(--danger)] hover:text-white"
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
