import { NextRequest, NextResponse } from "next/server";
import { getNgoProfile, saveNgoProfile } from "@/lib/ngo/ngo-store";

export async function GET() {
  try {
    const profile = getNgoProfile();
    return NextResponse.json({ success: true, profile });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load NGO profile" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, logoUrl, contactEmail } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "NGO name is required." },
        { status: 400 }
      );
    }

    const updated = saveNgoProfile({
      name: name.trim(),
      logoUrl: typeof logoUrl === "string" ? logoUrl : undefined,
      contactEmail: typeof contactEmail === "string" ? contactEmail.trim() : undefined,
      verified: true,
    });

    return NextResponse.json({ success: true, profile: updated });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to save NGO profile" },
      { status: 500 }
    );
  }
}
