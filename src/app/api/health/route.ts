import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Health check: GET /api/health
 * Public, so it reports only that the service is up. No configuration, feature flags,
 * area settings, versions or secrets.
 */
export async function GET() {
  return NextResponse.json(
    { status: "healthy", timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
