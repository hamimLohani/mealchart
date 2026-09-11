"use client";

import { useState, useEffect } from "react";
import { getGroupWhatsappConfig, updateGroupWhatsappConfig } from "@/lib/firebase/repositories";
import { useT } from "@/i18n/use-t";
import { useToast } from "@/lib/hooks/use-toast";
import type { WhatsappConfig } from "@/types/domain";

interface WhatsAppSettingsProps {
  groupId: string;
}

export function WhatsAppSettings({ groupId }: WhatsAppSettingsProps) {
  const { t } = useT();
  const { success: showSuccess, error: showError } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [config, setConfig] = useState<WhatsappConfig | null>(null);

  // Load existing config when opened
  useEffect(() => {
    if (!isOpen || !groupId) return;
    let active = true;
    void (async () => {
      setIsLoading(true);
      try {
        const c = await getGroupWhatsappConfig(groupId);
        if (!active || !c) return;
        setConfig(c);
        setPhoneNumberId(c.whatsappPhoneNumberId ?? "");
        setAccessToken(c.whatsappAccessToken ?? "");
        setRecipientPhone(c.whatsappRecipientPhone ?? "");
        setEnabled(c.whatsappEnabled ?? false);
      } catch {
        // silently ignore load errors
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isOpen, groupId]);

  const isConfigured = !!(
    config?.whatsappPhoneNumberId &&
    config?.whatsappAccessToken &&
    config?.whatsappRecipientPhone
  );

  async function handleSave() {
    if (!groupId) return;
    if (!phoneNumberId.trim() || !accessToken.trim() || !recipientPhone.trim()) {
      showError(t("whatsapp.errorAllFields"));
      return;
    }
    setIsSaving(true);
    try {
      await updateGroupWhatsappConfig(groupId, {
        whatsappPhoneNumberId: phoneNumberId.trim(),
        whatsappAccessToken: accessToken.trim(),
        whatsappRecipientPhone: recipientPhone.trim(),
        whatsappEnabled: enabled,
      });
      // Update local config state to reflect saved values
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              whatsappPhoneNumberId: phoneNumberId.trim(),
              whatsappAccessToken: accessToken.trim(),
              whatsappRecipientPhone: recipientPhone.trim(),
              whatsappEnabled: enabled,
            }
          : prev
      );
      showSuccess(t("whatsapp.saveSuccess"));
    } catch (e) {
      showError(e instanceof Error ? e.message : t("whatsapp.saveError"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTest() {
    if (!groupId) return;
    // Save first if there are unsaved changes, then test
    setIsTesting(true);
    try {
      const { sendWhatsAppNoticeAction } = await import("@/lib/whatsapp/actions");
      const config = {
        whatsappPhoneNumberId: phoneNumberId.trim(),
        whatsappAccessToken: accessToken.trim(),
        whatsappRecipientPhone: recipientPhone.trim(),
        whatsappEnabled: enabled,
      };
      const data = await sendWhatsAppNoticeAction(
        config,
        "Test Notice",
        "✅ WhatsApp integration is working correctly for your Meal Chart group!"
      );
      if (data.success) {
        showSuccess(t("whatsapp.testSuccess"));
      } else {
        showError(data.error ?? t("whatsapp.testError"));
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : t("whatsapp.testError"));
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] shadow-[var(--shadow-sm)] overflow-hidden">
      {/* Header / Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 transition hover:bg-[color:var(--accent-dim)]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--accent-dim)] text-lg">
            📲
          </span>
          <div className="text-left">
            <p className="font-semibold text-sm">{t("whatsapp.settings")}</p>
            <p className="text-xs text-[color:var(--muted)]">{t("whatsapp.settingsSubtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Status badge */}
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              config?.whatsappEnabled && isConfigured
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-[color:var(--accent-dim)] text-[color:var(--muted)]"
            }`}
          >
            {config?.whatsappEnabled && isConfigured
              ? t("whatsapp.statusConnected")
              : t("whatsapp.statusNotConfigured")}
          </span>
          <span
            className={`text-[color:var(--muted)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          >
            ▼
          </span>
        </div>
      </button>

      {/* Expandable body */}
      {isOpen && (
        <div className="border-t border-[color:var(--border)] px-5 py-5">
          {isLoading ? (
            <p className="py-4 text-center text-sm text-[color:var(--muted)]">{t("common.loading")}</p>
          ) : (
            <div className="grid gap-4">
              {/* Help text */}
              <div className="rounded-[var(--radius-sm)] bg-[color:var(--accent-dim)] px-4 py-3 text-xs text-[color:var(--soft-foreground)]">
                <p className="font-semibold mb-1">{t("whatsapp.setupTitle")}</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>
                    {t("whatsapp.setupStep1").split("developers.facebook.com").map((part, i, arr) => (
                      <span key={i}>
                        {part}
                        {i < arr.length - 1 && (
                          <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-[color:var(--accent)] hover:underline font-medium">
                            developers.facebook.com
                          </a>
                        )}
                      </span>
                    ))}
                  </li>
                  <li>{t("whatsapp.setupStep2")}</li>
                  <li>{t("whatsapp.setupStep3")}</li>
                  <li>{t("whatsapp.setupStep4")}</li>
                </ol>
              </div>

              {/* Phone Number ID */}
              <label className="grid gap-1.5 text-sm font-medium">
                {t("whatsapp.phoneNumberId")}
                <input
                  className="input"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  placeholder="e.g. 123456789012345"
                  autoComplete="off"
                />
              </label>

              {/* Access Token */}
              <label className="grid gap-1.5 text-sm font-medium">
                {t("whatsapp.accessToken")}
                <div className="relative">
                  <input
                    className="input pr-14"
                    type={showToken ? "text" : "password"}
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="EAAxxxxxxxx…"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[color:var(--accent)] hover:underline"
                  >
                    {showToken ? t("common.hide") : t("common.show")}
                  </button>
                </div>
              </label>

              {/* Recipient Phone */}
              <label className="grid gap-1.5 text-sm font-medium">
                {t("whatsapp.recipientPhone")}
                <input
                  className="input"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="e.g. 8801712345678"
                  autoComplete="off"
                />
                <span className="text-xs text-[color:var(--muted)]">{t("whatsapp.recipientPhoneHint")}</span>
              </label>

              {/* Enable toggle */}
              <label className="flex cursor-pointer items-center gap-3">
                <div
                  onClick={() => setEnabled((e) => !e)}
                  className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
                    enabled ? "bg-[color:var(--accent)]" : "bg-[color:var(--border)]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                      enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
                <span className="text-sm font-medium">{t("whatsapp.enable")}</span>
              </label>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="button-primary w-full sm:w-auto"
                >
                  {isSaving ? t("admin.saving") : t("common.save")}
                </button>
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={isTesting || !isConfigured}
                  className="button-secondary w-full sm:w-auto disabled:opacity-50"
                  title={!isConfigured ? t("whatsapp.saveFirstToTest") : undefined}
                >
                  {isTesting ? t("whatsapp.testing") : t("whatsapp.sendTest")}
                </button>
              </div>

              {!isConfigured && (
                <p className="text-xs text-[color:var(--muted)]">{t("whatsapp.saveFirstToTest")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
