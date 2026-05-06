"use client";

import { FormEvent, useMemo, useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import {
  buildAdminProfile,
  buildGroupRecord,
  buildNoticeRecord,
} from "@/lib/firebase/factories";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { groupsCollection, adminsCollection, noticesCollection } from "@/lib/firebase/paths";
import { generateGroupToken, slugifyGroupName } from "@/lib/utils/group-token";

type FormState = {
  groupName: string;
  email: string;
  password: string;
};

const initialState: FormState = {
  groupName: "",
  email: "",
  password: "",
};

export function RegisterGroupForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const previewToken = useMemo(() => {
    if (!form.groupName.trim()) {
      return "MEAT-XXXXXX";
    }

    return `${slugifyGroupName(form.groupName)}-XXXXXX`;
  }, [form.groupName]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCreatedToken(null);

    if (!auth || !db || !isFirebaseConfigured) {
      setError("Firebase is not configured yet. Add your keys in .env.local first.");
      return;
    }

    setIsSubmitting(true);

    try {
      const credentials = await createUserWithEmailAndPassword(
        auth,
        form.email.trim(),
        form.password,
      );

      const adminId = credentials.user.uid;
      const groupId = crypto.randomUUID();
      const groupToken = generateGroupToken(form.groupName);

      await setDoc(doc(db, groupsCollection, groupId), {
        ...buildGroupRecord({
          id: groupId,
          name: form.groupName.trim(),
          token: groupToken,
          adminId,
        }),
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, adminsCollection, adminId), {
        ...buildAdminProfile({
          id: adminId,
          email: form.email.trim(),
          groupId,
        }),
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, noticesCollection(groupId), crypto.randomUUID()), {
        ...buildNoticeRecord({
          title: "Group created",
          body: `${form.groupName.trim()} was registered and is ready to use.`,
          systemGenerated: true,
        }),
        createdAt: serverTimestamp(),
      });

      setCreatedToken(groupToken);
      setForm(initialState);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Failed to register the group.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-[color:var(--foreground)]">
          Group name
          <input
            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
            onChange={(event) =>
              setForm((current) => ({ ...current, groupName: event.target.value }))
            }
            placeholder="Star Hostel"
            required
            value={form.groupName}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-[color:var(--foreground)]">
          Email
          <input
            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            placeholder="admin@example.com"
            required
            type="email"
            value={form.email}
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium text-[color:var(--foreground)]">
        Password
        <input
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
          minLength={6}
          onChange={(event) =>
            setForm((current) => ({ ...current, password: event.target.value }))
          }
          placeholder="At least 6 characters"
          required
          type="password"
          value={form.password}
        />
      </label>

      <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Token preview
        </p>
        <p className="mt-2 font-mono text-lg text-[color:var(--foreground)]">
          {previewToken}
        </p>
        <p className="mt-2 text-sm text-[color:var(--soft-foreground)]">
          The final token is generated after successful registration and should be shared with all group members.
        </p>
      </div>

      {!isFirebaseConfigured ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Firebase keys are missing. Add them in <span className="font-mono">.env.local</span> before submitting this form.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {createdToken ? (
        <div className="rounded-[1.5rem] border border-emerald-300 bg-emerald-50 px-4 py-4 text-emerald-900">
          <p className="text-sm font-semibold">Group created successfully.</p>
          <p className="mt-2 text-sm">
            Generated token: <span className="font-mono">{createdToken}</span>
          </p>
        </div>
      ) : null}

      <button
        className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting || !isFirebaseConfigured}
        type="submit"
      >
        {isSubmitting ? "Creating group..." : "Create group and token"}
      </button>
    </form>
  );
}
