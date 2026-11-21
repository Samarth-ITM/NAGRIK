"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Eye,
  EyeOff,
  ImageIcon,
  Loader2,
  Lock,
  LogOut,
  Send,
  Upload,
  User,
  Wrench,
  X,
} from "lucide-react";
import { PUBLIC_BOT_URL, PUBLIC_BOT_USERNAME } from "@/lib/telegram/public";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** Parse a fetch response as JSON without throwing on HTML/empty bodies. */
async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

type Ticket = {
  id?: string;
  ticket_code: string;
  category?: string;
  description?: string | null;
  review_status?: string;
  photo_url?: string | null;
  fixed_by?: string | null;
  resolution_note?: string | null;
  after_photo_url?: string | null;
  ward?: string;
  police_station?: string;
  police_phone?: string;
  police_address?: string;
  created_at?: string;
};

const JOURNEY = ["Reported", "Picked up", "Repaired", "Verified"] as const;

/** How far along the 4-stage journey a report is (0-based index of the latest completed stage). */
function journeyStep(t: Ticket): number {
  if (t.review_status === "resolved") return 3;
  if (t.fixed_by) return 2;
  if (t.review_status === "verified" || t.review_status === "under_review") return 1;
  return 0;
}

function stagePill(step: number) {
  if (step === 3)
    return (
      <span className="nk-pill nk-pill--done">
        <BadgeCheck size={14} aria-hidden /> Fixed and verified
      </span>
    );
  if (step === 2)
    return (
      <span className="nk-pill nk-pill--check">
        <Wrench size={14} aria-hidden /> Repaired, awaiting check
      </span>
    );
  if (step === 1) return <span className="nk-pill nk-pill--open">Picked up</span>;
  return <span className="nk-pill nk-pill--open">Waiting for a team</span>;
}

const DEMO_ORGS = [
  {
    name: "Kharghar Citizens Welfare Forum",
    logo: "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=120&q=80",
  },
  {
    name: "Sector 4 Civic Action & Sanitation Team",
    logo: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=120&q=80",
  },
];

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export function LoginForm({ initialRole = "citizen" }: { initialRole?: "citizen" | "ngo" }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"citizen" | "ngo">(initialRole);

  // Citizen
  const [citizenName, setCitizenName] = useState("");
  const [citizenPassword, setCitizenPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [citizenError, setCitizenError] = useState("");
  const [citizenLoading, setCitizenLoading] = useState(false);
  
  const [signedInName, setSignedInName] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // NGO
  const [ngoName, setNgoName] = useState("Kharghar Citizens Welfare Forum");
  const [ngoPassword, setNgoPassword] = useState("");
  const [ngoLogo, setNgoLogo] = useState<string>("");
  const [ngoSaving, setNgoSaving] = useState(false);
  const [ngoError, setNgoError] = useState("");

  useEffect(() => {
    // Remove the old insecure plaintext-password storage from earlier versions.
    try {
      localStorage.removeItem("nagrik_citizen_pass");
      localStorage.removeItem("nagrik_citizen_name");
    } catch {
      /* storage unavailable */
    }

    fetch("/api/citizen/auth", { cache: "no-store" })
      .then(readJson)
      .then((data) => {
        if (data?.success && data?.citizen?.name) {
          setSignedInName(data.citizen.name);
          setTickets(Array.isArray(data.tickets) ? data.tickets : []);
        }
      })
      .catch(() => {});

    fetch("/api/ngo/profile")
      .then(readJson)
      .then((data) => {
        if (data?.success && data.profile) {
          if (data.profile.name) setNgoName(data.profile.name);
          if (data.profile.logoUrl) setNgoLogo(data.profile.logoUrl);
        }
      })
      .catch(() => {});
  }, []);

  const handleCitizenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCitizenError("");
    if (citizenName.trim().length < 2) {
      setCitizenError("Enter the full name you registered on the Telegram bot.");
      return;
    }
    if (!citizenPassword) {
      setCitizenError("Enter your bot password.");
      return;
    }

    setCitizenLoading(true);
    try {
      const res = await fetch("/api/citizen/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: citizenName.trim(), password: citizenPassword }),
      });
      const data = await readJson(res);
      if (!res.ok || !data?.success) {
        setCitizenError(
          data?.error ||
            (res.status >= 500
              ? "Sign-in is temporarily unavailable. Try again in a minute."
              : "That name and password don't match.")
        );
        return;
      }
      setSignedInName(data.citizen?.name || citizenName.trim());
      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
      setCitizenPassword("");
    } catch {
      setCitizenError("Can't reach Nagrik. Check your internet connection and try again.");
    } finally {
      setCitizenLoading(false);
    }
  };

  const handleCitizenLogout = async () => {
    try {
      await fetch("/api/citizen/auth", { method: "DELETE" });
    } catch {
      /* cookie expires anyway */
    }
    setSignedInName(null);
    setTickets([]);
    setCitizenName("");
    setCitizenPassword("");
    setCitizenError("");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setNgoError("That logo is over 3 MB. Choose a smaller image.");
      return;
    }
    setNgoError("");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setNgoLogo(reader.result);
    };
    reader.onerror = () => setNgoError("Couldn't read that image. Try a PNG or JPG.");
    reader.readAsDataURL(file);
  };

  const saveNgoAndOpen = async (name: string, logo?: string) => {
    setNgoSaving(true);
    setNgoError("");
    try {
      localStorage.setItem("nagrik_ngo_name", name);
      if (logo) localStorage.setItem("nagrik_ngo_logo", logo);
    } catch {
      /* storage full or unavailable — the server profile still saves */
    }
    try {
      const res = await fetch("/api/ngo/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, logoUrl: logo }),
      });
      const data = await readJson(res);
      if (!res.ok || !data?.success) {
        setNgoError(data?.error || "Couldn't save your NGO profile. Try again.");
        setNgoSaving(false);
        return;
      }
      router.push("/ngo");
    } catch {
      setNgoError("Can't reach Nagrik. Check your internet connection and try again.");
      setNgoSaving(false);
    }
  };

  const handleNgoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = ngoName.trim();
    if (finalName.length < 2) {
      setNgoError("Enter your organisation's name.");
      return;
    }
    saveNgoAndOpen(finalName, ngoLogo || undefined);
  };

  const wide = activeTab === "citizen" && Boolean(signedInName);

  return (
    <main className="nk-auth">
      <div className={`nk-auth__wrap${wide ? " nk-auth__wrap--wide" : ""}`}>
        <Link href="/" className="nk-back">
          <ArrowLeft size={16} aria-hidden />
          Back to home
        </Link>

        <div className="nk-ticket">
          <div className="nk-ticket__main">
            <div role="tablist" aria-label="Sign in as" className="nk-seg">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "citizen"}
                onClick={() => setActiveTab("citizen")}
              >
                <User size={16} aria-hidden />
                Citizen
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "ngo"}
                onClick={() => setActiveTab("ngo")}
              >
                <Building2 size={16} aria-hidden />
                NGO team
              </button>
            </div>

            {/* ============================ CITIZEN ============================ */}
            {activeTab === "citizen" &&
              (!signedInName ? (
                <>
                  <h1 className="nk-auth__title">Track your reports</h1>
                  <p className="nk-auth__lede">Sign in with the name and password you set on the Telegram bot.</p>

                  <form onSubmit={handleCitizenSubmit} className="nk-form" noValidate>
                    {citizenError && (
                      <div role="alert" className="nk-error">
                        {citizenError}
                      </div>
                    )}

                    <div>
                      <label htmlFor="citizen-name" className="nk-label">
                        Full name
                      </label>
                      <div className="nk-field">
                        <User aria-hidden />
                        <input
                          id="citizen-name"
                          type="text"
                          autoComplete="username"
                          value={citizenName}
                          onChange={(e) => setCitizenName(e.target.value)}
                          placeholder="As registered on the bot"
                          className="nk-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="citizen-pass" className="nk-label">
                        Bot password
                      </label>
                      <div className="nk-field">
                        <Lock aria-hidden />
                        <input
                          id="citizen-pass"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          value={citizenPassword}
                          onChange={(e) => setCitizenPassword(e.target.value)}
                          className="nk-input nk-input--pad-right"
                        />
                        <button
                          type="button"
                          className="nk-field__toggle"
                          onClick={() => setShowPassword((s) => !s)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <button type="submit" disabled={citizenLoading} className="nk-btn nk-btn--kerb nk-btn--block">
                      {citizenLoading && <Loader2 size={18} className="nk-spin" aria-hidden />}
                      {citizenLoading ? "Signing in" : "Sign in"}
                    </button>
                  </form>
                </>
              ) : (
                /* ---------- signed in ---------- */
                <>
                  <div className="nk-account" style={{ marginTop: "1.75rem" }}>
                    <div>
                      <p className="nk-account__label">Signed in as</p>
                      <h1 className="nk-account__name">{signedInName}</h1>
                    </div>
                    <button type="button" onClick={handleCitizenLogout} className="nk-signout">
                      <LogOut size={16} aria-hidden />
                      Sign out
                    </button>
                  </div>

                  <h2 className="nk-section-title">
                    Your reports <span>({tickets.length})</span>
                  </h2>

                  {tickets.length === 0 ? (
                    <div className="nk-empty">
                      <p>No reports yet</p>
                      <p>Send the bot a photo and your location to log your first issue.</p>
                    </div>
                  ) : (
                    <ul className="nk-reports">
                      {tickets.map((t) => {
                        const step = journeyStep(t);
                        return (
                          <li key={t.id || t.ticket_code} className="nk-report">
                            <div className="nk-report__head">
                              <div>
                                <p className="nk-report__cat">{t.category || "Civic issue"}</p>
                                <p className="nk-report__code">
                                  Ticket {t.ticket_code}
                                  {t.created_at ? `, reported ${formatDate(t.created_at)}` : ""}
                                </p>
                              </div>
                              <div>{stagePill(step)}</div>
                            </div>

                            {(t.ward || t.police_station) && (
                              <div className="nk-report__jurisdiction">
                                {t.ward && (
                                  <span className="nk-pill-ward">
                                    🏛️ {t.ward}
                                  </span>
                                )}
                                {t.police_station && (
                                  <span className="nk-pill-police">
                                    👮 {t.police_station}
                                    {t.police_phone && (
                                      <a
                                        href={`tel:${t.police_phone.replace(/[^0-9]/g, "")}`}
                                        title="Call Police Station Desk"
                                      >
                                        📞 {t.police_phone}
                                      </a>
                                    )}
                                  </span>
                                )}
                              </div>
                            )}

                            <ol className="nk-journey" aria-label="Progress">
                              {JOURNEY.map((label, i) => (
                                <li
                                  key={label}
                                  data-done={i <= step}
                                  data-current={i === step + 1}
                                  aria-current={i === step ? "step" : undefined}
                                >
                                  {label}
                                </li>
                              ))}
                            </ol>

                            {t.description && <p className="nk-report__desc">{t.description}</p>}

                            {(t.photo_url || t.after_photo_url) && (
                              <div className="nk-photos">
                                {t.photo_url && (
                                  <a href={t.photo_url} target="_blank" rel="noopener noreferrer" className="nk-photo">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={t.photo_url} alt="Your photo of the issue" />
                                    <span>Before</span>
                                  </a>
                                )}
                                {t.after_photo_url && (
                                  <a
                                    href={t.after_photo_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="nk-photo nk-photo--after"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={t.after_photo_url} alt="After repair" />
                                    <span>After</span>
                                  </a>
                                )}
                              </div>
                            )}

                            {t.fixed_by && (
                              <p className="nk-report__fixed">
                                Repaired by <strong>{t.fixed_by}</strong>
                                {t.resolution_note ? `: ${t.resolution_note}` : ""}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              ))}

            {/* ============================== NGO ============================== */}
            {activeTab === "ngo" && (
              <>
                <h1 className="nk-auth__title">Field desk sign-in</h1>
                <p className="nk-auth__lede">
                  See reported issues, log repairs and upload after-photos. Your logo appears on every fix you post.
                </p>

                <form onSubmit={handleNgoSubmit} className="nk-form" noValidate>
                  {ngoError && (
                    <div role="alert" className="nk-error">
                      {ngoError}
                    </div>
                  )}

                  <div>
                    <label htmlFor="ngo-name" className="nk-label">
                      Organisation name
                    </label>
                    <div className="nk-field">
                      <Building2 aria-hidden />
                      <input
                        id="ngo-name"
                        type="text"
                        value={ngoName}
                        onChange={(e) => setNgoName(e.target.value)}
                        className="nk-input"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="nk-label">Logo</span>
                    <div className="nk-logo-drop">
                      <div className="nk-logo-drop__preview">
                        {ngoLogo ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ngoLogo} alt="Logo preview" />
                            <button
                              type="button"
                              className="nk-logo-drop__remove"
                              onClick={() => setNgoLogo("")}
                              aria-label="Remove logo"
                            >
                              <X size={12} />
                            </button>
                          </>
                        ) : (
                          <ImageIcon size={22} aria-hidden />
                        )}
                      </div>
                      <div>
                        <label className="nk-upload">
                          <Upload size={16} aria-hidden />
                          {ngoLogo ? "Replace logo" : "Upload logo"}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            onChange={handleLogoUpload}
                            className="sr-only"
                          />
                        </label>
                        <p className="nk-hint">PNG, JPG, SVG or WebP, up to 3 MB</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="ngo-pass" className="nk-label">
                      Field access password
                    </label>
                    <div className="nk-field">
                      <Lock aria-hidden />
                      <input
                        id="ngo-pass"
                        type="password"
                        autoComplete="current-password"
                        value={ngoPassword}
                        onChange={(e) => setNgoPassword(e.target.value)}
                        className="nk-input"
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={ngoSaving} className="nk-btn nk-btn--sign nk-btn--block">
                    {ngoSaving && <Loader2 size={18} className="nk-spin" aria-hidden />}
                    {ngoSaving ? "Opening field desk" : "Open field desk"}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Tear-off stub */}
          <div className="nk-ticket__perf" aria-hidden />
          <div className="nk-ticket__stub">
            {activeTab === "ngo" ? (
              <>
                <p className="nk-stub__title">Try a demo organisation</p>
                <div className="nk-org-list">
                  {DEMO_ORGS.map((o) => (
                    <button
                      key={o.name}
                      type="button"
                      disabled={ngoSaving}
                      className="nk-org"
                      onClick={() => {
                        setNgoName(o.name);
                        setNgoLogo(o.logo);
                        saveNgoAndOpen(o.name, o.logo);
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={o.logo} alt="" />
                      {o.name}
                    </button>
                  ))}
                </div>
              </>
            ) : signedInName ? (
              <a href={PUBLIC_BOT_URL} target="_blank" rel="noopener noreferrer" className="nk-btn nk-btn--kerb nk-btn--block">
                <Send size={18} aria-hidden />
                Report a new issue on Telegram
              </a>
            ) : (
              <div className="nk-stub">
                <div className="nk-stub__icon">
                  <Send size={18} aria-hidden />
                </div>
                <div>
                  <p className="nk-stub__title">New to Nagrik?</p>
                  <p className="nk-stub__text">
                    Open{" "}
                    <a href={PUBLIC_BOT_URL} target="_blank" rel="noopener noreferrer" className="nk-link">
                      @{PUBLIC_BOT_USERNAME}
                    </a>{" "}
                    on Telegram. It asks you to pick a name and password the first time. Use those here.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
