import type { NextRequest } from "next/server";
import { appDb, isMissingTable, isSupabaseConfigured } from "@/lib/storage/app-db";

/**
 * Fixed-window rate limiter.
 * Uses the shared Supabase table (rate_limit_hits) so limits hold across every server
 * instance, and falls back to memory if the database can't be reached. A database
 * problem never blocks a resident: on error the request is allowed.
 */

type Bucket = { count: number; resetAt: number };
const g = globalThis as unknown as { __nagrikRateBuckets?: Map<string, Bucket>; __nagrikRateDb?: boolean };
const buckets: Map<string, Bucket> = g.__nagrikRateBuckets || (g.__nagrikRateBuckets = new Map());

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

function isDbEnabled(): boolean {
  return isSupabaseConfigured() && g.__nagrikRateDb !== false;
}

function result(count: number, limit: number, resetAtMs: number): RateLimitResult {
  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - Date.now()) / 1000)),
  };
}

function memoryHit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return result(b.count, limit, b.resetAt);
}

/** Counts one hit against `key`. */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (isDbEnabled()) {
    try {
      const { data, error } = await appDb().rpc("rate_limit_hit", {
        p_key: key.slice(0, 200),
        p_window_seconds: Math.ceil(windowMs / 1000),
      });
      if (error) {
        if (isMissingTable(error)) g.__nagrikRateDb = false;
        throw error;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (row && typeof row.hit_count === "number") {
        return result(row.hit_count, limit, new Date(row.reset_at).getTime());
      }
      throw new Error("unexpected rate_limit_hit result");
    } catch {
      // Keep counting and checking in one place: switch this process to memory.
      g.__nagrikRateDb = false;
    }
  }
  return memoryHit(key, limit, windowMs);
}

/** Checks `key` without counting a hit. */
export async function isRateLimited(key: string, limit: number): Promise<RateLimitResult> {
  if (isDbEnabled()) {
    try {
      const { data, error } = await appDb()
        .from("rate_limit_hits")
        .select("count, reset_at")
        .eq("key", key.slice(0, 200))
        .maybeSingle();
      if (error) {
        if (isMissingTable(error)) g.__nagrikRateDb = false;
        throw error;
      }
      if (!data || new Date(data.reset_at).getTime() <= Date.now()) {
        return { ok: true, remaining: limit, retryAfterSeconds: 0 };
      }
      return {
        ok: data.count < limit,
        remaining: Math.max(0, limit - data.count),
        retryAfterSeconds: Math.max(1, Math.ceil((new Date(data.reset_at).getTime() - Date.now()) / 1000)),
      };
    } catch {
      /* fall through */
    }
  }
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) return { ok: true, remaining: limit, retryAfterSeconds: 0 };
  return {
    ok: b.count < limit,
    remaining: Math.max(0, limit - b.count),
    retryAfterSeconds: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
  };
}

export async function resetRateLimit(key: string): Promise<void> {
  buckets.delete(key);
  if (isDbEnabled()) {
    try {
      await appDb().from("rate_limit_hits").delete().eq("key", key.slice(0, 200));
    } catch {
      /* ignore */
    }
  }
}

/** Best-effort client IP (Vercel, Cloudflare, other proxies, then a fixed local key). */
export function clientIp(req: NextRequest | Request): string {
  const h = req.headers;
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const vercel = h.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0].trim();
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "local";
}

export function minutes(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60));
}
