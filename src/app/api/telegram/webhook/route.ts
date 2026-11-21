import { NextRequest, NextResponse } from "next/server";
import { validateWebhookSecret } from "@/lib/telegram/crypto";
import { TelegramConversationFSM } from "@/lib/telegram/fsm";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { TelegramUpdate } from "@/lib/telegram/types";

/**
 * Nagrik Telegram Webhook Route Handler
 * Authority: TRD Section 8, 22.1 & Phase 5 Primary Acceptance Objective
 *
 * Security Rules:
 * - Strictly validates `X-Telegram-Bot-Api-Secret-Token` header.
 * - Rejects unauthorized requests with HTTP 401.
 * - Dedupes incoming `update_id` using PostgreSQL `public.telegram_updates`.
 * - Never logs raw Telegram user IDs, chat IDs, or webhook secret tokens.
 * - Safe error handling: returns HTTP 200 to acknowledge Telegram updates.
 */

export async function POST(req: NextRequest) {
  // 1. Verify Telegram secret token header
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  const isValidSecret = validateWebhookSecret(secretHeader);

  if (!isValidSecret) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing Telegram webhook secret token." },
      { status: 401 }
    );
  }

  // 2. Parse payload safely
  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request: Malformed JSON payload." },
      { status: 400 }
    );
  }

  if (!update || typeof update.update_id !== "number") {
    return NextResponse.json(
      { error: "Bad Request: Missing update_id." },
      { status: 400 }
    );
  }

  const updateId = update.update_id;
  const supabase = createAdminSupabaseClient();

  // 3. Idempotency Check via public.telegram_updates
  try {
    const { data: existing } = await (supabase as any)
      .from("telegram_updates")
      .select("update_id, processing_status")
      .eq("update_id", updateId)
      .single();

    if (existing && existing.processing_status === "processed") {
      return NextResponse.json(
        { ok: true, status: "ignored_duplicate" },
        { status: 200 }
      );
    }

    // (No separate "received" write: the single upsert after processing records it,
    // saving a database round trip on every tap.)
  } catch (err) {
    // If table write fails, proceed with conversation handling
    console.warn("Update tracking notice:", err instanceof Error ? err.message : err);
  }

  // 4. Delegate to Conversational FSM
  const fsm = new TelegramConversationFSM();
  const receivedAt = new Date().toISOString();
  try {
    await fsm.handleUpdate(update);

    // Mark update processed
    await (supabase as any).from("telegram_updates").upsert({
      update_id: updateId,
      received_at: receivedAt,
      processed_at: new Date().toISOString(),
      processing_status: "processed",
    });

    return NextResponse.json({ ok: true, update_id: updateId }, { status: 200 });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error(`Telegram update ${updateId} processing error: ${errorMsg}`);

    await (supabase as any).from("telegram_updates").upsert({
      update_id: updateId,
      received_at: receivedAt,
      processed_at: new Date().toISOString(),
      processing_status: "failed",
      failure_reason: errorMsg.slice(0, 500),
    });

    // Return 200 to prevent Telegram from looping retries indefinitely on broken updates
    return NextResponse.json(
      { ok: false, error: "Processing failure", update_id: updateId },
      { status: 200 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      service: "Nagrik Telegram Webhook API",
      status: "active",
      pilot: "kharghar_itm_v1",
      mode: "webhook_listening",
    },
    { status: 200 }
  );
}
