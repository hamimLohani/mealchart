"use server";

import type { WhatsappConfig } from "@/types/domain";

export async function sendWhatsAppMessageAction(
  config: WhatsappConfig,
  title: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!config.whatsappEnabled) {
      return { success: false, error: "WhatsApp integration is not enabled." };
    }

    if (!config.whatsappPhoneNumberId || !config.whatsappAccessToken || !config.whatsappRecipientPhone) {
      return { success: false, error: "WhatsApp is not fully configured." };
    }

    const messageText = `📢 *${title}*\n\n${body}`;
    const metaUrl = `https://graph.facebook.com/v19.0/${config.whatsappPhoneNumberId}/messages`;

    const metaResponse = await fetch(metaUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.whatsappAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: config.whatsappRecipientPhone,
        type: "text",
        text: { body: messageText },
      }),
    });

    if (!metaResponse.ok) {
      let errorDetail = "";
      try {
        const errData = (await metaResponse.json()) as { error?: { message?: string } };
        errorDetail = errData?.error?.message ?? metaResponse.statusText;
      } catch {
        errorDetail = metaResponse.statusText;
      }
      return { success: false, error: `WhatsApp API error: ${errorDetail}` };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to reach WhatsApp API." };
  }
}
