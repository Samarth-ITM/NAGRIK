import { NextResponse } from "next/server";
import { loadPublicFixes } from "@/lib/public/fixes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type { PublicFix } from "@/lib/public/fixes";

export async function GET() {
  const payload = await loadPublicFixes();
  return NextResponse.json(payload, {
    headers: {
      // Shared CDN cache: visitors get an instant answer; it refreshes in the background.
      "Cache-Control":
        payload.source === "live"
          ? "public, s-maxage=60, stale-while-revalidate=86400"
          : "public, s-maxage=15, stale-while-revalidate=300",
    },
  });
}
