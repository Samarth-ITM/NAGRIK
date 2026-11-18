import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { TelegramBotClient } from "./bot";
import { decryptTelegramChatId } from "./crypto";
import type { SupportedLanguage } from "@/lib/taxonomy/nagrik-taxonomy.v1";

/**
 * Nagrik Notification Outbox Dispatcher
 * Authority: TRD Section 8, 14 & Phase 5 Primary Acceptance Objective
 *
 * Rules:
 * - Decrypts chat ID strictly in-memory during dispatch.
 * - Idempotently updates notification delivery state.
 * - Tracks attempt count and failure reasons.
 * - One failed notification does not block or invalidate the parent report.
 */

const OUTBOX_MESSAGES: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    report_received:
      "📋 <b>Report Received</b>\n\nYour grievance (Ticket: <code>{ticket_code}</code>) has been successfully recorded in the municipal queue for verification.",
    spot_verified:
      "🔍 <b>Report Verified</b>\n\nYour grievance (Ticket: <code>{ticket_code}</code>) has been verified and linked to Physical Spot <code>{spot_code}</code>.",
    status_updated:
      "🔄 <b>Status Update</b>\n\nIssue <code>{spot_code}</code> has transitioned to <b>{status}</b>.",
  },
  hi: {
    report_received:
      "📋 <b>शिकायत दर्ज</b>\n\nआपकी शिकायत (टिकट संख्या: <code>{ticket_code}</code>) सत्यापन के लिए दर्ज कर ली गई है।",
    spot_verified:
      "🔍 <b>शिकायत सत्यापित</b>\n\nआपकी शिकायत (टिकट: <code>{ticket_code}</code>) सत्यापित हो गई है और स्पॉट <code>{spot_code}</code> से जोड़ दी गई है।",
    status_updated:
      "🔄 <b>स्थिति अपडेट</b>\n\nसमस्या <code>{spot_code}</code> की स्थिति अब <b>{status}</b> है।",
  },
  mr: {
    report_received:
      "📋 <b>तक्रार नोंदवली गेली</b>\n\nआपली तक्रार (तिकीट: <code>{ticket_code}</code>) पडताळणीसाठी यशस्वीरित्या नोंदवली गेली आहे.",
    spot_verified:
      "🔍 <b>तक्रार पडताळणी पूर्ण</b>\n\nआपली तक्रार (तिकीट: <code>{ticket_code}</code>) पडताळली गेली असून स्पॉट <code>{spot_code}</code> शी जोडली आहे.",
    status_updated:
      "🔄 <b>स्थिती अपडेट</b>\n\nसमस्या <code>{spot_code}</code> ची स्थिती आता <b>{status}</b> आहे.",
  },
};

export class NotificationDispatcher {
  private bot: TelegramBotClient;

  constructor(bot?: TelegramBotClient) {
    this.bot = bot || new TelegramBotClient();
  }

  /**
   * Processes pending notifications from the outbox.
   *
   * @param limit Maximum number of records to process in a single batch
   * @returns Count of processed notifications
   */
  async processPendingOutbox(limit: number = 20): Promise<{ sent: number; failed: number }> {
    const supabase = createAdminSupabaseClient();
    let sentCount = 0;
    let failedCount = 0;

    // 1. Fetch pending notifications with citizen contacts
    const { data: records, error } = await (supabase as any)
      .from("notification_outbox")
      .select(`
        id,
        citizen_contact_id,
        event_type,
        payload,
        attempt_count,
        citizen_contacts (
          encrypted_chat_id,
          language
        )
      `)
      .eq("delivery_status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error || !records || records.length === 0) {
      return { sent: 0, failed: 0 };
    }

    // 2. Dispatch each notification safely
    for (const item of records) {
      const contact = item.citizen_contacts as {
        encrypted_chat_id: string;
        language: string;
      } | null;

      if (!contact || !contact.encrypted_chat_id) {
        await this.markFailed(item.id, item.attempt_count, "Missing contact or encrypted_chat_id");
        failedCount++;
        continue;
      }

      try {
        const chatId = decryptTelegramChatId(contact.encrypted_chat_id);
        const lang = (contact.language as SupportedLanguage) || "en";
        const messageText = this.formatMessage(item.event_type, item.payload, lang);

        await this.bot.sendMessage(chatId, messageText);
        await this.markSent(item.id);
        sentCount++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown dispatch error";
        await this.markFailed(item.id, item.attempt_count, errorMsg);
        failedCount++;
      }
    }

    return { sent: sentCount, failed: failedCount };
  }

  private formatMessage(
    eventType: string,
    payload: Record<string, any>,
    lang: SupportedLanguage
  ): string {
    const templates = OUTBOX_MESSAGES[lang] || OUTBOX_MESSAGES.en;
    let template = templates[eventType] || templates.report_received;

    for (const [key, val] of Object.entries(payload || {})) {
      template = template.replace(new RegExp(`{${key}}`, "g"), String(val));
    }
    return template;
  }

  private async markSent(id: string): Promise<void> {
    const supabase = createAdminSupabaseClient();
    await (supabase as any)
      .from("notification_outbox")
      .update({
        delivery_status: "sent",
        last_attempt_at: new Date().toISOString(),
      })
      .eq("id", id);
  }

  private async markFailed(id: string, currentAttempts: number, error: string): Promise<void> {
    const supabase = createAdminSupabaseClient();
    await (supabase as any)
      .from("notification_outbox")
      .update({
        delivery_status: "failed",
        attempt_count: currentAttempts + 1,
        last_attempt_at: new Date().toISOString(),
        last_error: error.slice(0, 500),
      })
      .eq("id", id);
  }
}
