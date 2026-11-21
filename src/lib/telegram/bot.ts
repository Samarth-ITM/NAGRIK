import type {
  TelegramReplyMarkup,
  TelegramFile,
  TelegramMessage,
} from "./types";

/**
 * Server-Side Telegram Bot API Client
 * Authority: TRD Section 8
 *
 * Security Rules:
 * - Bot tokens and request URLs are strictly server-side.
 * - Raw chat IDs and tokens are NEVER printed to stdout/stderr.
 * - Network failures are safely handled without unhandled rejections.
 */

const TELEGRAM_API_BASE = "https://api.telegram.org";

export class TelegramBotClient {
  private token: string;

  constructor(token?: string) {
    this.token = token || process.env.TELEGRAM_BOT_TOKEN || "";
  }

  get isConfigured(): boolean {
    return Boolean(this.token && !this.token.startsWith("placeholder-"));
  }

  private async post(method: string, body: Record<string, unknown>): Promise<any> {
    if (!this.isConfigured) {
      // In development/test mode without live credentials, gracefully mock
      return { ok: true, result: { message_id: Math.floor(Math.random() * 1000000) } };
    }

    const url = `${TELEGRAM_API_BASE}/bot${this.token}/${method}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(
          `Telegram API error in ${method}: ${json.description || response.statusText}`
        );
      }
      return json.result;
    } catch (err) {
      // Safe logging: do not expose url or payload in log
      const safeMsg = err instanceof Error ? err.message : "Unknown network error";
      console.error(`Telegram API [${method}] request failed: ${safeMsg}`);
      throw err;
    }
  }

  /**
   * Sends a text message to a Telegram chat.
   */
  async sendMessage(
    chatId: number | string,
    text: string,
    replyMarkup?: TelegramReplyMarkup,
    parseMode: "HTML" | "MarkdownV2" | "Markdown" = "HTML"
  ): Promise<TelegramMessage | null> {
    return this.post("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      reply_markup: replyMarkup,
      link_preview_options: { is_disabled: true },
    });
  }

  /**
   * Acknowledges a callback query from an inline keyboard button.
   */
  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
    showAlert: boolean = false
  ): Promise<boolean> {
    try {
      await this.post("answerCallbackQuery", {
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      });
      return true;
    } catch {
      // Already answered or expired: harmless, never fail the update over it.
      return false;
    }
  }

  /**
   * Sends a chat action indicator (e.g. typing, upload_photo).
   */
  async sendChatAction(
    chatId: number | string,
    action: "typing" | "upload_photo" | "record_voice" | "find_location" = "typing"
  ): Promise<boolean> {
    try {
      return await this.post("sendChatAction", {
        chat_id: chatId,
        action,
      });
    } catch {
      return false;
    }
  }

  /**
   * Edits an existing message's text and inline buttons in-place (used for skeleton loaders).
   */
  async editMessageText(
    chatId: number | string,
    messageId: number,
    text: string,
    replyMarkup?: TelegramReplyMarkup,
    parseMode: "HTML" | "MarkdownV2" | "Markdown" = "HTML"
  ): Promise<TelegramMessage | null> {
    try {
      return await this.post("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: parseMode,
        reply_markup: replyMarkup,
        link_preview_options: { is_disabled: true },
      });
    } catch {
      return null;
    }
  }

  /**
   * Sends a looping animation (silent MP4) with a caption and buttons.
   * Pass `fileId` to reuse an upload, or `upload` to send the file the first time.
   * Returns the sent message (its animation.file_id can be cached), or null on failure.
   */
  async sendAnimation(
    chatId: number | string,
    source: { fileId?: string; upload?: { data: Buffer; filename: string; mimeType: string } },
    caption: string,
    replyMarkup?: TelegramReplyMarkup,
    meta?: { width?: number; height?: number; duration?: number }
  ): Promise<any | null> {
    if (!this.isConfigured) {
      return { message_id: Math.floor(Math.random() * 1000000), animation: { file_id: "mock-animation" } };
    }
    try {
      if (source.fileId) {
        return await this.post("sendAnimation", {
          chat_id: chatId,
          animation: source.fileId,
          caption,
          parse_mode: "HTML",
          reply_markup: replyMarkup,
          ...meta,
        });
      }
      if (!source.upload) return null;

      const form = new FormData();
      form.append("chat_id", String(chatId));
      form.append("caption", caption);
      form.append("parse_mode", "HTML");
      if (replyMarkup) form.append("reply_markup", JSON.stringify(replyMarkup));
      if (meta?.width) form.append("width", String(meta.width));
      if (meta?.height) form.append("height", String(meta.height));
      if (meta?.duration) form.append("duration", String(meta.duration));
      form.append(
        "animation",
        new Blob([new Uint8Array(source.upload.data)], { type: source.upload.mimeType }),
        source.upload.filename
      );

      const response = await fetch(`${TELEGRAM_API_BASE}/bot${this.token}/sendAnimation`, {
        method: "POST",
        body: form,
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(`Telegram API error in sendAnimation: ${json.description || response.statusText}`);
      }
      return json.result;
    } catch (err) {
      const safeMsg = err instanceof Error ? err.message : "Unknown network error";
      console.error(`Telegram API [sendAnimation] request failed: ${safeMsg}`);
      return null;
    }
  }

  /**
   * Deletes a message from a chat (e.g. temporary loader message).
   */
  async deleteMessage(
    chatId: number | string,
    messageId: number
  ): Promise<boolean> {
    try {
      await this.post("deleteMessage", {
        chat_id: chatId,
        message_id: messageId,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieves file metadata including file_path.
   */
  async getFile(fileId: string): Promise<TelegramFile> {
    if (!this.isConfigured) {
      return {
        file_id: fileId,
        file_unique_id: `mock_unique_${fileId}`,
        file_size: 10240,
        file_path: `photos/mock_${fileId}.jpg`,
      };
    }

    return this.post("getFile", { file_id: fileId });
  }

  /**
   * Downloads raw file bytes from Telegram CDN.
   */
  async downloadFile(filePath: string): Promise<Buffer> {
    if (!this.isConfigured) {
      // Return a 1KB mock image buffer in test mode
      return Buffer.from(
        "ffd8ffe000104a46494600010101006000600000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffda0008010100003f007f00ffd9",
        "hex"
      );
    }

    const url = `${TELEGRAM_API_BASE}/file/bot${this.token}/${filePath}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download Telegram file: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
