import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addContribution, DuplicateReferenceError, getPublicSummary } from "@/lib/funding/ledger";
import { getFundingConfig } from "@/lib/funding/config";
import { clientIp, minutes, rateLimit } from "@/lib/security/rate-limit";
import { bodyTooLarge } from "@/lib/security/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/funding: public totals (seed is labelled), recent supporters. */
export async function GET() {
  const summary = await getPublicSummary();
  return NextResponse.json(
    { success: true, ...summary },
    { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=300" } }
  );
}

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s.replace(/[\u0000-\u001f<>]/g, ""));

const Body = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("citizen"),
    amount: z.coerce.number().int().min(1, "Enter an amount.").max(100_000, "For more than ₹1,00,000, use bank transfer."),
    name: text(60).optional().default(""),
    // UPI transaction reference (UTR / RRN) is 12 digits.
    reference: z.string().trim().regex(/^\d{12}$/, "Enter the 12-digit UPI reference (UTR) from your payment app."),
    anonymous: z.boolean().optional().default(false),
  }),
  z.object({
    kind: z.literal("csr"),
    amount: z.coerce.number().int().min(1000, "CSR pledges start at ₹1,000.").max(100_000_000),
    organisation: text(120).pipe(z.string().min(2, "Enter the company name.")),
    name: text(80).pipe(z.string().min(2, "Enter a contact name.")),
    email: z.string().trim().max(120).email("Enter a valid work email."),
    phone: z
      .string()
      .trim()
      .max(20)
      .regex(/^[+\d][\d\s-]{6,18}$/, "Enter a valid phone number.")
      .optional()
      .or(z.literal("")),
    reference: z
      .string()
      .trim()
      .max(40)
      .regex(/^[A-Za-z0-9-]*$/, "The bank reference can only have letters, numbers and dashes.")
      .optional()
      .default(""),
    message: text(500).optional().default(""),
  }),
]);

/** POST /api/funding: a giver reports a UPI payment or a CSR pledge/transfer. */
export async function POST(req: NextRequest) {
  if (bodyTooLarge(req, 8 * 1024)) {
    return NextResponse.json({ success: false, error: "Request too large." }, { status: 413 });
  }
  const limit = await rateLimit(`fund:${clientIp(req)}`, 6, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: `Too many submissions. Try again in ${minutes(limit.retryAfterSeconds)} minutes.` },
      { status: 429 }
    );
  }

  const config = getFundingConfig();
  let parsed;
  try {
    parsed = Body.safeParse(await req.json());
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || "Check the form and try again." },
      { status: 400 }
    );
  }
  const b = parsed.data;
  // Sample mode (no real details set): the form works end to end for demos,
  // but nothing is stored and the totals don't change.
  if (config.sample) {
    return NextResponse.json({ success: true, sample: true });
  }
  if (b.kind === "citizen" && !config.upi) {
    return NextResponse.json({ success: false, error: "UPI payments aren't open yet." }, { status: 409 });
  }
  if (b.kind === "csr" && !config.bank) {
    return NextResponse.json({ success: false, error: "Bank details aren't published yet." }, { status: 409 });
  }

  try {
    const entry = await addContribution(
      b.kind === "citizen"
        ? {
            kind: "citizen",
            amount: b.amount,
            name: b.name || "Anonymous",
            organisation: null,
            email: null,
            phone: null,
            reference: b.reference,
            message: null,
            anonymous: b.anonymous || !b.name,
          }
        : {
            kind: "csr",
            amount: b.amount,
            name: b.name,
            organisation: b.organisation,
            email: b.email,
            phone: b.phone || null,
            reference: b.reference || null,
            message: b.message || null,
            anonymous: false,
          }
    );
    return NextResponse.json({ success: true, id: entry.id });
  } catch (err) {
    if (err instanceof DuplicateReferenceError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 409 });
    }
    console.error("[funding] save failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: "Couldn't save that right now. Try again in a minute." }, { status: 503 });
  }
}
