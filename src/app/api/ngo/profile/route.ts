import { NextRequest, NextResponse } from "next/server";
import { getNgoProfile, saveNgoProfile } from "@/lib/ngo/ngo-store";
import { requireNgo } from "@/lib/auth/request-guards";
import { bodyTooLarge, checkLogo } from "@/lib/security/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ngo/profile: public. Returns only what the public site shows. */
export async function GET() {
  try {
    const profile = await getNgoProfile();
    return NextResponse.json({
      success: true,
      profile: {
        name: profile.name,
        logoUrl: profile.logoUrl || "",
        verified: profile.verified,
        lastUpdated: profile.lastUpdated,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to load NGO profile" }, { status: 500 });
  }
}

/** POST /api/ngo/profile: NGO desk only. Updates the organisation name and logo. */
export async function POST(req: NextRequest) {
  const denied = requireNgo(req);
  if (denied) return denied;

  if (bodyTooLarge(req, 512 * 1024)) {
    return NextResponse.json({ success: false, error: "The logo is too large. Use an image under 300 KB." }, { status: 413 });
  }

  try {
    const body = await req.json();
    const { name, logoUrl, contactEmail } = body || {};

    const cleanName = typeof name === "string" ? name.replace(/[\u0000-\u001f<>]/g, "").trim() : "";
    if (cleanName.length < 2 || cleanName.length > 80) {
      return NextResponse.json(
        { success: false, error: "Enter your organisation's name (2 to 80 characters)." },
        { status: 400 }
      );
    }

    const logo = checkLogo(logoUrl);
    if (!logo.ok) return NextResponse.json({ success: false, error: logo.error }, { status: 400 });

    let email: string | undefined;
    if (typeof contactEmail === "string" && contactEmail.trim()) {
      email = contactEmail.trim();
      if (email.length > 120 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
        return NextResponse.json({ success: false, error: "Enter a valid contact email." }, { status: 400 });
      }
    }

    const updated = await saveNgoProfile({
      name: cleanName,
      logoUrl: logo.value ?? "",
      ...(email ? { contactEmail: email } : {}),
    });

    return NextResponse.json({
      success: true,
      profile: { name: updated.name, logoUrl: updated.logoUrl || "", verified: updated.verified, lastUpdated: updated.lastUpdated },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to save NGO profile" }, { status: 500 });
  }
}
