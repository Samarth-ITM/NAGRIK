import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { TelegramBotClient } from "./bot";
import type { TelegramReplyMarkup } from "./types";
import { writeFileAtomic } from "@/lib/security/fs-atomic";
import { appDb, isSupabaseConfigured, IS_SERVERLESS } from "@/lib/storage/app-db";

/**
 * Short looping "how to" animations shown with the photo and location steps.
 * Files live in public/telegram/. The first send uploads the file; Telegram returns a
 * file_id that is cached (memory + data/telegram-animations.json) so later sends are instant.
 */

export type HowToKind = "voice" | "photo" | "location";

const FILES: Record<HowToKind, { file: string; width: number; height: number; duration: number }> = {
  voice: { file: "how-to-voice.mp4", width: 480, height: 480, duration: 5 },
  photo: { file: "how-to-photo.mp4", width: 480, height: 480, duration: 6 },
  location: { file: "how-to-location.mp4", width: 480, height: 480, duration: 5 },
};

const CACHE_FILE = path.join(process.cwd(), "data", "telegram-animations.json");
const KV_KEY = "telegram-animations";

type CacheEntry = { sha: string; fileId: string; bot: string };
const g = globalThis as unknown as { __nagrikAnimCache?: Record<string, CacheEntry> };

function botKey(): string {
  return crypto.createHash("sha256").update(process.env.TELEGRAM_BOT_TOKEN || "").digest("hex").slice(0, 12);
}

/** file_id cache: memory, then Supabase (app_kv), then a local file in development. */
async function loadCache(): Promise<Record<string, CacheEntry>> {
  if (g.__nagrikAnimCache) return g.__nagrikAnimCache;
  let cache: Record<string, CacheEntry> = {};
  if (isSupabaseConfigured()) {
    try {
      const { data } = await appDb().from("app_kv").select("value").eq("key", KV_KEY).maybeSingle();
      if (data?.value && typeof data.value === "object") cache = data.value;
    } catch {
      /* table may not exist yet */
    }
  }
  if (!Object.keys(cache).length && !IS_SERVERLESS) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) || {};
    } catch {
      /* no cache yet */
    }
  }
  g.__nagrikAnimCache = cache;
  return cache;
}

async function saveCache(cache: Record<string, CacheEntry>): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await appDb()
        .from("app_kv")
        .upsert({ key: KV_KEY, value: cache, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (!error) return;
    } catch {
      /* fall back below */
    }
  }
  if (!IS_SERVERLESS) {
    try {
      writeFileAtomic(CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch {
      /* cache is an optimisation only */
    }
  }
}

function readAnimation(kind: HowToKind): { data: Buffer; sha: string } | null {
  try {
    const data = fs.readFileSync(path.join(process.cwd(), "public", "telegram", FILES[kind].file));
    return { data, sha: crypto.createHash("sha256").update(data).digest("hex").slice(0, 16) };
  } catch {
    return null;
  }
}

/**
 * Sends the step's instructions as the caption of a how-to animation.
 * Falls back to a plain text message if the animation can't be sent, so the flow never stalls.
 */
export async function sendHowToAnimation(
  bot: TelegramBotClient,
  chatId: number,
  kind: HowToKind,
  caption: string,
  replyMarkup?: TelegramReplyMarkup
): Promise<void> {
  const spec = FILES[kind];
  const meta = { width: spec.width, height: spec.height, duration: spec.duration };
  const anim = readAnimation(kind);

  if (anim) {
    const cache = await loadCache();
    const cached = cache[kind];
    const bot_ = botKey();

    if (cached && cached.sha === anim.sha && cached.bot === bot_) {
      const sent = await bot.sendAnimation(chatId, { fileId: cached.fileId }, caption, replyMarkup, meta);
      if (sent) return;
      delete cache[kind]; // stale file_id: upload again below
    }

    const sent = await bot.sendAnimation(
      chatId,
      { upload: { data: anim.data, filename: spec.file, mimeType: "video/mp4" } },
      caption,
      replyMarkup,
      meta
    );
    if (sent) {
      const fileId: string | undefined = sent?.animation?.file_id || sent?.document?.file_id || sent?.video?.file_id;
      if (fileId && fileId !== "mock-animation") {
        cache[kind] = { sha: anim.sha, fileId, bot: bot_ };
        await saveCache(cache);
      }
      return;
    }
  }

  await bot.sendMessage(chatId, caption, replyMarkup);
}
