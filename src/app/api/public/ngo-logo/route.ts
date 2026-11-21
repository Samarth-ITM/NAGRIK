import { NextResponse } from "next/server";
import { loadNgoLogoDataUrl } from "@/lib/public/fixes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serves the saved NGO logo as a real, cacheable image instead of a giant inline data URL. */
export async function GET() {
  const dataUrl = await loadNgoLogoDataUrl();
  const m = dataUrl?.match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/i);
  if (!m) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "public, s-maxage=60" } });
  const bytes = Buffer.from(m[2], "base64");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": m[1].toLowerCase(),
      "X-Content-Type-Options": "nosniff",
      // URL carries a content hash (?v=…), so it can be cached for a long time.
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
    },
  });
}
