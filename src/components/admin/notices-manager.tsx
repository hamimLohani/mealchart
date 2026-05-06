"use client";

import { FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { createNotice, deleteNotice, getAdminProfile, listNotices, updateNotice } from "@/lib/firebase/repositories";
import type { AdminProfile, Notice } from "@/types/domain";

export function NoticesManager() {
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

  if (isLoading) return <p className="mt-8 text-sm text-[color:var(--soft-foreground)]">Loading…</p>;

  return (
    <div className="mt-6 grid gap-5">
      {error && <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* Form */}
      <form onSubmit={handleSubmit} className="grid gap-4 rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {editingId ? "Edit Notice" : "Add Notice"}
        </p>
        <label className="grid gap-1.5 text-sm font-medium">
          Title
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notice title" required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Body
          <textarea className="input min-h-[80px] resize-y" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Notice details…" required />
        </label>
        <div className="flex gap-3">
          <button className="button-primary disabled:opacity-60" disabled={!adminProfile || isSubmitting} type="submit">
            {isSubmitting ? "Saving…" : editingId ? "Update" : "Add notice"}
          </button>
          {editingId && <button className="button-secondary" type="button" onClick={cancelEdit}>Cancel</button>}
        </div>
      </form>

      {/* List */}
      <div className="grid gap-3">
        {notices.length === 0 && <p className="text-sm text-[color:var(--soft-foreground)]">No notices yet.</p>}
        {notices.map((notice) => (
          <div key={notice.id} className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{notice.title}</p>
                  {notice.systemGenerated && (
                    <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[color:var(--accent)]">auto</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-[color:var(--soft-foreground)]">{notice.body}</p>
                <p className="mt-1.5 text-xs text-[color:var(--muted)]">{new Date(notice.createdAt).toLocaleString()}</p>
              </div>
              {!notice.systemGenerated && (
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => startEdit(notice)} type="button" className="text-xs text-[color:var(--accent)] hover:underline">Edit</button>
                  <button onClick={() => void handleDelete(notice.id)} type="button" className="text-xs text-red-500 hover:underline">Delete</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
