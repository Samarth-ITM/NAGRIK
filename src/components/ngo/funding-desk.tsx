"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Check, HandCoins, Undo2, X } from "lucide-react";

interface Entry {
  id: string;
  kind: "csr" | "citizen";
  amount: number;
  name: string;
  organisation: string | null;
  email: string | null;
  phone: string | null;
  reference: string | null;
  status: "reported" | "confirmed" | "rejected";
  createdAt: string;
}

const inr = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;

/** NGO desk: confirm money once it shows up in the account. Only confirmed entries count as raised. */
export function FundingDesk() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/funding/ledger", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) setEntries(d.entries);
        else setError(d?.error || "Couldn't load funding.");
      })
      .catch(() => setError("Couldn't load funding."));
  }, []);
  useEffect(load, [load]);

  const review = async (id: string, status: Entry["status"]) => {
    setBusy(id);
    try {
      const r = await fetch("/api/funding/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const d = await r.json();
      if (d?.success) setEntries((list) => (list || []).map((e) => (e.id === id ? { ...e, status } : e)));
      else setError(d?.error || "Couldn't save.");
    } catch {
      setError("Couldn't save.");
    }
    setBusy(null);
  };

  const waiting = (entries || []).filter((e) => e.status === "reported");
  const reviewed = (entries || []).filter((e) => e.status !== "reported").slice(0, 8);

  return (
    <section aria-label="Funding" className="mt-8 rounded-2xl border border-slate-200 bg-white">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">Funding to check</h2>
        <span className="text-sm text-slate-600">{entries ? `${waiting.length} waiting` : "Loading"}</span>
      </div>
      {error && <p className="px-5 pt-3 text-sm text-red-700">{error}</p>}
      {entries && entries.length === 0 && <p className="px-5 py-4 text-sm text-slate-600">No contributions reported yet.</p>}
      <ul className="divide-y divide-slate-100">
        {[...waiting, ...reviewed].map((e) => (
          <li key={e.id} className="px-5 py-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              {e.kind === "csr" ? <Building2 className="w-4 h-4" /> : <HandCoins className="w-4 h-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-slate-900">{e.kind === "csr" ? e.organisation : e.name}</span>
              <span className="block text-slate-600 truncate">
                {e.kind === "csr" ? `${e.name} · ${e.email}${e.phone ? ` · ${e.phone}` : ""}` : "UPI"}
                {e.reference ? ` · Ref ${e.reference}` : e.kind === "csr" ? " · Pledge" : ""}
              </span>
            </span>
            <span className="font-bold text-slate-900">{inr(e.amount)}</span>
            {e.status === "reported" ? (
              <span className="flex gap-2">
                <button
                  type="button"
                  disabled={busy === e.id}
                  onClick={() => review(e.id, "confirmed")}
                  className="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-60"
                >
                  <Check className="w-4 h-4" aria-hidden /> Received
                </button>
                <button
                  type="button"
                  disabled={busy === e.id}
                  onClick={() => review(e.id, "rejected")}
                  className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-slate-300 text-slate-700 font-semibold disabled:opacity-60"
                >
                  <X className="w-4 h-4" aria-hidden /> Not found
                </button>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className={e.status === "confirmed" ? "text-emerald-700 font-semibold" : "text-slate-500"}>
                  {e.status === "confirmed" ? "Received" : "Not found"}
                </span>
                <button
                  type="button"
                  disabled={busy === e.id}
                  onClick={() => review(e.id, "reported")}
                  aria-label="Undo"
                  className="inline-flex items-center h-8 px-2 rounded-lg text-slate-500 hover:text-slate-800"
                >
                  <Undo2 className="w-4 h-4" aria-hidden />
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
