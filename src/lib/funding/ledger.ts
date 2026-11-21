import fs from "fs";
import path from "path";
import crypto from "crypto";
import { writeFileAtomic } from "@/lib/security/fs-atomic";
import { appDb, isSupabaseConfigured, IS_SERVERLESS } from "@/lib/storage/app-db";

/**
 * Funding ledger. Givers report what they sent (UPI reference or CSR pledge);
 * the NGO confirms each entry from its desk once the money shows up in its
 * account. Only confirmed entries (plus the clearly labelled seed) count as raised.
 */

export type FundKind = "csr" | "citizen";
export type FundStatus = "seed" | "reported" | "confirmed" | "rejected";

export interface Contribution {
  id: string;
  kind: FundKind;
  amount: number; // whole rupees
  name: string;
  organisation: string | null;
  email: string | null;
  phone: string | null;
  reference: string | null; // UPI UTR or bank reference
  message: string | null;
  anonymous: boolean;
  status: FundStatus;
  createdAt: string;
  reviewedAt: string | null;
}

/** Seed funding shown on the page, labelled as seed (demo) everywhere it appears. */
export const SEED_CONTRIBUTIONS: Contribution[] = [
  {
    id: "seed-csr",
    kind: "csr",
    amount: 50_000,
    name: "Seed CSR funding",
    organisation: "Seed (demo)",
    email: null,
    phone: null,
    reference: null,
    message: null,
    anonymous: false,
    status: "seed",
    createdAt: "2026-11-22T00:00:00.000Z",
    reviewedAt: null,
  },
  {
    id: "seed-citizen",
    kind: "citizen",
    amount: 5_000,
    name: "Seed citizen funding",
    organisation: null,
    email: null,
    phone: null,
    reference: null,
    message: null,
    anonymous: false,
    status: "seed",
    createdAt: "2026-11-22T00:00:00.000Z",
    reviewedAt: null,
  },
];

const KV_KEY = "funding-ledger";
const FILE = path.join(process.cwd(), "data", "funding-ledger.json");
const MAX_ENTRIES = 5000;

const g = globalThis as unknown as { __nagrikLedger?: { at: number; entries: Contribution[] } };
const CACHE_MS = 15_000;

async function readAll(): Promise<Contribution[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await appDb().from("app_kv").select("value").eq("key", KV_KEY).maybeSingle();
      if (!error) return Array.isArray(data?.value?.entries) ? data.value.entries : [];
    } catch {
      /* fall through */
    }
    if (IS_SERVERLESS) throw new Error("Funding ledger needs the app_kv table (run the Supabase migration).");
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return Array.isArray(parsed?.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

async function writeAll(entries: Contribution[]): Promise<void> {
  const value = { entries: entries.slice(-MAX_ENTRIES) };
  g.__nagrikLedger = { at: Date.now(), entries: value.entries };
  if (isSupabaseConfigured()) {
    const { error } = await appDb()
      .from("app_kv")
      .upsert({ key: KV_KEY, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (!error) return;
    if (IS_SERVERLESS) throw new Error(error.message || "Could not save the funding ledger.");
  }
  writeFileAtomic(FILE, JSON.stringify(value, null, 2));
}

export async function listContributions(options: { fresh?: boolean } = {}): Promise<Contribution[]> {
  const c = g.__nagrikLedger;
  if (!options.fresh && c && Date.now() - c.at < CACHE_MS) return c.entries;
  const entries = await readAll();
  g.__nagrikLedger = { at: Date.now(), entries };
  return entries;
}

export async function addContribution(
  input: Omit<Contribution, "id" | "status" | "createdAt" | "reviewedAt">
): Promise<Contribution> {
  const entries = await listContributions({ fresh: true });
  if (input.reference) {
    const dup = entries.find(
      (e) => e.kind === input.kind && e.reference === input.reference && e.status !== "rejected"
    );
    if (dup) throw new DuplicateReferenceError();
  }
  const entry: Contribution = {
    ...input,
    id: `f_${crypto.randomBytes(6).toString("hex")}`,
    status: "reported",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };
  await writeAll([...entries, entry]);
  return entry;
}

export class DuplicateReferenceError extends Error {
  constructor() {
    super("This payment reference has already been reported.");
  }
}

export async function reviewContribution(id: string, status: "confirmed" | "rejected" | "reported"): Promise<Contribution | null> {
  const entries = await listContributions({ fresh: true });
  const i = entries.findIndex((e) => e.id === id);
  if (i < 0) return null;
  const updated = { ...entries[i], status, reviewedAt: status === "reported" ? null : new Date().toISOString() };
  const next = entries.slice();
  next[i] = updated;
  await writeAll(next);
  return updated;
}

export interface FundTotals {
  raised: number;
  seed: number;
  confirmed: number;
  awaiting: number;
  supporters: number;
}

export interface PublicFundingSummary {
  csr: FundTotals;
  citizen: FundTotals;
  total: number;
  recent: { id: string; kind: FundKind; amount: number; name: string; seed: boolean; when: string }[];
}

export async function getPublicSummary(): Promise<PublicFundingSummary> {
  let entries: Contribution[] = [];
  try {
    entries = await listContributions();
  } catch {
    entries = [];
  }
  const all = [...SEED_CONTRIBUTIONS, ...entries];
  const totals = (kind: FundKind): FundTotals => {
    const mine = all.filter((e) => e.kind === kind);
    const sum = (s: FundStatus) => mine.filter((e) => e.status === s).reduce((a, e) => a + e.amount, 0);
    const seed = sum("seed");
    const confirmed = sum("confirmed");
    return {
      seed,
      confirmed,
      raised: seed + confirmed,
      awaiting: sum("reported"),
      supporters: mine.filter((e) => e.status === "confirmed" || e.status === "seed").length,
    };
  };
  const csr = totals("csr");
  const citizen = totals("citizen");
  const recent = all
    .filter((e) => e.status === "confirmed" || e.status === "seed")
    .sort((a, b) => (b.reviewedAt || b.createdAt).localeCompare(a.reviewedAt || a.createdAt))
    .slice(0, 6)
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      amount: e.amount,
      name: e.status === "seed" ? e.name : e.anonymous ? "Anonymous" : e.kind === "csr" ? e.organisation || e.name : e.name.split(/\s+/)[0] || "Someone",
      seed: e.status === "seed",
      when: e.reviewedAt || e.createdAt,
    }));
  return { csr, citizen, total: csr.raised + citizen.raised, recent };
}
