"use client";

import React from "react";
import { useT } from "@/i18n/use-t";

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isProcessing = false,
  processingLabel,
}: {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
  processingLabel?: string;
}) {
  const { t } = useT();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-lg bg-[color:var(--panel)] p-6 shadow-lg">
        <h3 className="mb-2 text-lg font-semibold text-[color:var(--foreground)]">{title ?? t("common.confirm")}</h3>
        {description && <p className="mb-4 text-sm text-[color:var(--muted)]">{description}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={isProcessing}>
            {cancelLabel ?? t("common.cancel")}
          </button>
          <button type="button" className="button-danger" onClick={onConfirm} disabled={isProcessing}>
            {isProcessing ? (processingLabel ?? t("createChart.deleting")) : (confirmLabel ?? t("common.confirm"))}
          </button>
        </div>
      </div>
    </div>
  );
}
