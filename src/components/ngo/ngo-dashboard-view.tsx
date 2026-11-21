/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  ImagePlus,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { VoiceRecorderInput } from "./voice-recorder-input";
import { statusLabel } from "@/components/shared/status-badge";

interface NGOIssue {
  id: string;
  code: string;
  title: string;
  category_name: string;
  issue_type_id: string;
  description: string;
  latitude: number;
  longitude: number;
  location_name: string;
  status: "NEW" | "IN_PROGRESS" | "ASSIGNED" | "RESOLUTION_SUBMITTED" | "RESOLVED" | string;
  source: string;
  is_live: boolean;
  before_photo_url: string | null;
  after_photo_url?: string | null;
  resolution_note?: string | null;
  fixed_by?: string | null;
  fixed_at?: string | null;
  created_at: string;
  updated_at: string;
}

type Filter = "TODO" | "SUBMITTED" | "ALL";

const isDone = (s: string) => s === "RESOLUTION_SUBMITTED" || s === "RESOLVED";

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Resize a phone photo before upload (max 1600px, JPEG) so field uploads stay fast. */
async function prepareImage(file: File): Promise<string> {
  const asDataUrl = () =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => (typeof r.result === "string" ? resolve(r.result) : reject(new Error("read failed")));
      r.onerror = () => reject(new Error("read failed"));
      r.readAsDataURL(file);
    });

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("decode failed"));
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return asDataUrl();
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    // Formats the browser can't decode (e.g. some HEIC): upload as-is.
    return asDataUrl();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function StatusDot({ status }: { status: string }) {
  const done = status === "RESOLVED";
  const submitted = status === "RESOLUTION_SUBMITTED";
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        aria-hidden
        className={`w-2 h-2 rounded-full ${done ? "bg-emerald-600" : submitted ? "bg-emerald-500 ring-2 ring-emerald-100" : "bg-brand-500"}`}
      />
      <span className={done || submitted ? "text-emerald-800" : "text-slate-600"}>
        {done ? "Fixed" : submitted ? "Repair submitted" : "To fix"}
      </span>
    </span>
  );
}

export function NGODashboardView() {
  const [issues, setIssues] = useState<NGOIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("TODO");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [ngoName, setNgoName] = useState("Your NGO");
  const [ngoLogo, setNgoLogo] = useState("");

  const [fixPhoto, setFixPhoto] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [fixNote, setFixNote] = useState("");
  const [fixError, setFixError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState<string | null>(null);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/ngo/issues", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || "load failed");
      setIssues(Array.isArray(data.issues) ? data.issues : []);
    } catch {
      setLoadError("Reports couldn't load. Check your connection and refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIssues();

    // The saved server profile is the source of truth; the browser copy is only a fallback.
    let storedName: string | null = null;
    let storedLogo: string | null = null;
    try {
      storedName = localStorage.getItem("nagrik_ngo_name");
      storedLogo = localStorage.getItem("nagrik_ngo_logo");
    } catch {
      /* storage unavailable */
    }
    fetch("/api/ngo/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && data.profile?.name) {
          setNgoName(data.profile.name);
          setNgoLogo(data.profile.logoUrl || "");
          try {
            localStorage.setItem("nagrik_ngo_name", data.profile.name);
            if (data.profile.logoUrl) localStorage.setItem("nagrik_ngo_logo", data.profile.logoUrl);
            else localStorage.removeItem("nagrik_ngo_logo");
          } catch {
            /* storage full or unavailable */
          }
        } else {
          if (storedName) setNgoName(storedName);
          if (storedLogo) setNgoLogo(storedLogo);
        }
      })
      .catch(() => {
        if (storedName) setNgoName(storedName);
        if (storedLogo) setNgoLogo(storedLogo);
      });
  }, [loadIssues]);

  const counts = useMemo(
    () => ({
      TODO: issues.filter((i) => !isDone(i.status)).length,
      SUBMITTED: issues.filter((i) => isDone(i.status)).length,
      ALL: issues.length,
    }),
    [issues]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues
      .filter((i) => (filter === "TODO" ? !isDone(i.status) : filter === "SUBMITTED" ? isDone(i.status) : true))
      .filter(
        (i) =>
          !q ||
          [i.title, i.code, i.description, i.location_name, i.category_name].some((v) =>
            (v || "").toLowerCase().includes(q)
          )
      )
      .sort((a, b) => {
        // Real reports first, newest first.
        if (a.is_live !== b.is_live) return a.is_live ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [issues, filter, search]);

  // Keep a valid selection. A report you just submitted stays open even though it
  // leaves the "To fix" list, so you see the confirmation.
  useEffect(() => {
    if (!selectedId || !issues.some((i) => i.id === selectedId)) {
      setSelectedId(visible[0]?.id ?? null);
    }
  }, [issues, visible, selectedId]);

  // Changing the filter or search jumps to the first matching report.
  useEffect(() => {
    setSelectedId(visible[0]?.id ?? null);
    setJustSubmitted(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search]);

  const selected = issues.find((i) => i.id === selectedId) || null;

  // Reset the proof form whenever the selected report changes.
  useEffect(() => {
    setFixPhoto(selected?.after_photo_url || "");
    setFixNote(selected?.resolution_note || "");
    setFixError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const choose = (id: string) => {
    setSelectedId(id);
    setMobileOpen(true);
    setJustSubmitted(null);
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFixError("That file isn't a photo. Choose a JPG or PNG.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setFixError("That photo is over 20 MB. Choose a smaller one.");
      return;
    }
    setPhotoBusy(true);
    setFixError(null);
    try {
      setFixPhoto(await prepareImage(file));
    } catch {
      setFixError("Couldn't read that photo. Try taking it again.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const submitFix = async () => {
    if (!selected) return;
    setFixError(null);
    if (!fixPhoto) {
      setFixError("Add an after-repair photo. It's the proof residents see.");
      return;
    }
    if (!fixNote.trim()) {
      setFixError("Say what was done, by voice or in writing.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/ngo/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          afterPhotoUrl: fixPhoto,
          resolutionNote: fixNote.trim(),
          fixedBy: ngoName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || "submit failed");
      const now = new Date().toISOString();
      setIssues((prev) =>
        prev.map((i) =>
          i.id === selected.id
            ? {
                ...i,
                status: "RESOLUTION_SUBMITTED",
                after_photo_url: fixPhoto,
                resolution_note: fixNote.trim(),
                fixed_by: ngoName,
                fixed_at: now,
                updated_at: now,
              }
            : i
        )
      );
      setJustSubmitted(selected.id);
    } catch {
      setFixError("Couldn't submit. Check your connection and try again; nothing was lost.");
    } finally {
      setSubmitting(false);
    }
  };

  const TABS: { key: Filter; label: string }[] = [
    { key: "TODO", label: "To fix" },
    { key: "SUBMITTED", label: "Submitted" },
    { key: "ALL", label: "All" },
  ];

  return (
    <div className="flex-1 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:py-10">
        {/* Desk header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 text-[15px] text-slate-600">
              {ngoLogo ? (
                <img src={ngoLogo} alt="" className="w-7 h-7 rounded-lg object-cover ring-1 ring-slate-200" />
              ) : (
                <span className="w-7 h-7 rounded-lg bg-brand-500 text-slate-900 text-xs font-bold flex items-center justify-center">
                  {ngoName
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase())
                    .join("")}
                </span>
              )}
              <span className="font-semibold text-slate-800">{ngoName}</span>
              <Link href="/login?role=ngo" className="text-brand-700 underline underline-offset-4 decoration-brand-300">
                Edit profile
              </Link>
            </div>
            <h1 className="mt-3 font-serif text-4xl sm:text-5xl tracking-tight text-slate-900">Field desk</h1>
            <p className="mt-2 text-base text-slate-600">
              {loading
                ? "Loading reports"
                : counts.TODO === 0
                ? "Nothing waiting. Every report has a repair submitted."
                : `${counts.TODO} report${counts.TODO === 1 ? "" : "s"} in Sector 4, Kharghar waiting for a repair.`}
            </p>
          </div>
          <button
            type="button"
            onClick={loadIssues}
            disabled={loading}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:border-slate-400 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            Refresh
          </button>
        </div>

        {loadError && (
          <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {loadError}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
          {/* Queue */}
          <section
            aria-label="Reports"
            className={`min-w-0 rounded-2xl border border-slate-200 bg-white ${mobileOpen ? "hidden lg:block" : ""}`}
          >
            <div className="p-3 border-b border-slate-200 space-y-3">
              <label className="relative block">
                <span className="sr-only">Search reports</span>
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by ticket, problem or place"
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-400 focus:bg-white"
                />
              </label>
              <div role="tablist" aria-label="Filter reports" className="grid grid-cols-3 p-1 rounded-xl bg-slate-100">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={filter === t.key}
                    onClick={() => setFilter(t.key)}
                    className={`h-9 rounded-lg text-sm font-semibold transition-colors ${
                      filter === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {t.label} <span className="text-slate-400 font-medium">{counts[t.key]}</span>
                  </button>
                ))}
              </div>
            </div>

            <ul className="p-2 lg:max-h-[calc(100vh-17rem)] overflow-y-auto">
              {loading && issues.length === 0 &&
                Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="flex gap-3 p-3">
                    <div className="w-14 h-14 rounded-xl bg-slate-100" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3.5 w-2/3 rounded bg-slate-100" />
                      <div className="h-3 w-1/2 rounded bg-slate-100" />
                    </div>
                  </li>
                ))}

              {!loading && visible.length === 0 && (
                <li className="px-4 py-12 text-center">
                  <p className="font-semibold text-slate-800">
                    {search ? "No reports match that search" : filter === "TODO" ? "Nothing to fix right now" : "No reports here yet"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {search ? "Try a ticket number or a street name." : "New Telegram reports appear here automatically."}
                  </p>
                </li>
              )}

              {visible.map((i) => {
                const active = i.id === selectedId;
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => choose(i.id)}
                      aria-current={active ? "true" : undefined}
                      className={`w-full flex gap-3 p-3 rounded-xl text-left transition-colors ${
                        active ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-slate-50"
                      }`}
                    >
                      {i.before_photo_url ? (
                        <img src={i.before_photo_url} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0 bg-slate-100" />
                      ) : (
                        <span className="w-14 h-14 rounded-xl shrink-0 bg-slate-100 flex items-center justify-center text-slate-400">
                          <MapPin className="w-5 h-5" aria-hidden />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="font-semibold text-[15px] text-slate-900 truncate">{i.title}</span>
                          {!i.is_live && (
                            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">Sample</span>
                          )}
                        </span>
                        <span className="block mt-0.5 text-sm text-slate-500 truncate">
                          {i.location_name}, {timeAgo(i.created_at)}
                        </span>
                        <span className="block mt-1">
                          <StatusDot status={i.status} />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Detail */}
          <section
            aria-label="Selected report"
            className={`min-w-0 rounded-2xl border border-slate-200 bg-white ${mobileOpen ? "" : "hidden lg:block"}`}
          >
            {!selected ? (
              <div className="px-6 py-24 text-center text-slate-500">
                {loading ? "Loading reports" : "Pick a report from the list to see it here."}
              </div>
            ) : (
              <article className="p-5 sm:p-7">
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="lg:hidden mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600"
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden />
                  All reports
                </button>

                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-2xl sm:text-[1.75rem] font-bold tracking-tight text-slate-900">{selected.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Ticket <span className="font-medium text-slate-700 tabular-nums">{selected.code}</span>,{" "}
                      {selected.category_name}.{" "}
                      {selected.is_live ? `Reported ${timeAgo(selected.created_at)} on Telegram.` : "Sample data."}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center h-8 px-3 rounded-full text-sm font-semibold ${
                      isDone(selected.status) ? "bg-emerald-50 text-emerald-800" : "bg-brand-50 text-brand-800"
                    }`}
                  >
                    {isDone(selected.status) ? statusLabel(selected.status) : "To fix"}
                  </span>
                </div>

                {/* Before / after */}
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <figure>
                    <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                      {selected.before_photo_url ? (
                        <a href={selected.before_photo_url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                          <img src={selected.before_photo_url} alt="Photo sent by the resident" className="w-full h-full object-cover" />
                        </a>
                      ) : (
                        <span className="text-sm text-slate-500 px-4 text-center">No photo was sent with this report</span>
                      )}
                    </div>
                    <figcaption className="mt-2 text-sm text-slate-500">Before, from the resident</figcaption>
                  </figure>
                  <figure>
                    <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center">
                      {fixPhoto ? (
                        <img src={fixPhoto} alt="After-repair photo" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm text-slate-500 px-4 text-center">After-photo goes here</span>
                      )}
                    </div>
                    <figcaption className="mt-2 text-sm text-slate-500">After, from your team</figcaption>
                  </figure>
                </div>

                {/* What the resident said + where */}
                <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
                  <blockquote className="border-l-[3px] border-brand-400 pl-4">
                    <p className="text-[17px] leading-relaxed text-slate-800">“{selected.description}”</p>
                    <footer className="mt-1 text-sm text-slate-500">What the resident said</footer>
                  </blockquote>
                  <div className="text-sm">
                    <p className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <MapPin className="w-4 h-4 text-brand-600" aria-hidden />
                      {selected.location_name}
                    </p>
                    <a
                      href={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-brand-700 underline underline-offset-4 decoration-brand-300"
                    >
                      Open in Google Maps
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                    </a>
                  </div>
                </div>

                <hr className="my-7 border-slate-200" />

                {isDone(selected.status) ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-5">
                    <p className="flex items-center gap-2 font-semibold text-emerald-900">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden />
                      {justSubmitted === selected.id ? "Repair proof submitted" : statusLabel(selected.status)}
                    </p>
                    <p className="mt-1.5 text-[15px] text-emerald-900">
                      {selected.fixed_by ? <strong>{selected.fixed_by}</strong> : "Your team"}
                      {selected.fixed_at ? `, ${timeAgo(selected.fixed_at)}` : ""}
                      {selected.resolution_note ? `: ${selected.resolution_note}` : ""}
                    </p>
                    {selected.status === "RESOLUTION_SUBMITTED" && (
                      <p className="mt-2 text-sm text-emerald-800">
                        A reviewer will compare the before and after photos, then close the ticket. The resident can
                        already see your after-photo.
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Submit repair proof</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Submitted as {ngoName}. Your name appears on the public map and on the resident&apos;s ticket.
                    </p>

                    <div className="mt-5 grid gap-5 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">1. After-repair photo</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <label className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:border-brand-400 cursor-pointer focus-within:ring-2 focus-within:ring-brand-300">
                            {photoBusy ? (
                              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                            ) : (
                              <ImagePlus className="w-4 h-4" aria-hidden />
                            )}
                            {fixPhoto ? "Replace photo" : "Take or choose photo"}
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={onPhoto}
                              className="sr-only"
                            />
                          </label>
                          {fixPhoto && (
                            <button
                              type="button"
                              onClick={() => setFixPhoto("")}
                              className="inline-flex items-center gap-1 h-11 px-3 rounded-xl text-sm text-slate-600 hover:bg-slate-100"
                            >
                              <X className="w-4 h-4" aria-hidden />
                              Remove
                            </button>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-slate-500">Stand where the resident took theirs, so the two match.</p>
                      </div>

                      <div>
                        <VoiceRecorderInput
                          value={fixNote}
                          onChange={(v) => {
                            setFixNote(v);
                            setFixError(null);
                          }}
                          label="2. What did you fix?"
                          placeholder="For example: cleared the pile, disinfected the spot, and asked the society to use the bin."
                        />
                      </div>
                    </div>

                    {fixError && (
                      <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        {fixError}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={submitFix}
                      disabled={submitting || photoBusy}
                      className="mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-brand-500 text-slate-900 text-[15px] font-bold hover:bg-brand-400 transition-colors disabled:opacity-60"
                    >
                      {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
                      {submitting ? "Submitting" : "Submit repair proof"}
                    </button>
                  </div>
                )}
              </article>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
