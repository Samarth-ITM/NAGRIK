import { NextRequest, NextResponse } from "next/server";
import { listContributions, reviewContribution } from "@/lib/funding/ledger";
import { requireNgo } from "@/lib/auth/request-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/funding/ledger: NGO desk only. Every reported contribution. */
export async function GET(req: NextRequest) {
  const denied = requireNgo(req);
  if (denied) return denied;
  try {
    const entries = await listContributions({ fresh: true });
    return NextResponse.json(
      { success: true, entries: entries.slice().reverse() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ success: false, error: "Couldn't load funding right now." }, { status: 503 });
  }
}

/** POST /api/funding/ledger: NGO desk confirms or rejects a contribution after checking its account. */
export async function POST(req: NextRequest) {
  const denied = requireNgo(req);
  if (denied) return denied;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }
  const id = typeof body?.id === "string" && /^f_[a-f0-9]{12}$/.test(body.id) ? body.id : null;
  const status = ["confirmed", "rejected", "reported"].includes(body?.status) ? body.status : null;
  if (!id || !status) return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  try {
    const updated = await reviewContribution(id, status);
    if (!updated) return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
    return NextResponse.json({ success: true, entry: updated });
  } catch {
    return NextResponse.json({ success: false, error: "Couldn't save that right now." }, { status: 503 });
  }
}
