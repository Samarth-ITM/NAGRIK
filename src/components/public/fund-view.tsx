"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Check,
  Copy,
  HandCoins,
  Landmark,
  Smartphone,
} from "lucide-react";
import type { FundingConfig } from "@/lib/funding/config";
import type { PublicFundingSummary } from "@/lib/funding/ledger";
import { encodeQr, qrSvgPath } from "@/lib/funding/qr";

type Tab = "citizen" | "csr";

const inr = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;
const CITIZEN_AMOUNTS = [100, 250, 500, 1000];
const CSR_AMOUNTS = [50_000, 100_000, 500_000];

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="nk-fund__copy"
      aria-label={`Copy ${label}`}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1600);
          },
          () => {}
        );
      }}
    >
      {done ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function QrCode({ text, label }: { text: string; label: string }) {
  const { path, size } = useMemo(() => qrSvgPath(encodeQr(text)), [text]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="nk-fund__qr" role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#1a120d" />
    </svg>
  );
}

function Totals({ summary }: { summary: PublicFundingSummary }) {
  const max = Math.max(summary.csr.raised, summary.citizen.raised, 1);
  const rows = [
    { key: "csr", label: "Company CSR", t: summary.csr, Icon: Building2 },
    { key: "citizen", label: "Citizens", t: summary.citizen, Icon: HandCoins },
  ] as const;
  const hasSeed = summary.csr.seed + summary.citizen.seed > 0;
  return (
    <div className="nk-fund__totals">
      <p className="nk-fund__total">
        <strong>{inr(summary.total)}</strong> raised for repairs
      </p>
      <ul>
        {rows.map(({ key, label, t, Icon }) => (
          <li key={key}>
            <span className="nk-fund__totals-label">
              <Icon size={16} aria-hidden />
              {label}
            </span>
            <span className="nk-fund__bar" aria-hidden>
              <span style={{ width: `${Math.max(4, (t.raised / max) * 100)}%` }} />
            </span>
            <span className="nk-fund__totals-amt">{inr(t.raised)}</span>
          </li>
        ))}
      </ul>
      {hasSeed && (
        <p className="nk-fund__seed-note">
          Includes seed funding (demo): {inr(summary.csr.seed)} CSR, {inr(summary.citizen.seed)} citizens.
        </p>
      )}
    </div>
  );
}

function Recent({ summary }: { summary: PublicFundingSummary }) {
  if (!summary.recent.length) return null;
  return (
    <div className="nk-fund__recent">
      <h2>Supporters</h2>
      <ul>
        {summary.recent.map((r) => (
          <li key={r.id}>
            <span className="nk-fund__recent-ico">{r.kind === "csr" ? <Building2 size={15} /> : <HandCoins size={15} />}</span>
            <span className="nk-fund__recent-name">{r.name}</span>
            {r.seed && <span className="nk-pill nk-pill--sample">Seed (demo)</span>}
            <span className="nk-fund__recent-amt">{inr(r.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NotReady({ what }: { what: string }) {
  return (
    <div className="nk-fund__notready" role="status">
      {what} are being added by the NGO. Check back soon.
    </div>
  );
}

async function post(body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/funding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success) return { ok: true };
    return { ok: false, error: data?.error || "Couldn't send that. Try again." };
  } catch {
    return { ok: false, error: "Can't reach Nagrik. Check your connection." };
  }
}

function CitizenPanel({ config }: { config: FundingConfig }) {
  const [amount, setAmount] = useState(250);
  const [custom, setCustom] = useState("");
  const [name, setName] = useState("");
  const [utr, setUtr] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!config.upi) return <NotReady what="UPI details" />;
  const upi = config.upi;
  const value = custom ? Math.floor(Number(custom)) : amount;
  const valid = Number.isFinite(value) && value >= 1 && value <= 100000;
  const link =
    `upi://pay?pa=${encodeURIComponent(upi.id)}&pn=${encodeURIComponent(upi.payeeName)}` +
    (valid ? `&am=${value.toFixed(2)}` : "") +
    `&cu=INR&tn=${encodeURIComponent("Nagrik civic repairs")}`;

  return (
    <div className="nk-fund__panel">
      <div className="nk-fund__chips" role="radiogroup" aria-label="Amount">
        {CITIZEN_AMOUNTS.map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={!custom && amount === a}
            className={`nk-fund__chip ${!custom && amount === a ? "is-on" : ""}`}
            onClick={() => {
              setAmount(a);
              setCustom("");
            }}
          >
            {inr(a)}
          </button>
        ))}
        <label className={`nk-fund__chip nk-fund__chip--input ${custom ? "is-on" : ""}`}>
          <span aria-hidden>₹</span>
          <input
            inputMode="numeric"
            placeholder="Other"
            aria-label="Other amount in rupees"
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </label>
      </div>

      <div className="nk-fund__pay">
        <div className="nk-fund__qr-wrap">
          <QrCode text={link} label={`UPI QR code to pay ${valid ? inr(value) : ""} to ${upi.payeeName}`} />
          <span>Scan with any UPI app</span>
        </div>
        <div className="nk-fund__pay-side">
          <a href={valid ? link : undefined} aria-disabled={!valid} className="nk-btn nk-btn--kerb nk-fund__upi-btn">
            <Smartphone size={18} aria-hidden />
            Pay {valid ? inr(value) : ""} with UPI
          </a>
          <div className="nk-fund__field">
            <span>UPI ID</span>
            <code>{upi.id}</code>
            <CopyButton value={upi.id} label="UPI ID" />
          </div>
          <div className="nk-fund__field">
            <span>Paying</span>
            <strong>{upi.payeeName}</strong>
          </div>
        </div>
      </div>

      {done ? (
        <p className="nk-fund__thanks" role="status">
          <BadgeCheck size={18} aria-hidden /> Thank you. It shows up once the NGO sees it in their account.
        </p>
      ) : (
        <form
          className="nk-fund__form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setSending(true);
            const r = await post({ kind: "citizen", amount: value, name: name.trim(), reference: utr.trim() });
            setSending(false);
            if (r.ok) setDone(true);
            else setError(r.error || "");
          }}
        >
          <h3>Paid? Add it to the tally</h3>
          <div className="nk-fund__row">
            <label>
              <span>UPI reference (UTR)</span>
              <input
                required
                inputMode="numeric"
                pattern="\d{12}"
                maxLength={12}
                placeholder="12 digits"
                value={utr}
                onChange={(e) => setUtr(e.target.value.replace(/\D/g, "").slice(0, 12))}
              />
            </label>
            <label>
              <span>Name (optional)</span>
              <input maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Anonymous" />
            </label>
          </div>
          {error && <p className="nk-fund__error" role="alert">{error}</p>}
          <button type="submit" className="nk-btn nk-btn--ghost-dark" disabled={sending || !valid || utr.length !== 12}>
            {sending ? "Sending" : `I paid ${valid ? inr(value) : ""}`}
          </button>
        </form>
      )}
    </div>
  );
}

function CsrPanel({ config }: { config: FundingConfig }) {
  const [form, setForm] = useState({ organisation: "", name: "", email: "", phone: "", amount: "100000", reference: "", message: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (!config.bank) return <NotReady what="Bank details" />;
  const b = config.bank;
  const rows: { label: string; value: string; copy?: boolean }[] = [
    { label: "Account name", value: b.accountName, copy: true },
    { label: "Account number", value: b.accountNumber, copy: true },
    { label: "IFSC", value: b.ifsc, copy: true },
    { label: "Bank", value: b.bankName },
    ...(b.branch ? [{ label: "Branch", value: b.branch }] : []),
    ...(b.accountType ? [{ label: "Account type", value: b.accountType }] : []),
    ...config.registrations.map((r) => ({ label: r.label, value: r.value, copy: true })),
  ];

  return (
    <div className="nk-fund__panel">
      <dl className="nk-fund__bank">
        {rows.map((r) => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd>
              <code>{r.value}</code>
              {r.copy && <CopyButton value={r.value} label={r.label} />}
            </dd>
          </div>
        ))}
      </dl>
      {config.contactEmail && (
        <p className="nk-fund__contact">
          CSR agreement and utilisation reports: <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>
        </p>
      )}

      {done ? (
        <p className="nk-fund__thanks" role="status">
          <BadgeCheck size={18} aria-hidden /> Received. The NGO will email you to confirm.
        </p>
      ) : (
        <form
          className="nk-fund__form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setSending(true);
            const r = await post({ kind: "csr", ...form, amount: Number(form.amount) });
            setSending(false);
            if (r.ok) setDone(true);
            else setError(r.error || "");
          }}
        >
          <h3>Pledge or report a transfer</h3>
          <div className="nk-fund__chips" role="radiogroup" aria-label="Amount">
            {CSR_AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={form.amount === String(a)}
                className={`nk-fund__chip ${form.amount === String(a) ? "is-on" : ""}`}
                onClick={() => setForm((f) => ({ ...f, amount: String(a) }))}
              >
                {inr(a)}
              </button>
            ))}
            <label className={`nk-fund__chip nk-fund__chip--input ${CSR_AMOUNTS.map(String).includes(form.amount) ? "" : "is-on"}`}>
              <span aria-hidden>₹</span>
              <input
                inputMode="numeric"
                placeholder="Other"
                aria-label="Other amount in rupees"
                value={CSR_AMOUNTS.map(String).includes(form.amount) ? "" : form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value.replace(/\D/g, "").slice(0, 9) }))}
              />
            </label>
          </div>
          <div className="nk-fund__row">
            <label>
              <span>Company</span>
              <input required minLength={2} maxLength={120} value={form.organisation} onChange={set("organisation")} />
            </label>
            <label>
              <span>Contact name</span>
              <input required minLength={2} maxLength={80} value={form.name} onChange={set("name")} />
            </label>
          </div>
          <div className="nk-fund__row">
            <label>
              <span>Work email</span>
              <input required type="email" maxLength={120} value={form.email} onChange={set("email")} />
            </label>
            <label>
              <span>Phone (optional)</span>
              <input type="tel" maxLength={20} value={form.phone} onChange={set("phone")} />
            </label>
          </div>
          <label>
            <span>Bank reference, if already sent (optional)</span>
            <input maxLength={40} value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value.replace(/[^A-Za-z0-9-]/g, "") }))} />
          </label>
          {error && <p className="nk-fund__error" role="alert">{error}</p>}
          <button type="submit" className="nk-btn nk-btn--kerb" disabled={sending || Number(form.amount) < 1000}>
            {sending ? "Sending" : `Pledge ${Number(form.amount) >= 1000 ? inr(Number(form.amount)) : ""}`}
          </button>
        </form>
      )}
    </div>
  );
}

export function FundView({
  config,
  summary,
  initialTab,
}: {
  config: FundingConfig;
  summary: PublicFundingSummary;
  initialTab: Tab;
}) {
  // Tabs are plain links (/fund?type=…), so they work even before the page's script loads.
  const tab = initialTab;

  return (
    <main className="nk-fund">
      <div className="nk-fund__inner">
        <Link href="/" className="nk-fund__back">
          <ArrowLeft size={16} aria-hidden /> Home
        </Link>
        <h1 className="nk-h2">Fund repairs</h1>
        {config.beneficiary && (
          <p className="nk-fund__to">
            <Landmark size={16} aria-hidden /> Goes straight to <strong>{config.beneficiary}</strong>
          </p>
        )}

        <div className="nk-fund__layout">
          <div>
            <div className="nk-fund__tabs" role="tablist" aria-label="Who is giving">
              <Link
                href="/fund?type=citizen"
                replace
                scroll={false}
                role="tab"
                aria-selected={tab === "citizen"}
                className={`nk-fund__tab ${tab === "citizen" ? "is-on" : ""}`}
              >
                <HandCoins size={22} aria-hidden />
                <span>
                  <strong>Citizen</strong>
                  <small>UPI</small>
                </span>
              </Link>
              <Link
                href="/fund?type=csr"
                replace
                scroll={false}
                role="tab"
                aria-selected={tab === "csr"}
                className={`nk-fund__tab ${tab === "csr" ? "is-on" : ""}`}
              >
                <Building2 size={22} aria-hidden />
                <span>
                  <strong>Company CSR</strong>
                  <small>Bank transfer</small>
                </span>
              </Link>
            </div>
            <div role="tabpanel" key={tab}>{tab === "citizen" ? <CitizenPanel config={config} /> : <CsrPanel config={config} />}</div>
          </div>

          <aside className="nk-fund__side">
            <Totals summary={summary} />
            <Recent summary={summary} />
          </aside>
        </div>
      </div>
    </main>
  );
}
