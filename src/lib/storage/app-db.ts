import { createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * Where app state lives:
 * - In Supabase (tables from migration 20261122000001_app_state_in_database.sql). Always on
 *   Vercel/serverless, where the disk is temporary.
 * - In data/*.json on local disk only as a fallback for local development, when Supabase
 *   isn't configured or the migration hasn't been run yet.
 */

export const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return Boolean(url && key && !url.includes("placeholder") && !key.startsWith("placeholder"));
}

export function appDb(): any {
  return createAdminSupabaseClient() as any;
}

/** True when Postgres/PostgREST says the table doesn't exist (migration not run yet). */
export function isMissingTable(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST202" ||
    /could not find the (table|function)|does not exist/i.test(msg)
  );
}

const g = globalThis as unknown as { __nagrikStoreMode?: Record<string, "db" | "file"> };
const modes: Record<string, "db" | "file"> = g.__nagrikStoreMode || (g.__nagrikStoreMode = {});

/** Which backend a store uses. Decided once per process (per table). */
export function storeMode(table: string): "db" | "file" {
  if (modes[table]) return modes[table];
  return isSupabaseConfigured() ? "db" : IS_SERVERLESS ? "db" : "file";
}

/**
 * Called when a table is missing. Locally we fall back to files; on serverless that would
 * silently lose data, so we fail loudly instead.
 */
export function onMissingTable(table: string): "file" {
  if (IS_SERVERLESS) {
    throw new Error(
      `Supabase table "${table}" is missing. Run supabase/migrations/20261122000001_app_state_in_database.sql in the Supabase SQL editor.`
    );
  }
  if (modes[table] !== "file") {
    console.warn(
      `[nagrik] Supabase table "${table}" not found; using data/*.json for now. Run migration 20261122000001_app_state_in_database.sql.`
    );
  }
  modes[table] = "file";
  return "file";
}
