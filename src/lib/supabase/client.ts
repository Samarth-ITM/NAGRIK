import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client placeholder
 * Authority: TRD Section 2.1 & Phase 1 Boundary
 * Safe initialization that does not crash if credentials are not configured.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
