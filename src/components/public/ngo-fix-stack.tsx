"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, ChevronDown, ChevronUp, Pause, Play, Wrench } from "lucide-react";

interface PublicFix {
  id: string;
  ngoName: string;
  ngoLogoUrl: string | null;
  issueLabel: string;
  note: string | null;
  afterPhotoUrl: string | null;
  fixedAt: string | null;
  stage: "verified" | "submitted";
  isSample: boolean;
  usesProfileLogo?: boolean;
}

const ROTATE_MS = 3800;
const VISIBLE_DEPTH = 3;

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter((w) => /^[A-Za-z0-9]/.test(w))
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "NG"
  );
}

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function NgoMark({ fix }: { fix: PublicFix }) {
  const [broken, setBroken] = useState(false);
  if (fix.ngoLogoUrl && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={fix.ngoLogoUrl} alt="" onError={() => setBroken(true)} className="nk-fix__logo" />;
  }
  return <div className="nk-fix__initials">{initials(fix.ngoName)}</div>;
}

function FixCard({ fix }: { fix: PublicFix }) {
  const [photoBroken, setPhotoBroken] = useState(false);
  const verified = fix.stage === "verified";

  return (
    <article className="nk-fix">
      <div className="nk-fix__body">
        <div className="nk-fix__who">
          <NgoMark fix={fix} />
          <div style={{ minWidth: 0 }}>
            <p className="nk-fix__ngo">{fix.ngoName}</p>
            <p className="nk-fix__when">{formatWhen(fix.fixedAt) || "Recently"}</p>
          </div>
        </div>

        <p className="nk-fix__what">Fixed: {fix.issueLabel}</p>
        {fix.note && <p className="nk-fix__note">{fix.note}</p>}

        <div className="nk-fix__tags">
          <span className={`nk-pill ${verified ? "nk-pill--done" : "nk-pill--check"}`}>
            {verified ? <BadgeCheck size={14} aria-hidden /> : <Wrench size={14} aria-hidden />}
            {verified ? "Repair verified" : "Repair done, awaiting check"}
          </span>
          {fix.isSample && <span className="nk-pill nk-pill--sample">Sample data</span>}
        </div>
      </div>

      {fix.afterPhotoUrl && !photoBroken && (
        <div className="nk-fix__photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fix.afterPhotoUrl}
            alt={`After repair: ${fix.issueLabel}`}
            loading="lazy"
            onError={() => setPhotoBroken(true)}
          />
          <span>After</span>
        </div>
      )}
    </article>
  );
}

export interface NgoFixStackInitial {
  fixes: PublicFix[];
  profileLogoUrl: string | null;
}

export function NgoFixStack({ initial }: { initial?: NgoFixStackInitial | null } = {}) {
  const [fixes, setFixes] = useState<PublicFix[] | null>(initial ? initial.fixes : null);
  const [profileLogo, setProfileLogo] = useState<string | null>(initial?.profileLogoUrl ?? null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Server already rendered the list into the page: nothing to wait for.
    if (initial) return;
    let cancelled = false;
    fetch("/api/public/fixes")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (cancelled) return;
        setFixes(Array.isArray(data?.fixes) ? data.fixes : []);
        setProfileLogo(typeof data?.profileLogoUrl === "string" ? data.profileLogoUrl : null);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setFixes([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    const onVis = () => setPageHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mq.removeEventListener?.("change", update);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const count = fixes?.length ?? 0;
  const autoPlaying = count > 1 && !userPaused && !hoverPaused && !reducedMotion && !pageHidden;

  const go = useCallback(
    (delta: number) => {
      if (count < 2) return;
      setActive((a) => (a + delta + count) % count);
    },
    [count]
  );

  useEffect(() => {
    if (!autoPlaying) return;
    const t = window.setInterval(() => go(1), ROTATE_MS);
    return () => window.clearInterval(t);
  }, [autoPlaying, go]);

  // Keep index valid if data changes
  useEffect(() => {
    if (active >= count && count > 0) setActive(0);
  }, [active, count]);

  if (fixes === null) {
    return (
      <div className="nk-stack" aria-busy="true" aria-label="Loading recent repairs">
        <div className="nk-stack__skeleton" />
        <div className="nk-stack__skeleton" />
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="nk-stack__empty">
        {failed
          ? "Recent repairs couldn't load right now. Refresh the page to try again."
          : "No repairs recorded yet. When a partner NGO fixes a reported issue, it shows up here."}
      </div>
    );
  }

  const current = fixes[active];

  return (
    <div
      ref={regionRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Recent repairs by partner NGOs"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setHoverPaused(true)}
      onBlurCapture={(e) => {
        if (!regionRef.current?.contains(e.relatedTarget as Node)) setHoverPaused(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          go(1);
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          go(-1);
        }
      }}
    >
      {/* The stack */}
      <div className="nk-stack" aria-live={autoPlaying ? "off" : "polite"}>
        {fixes.map((fix, i) => {
          const pos = (i - active + count) % count;
          const leaving = count > VISIBLE_DEPTH && pos === count - 1;
          const visible = pos < VISIBLE_DEPTH;

          let style: React.CSSProperties;
          if (visible) {
            // Cards behind are dimmed (not see-through) so the edges read as a physical stack.
            style = {
              transform: `translateY(${pos * 18}px) scale(${1 - pos * 0.045})`,
              // Back cards are solid peach blanks (content hidden via CSS) so nothing ghosts through.
              opacity: 1,
              filter: "none",
              zIndex: 30 - pos,
            };
          } else if (leaving) {
            style = { transform: "translateY(-36px) scale(1.03)", opacity: 0, filter: "none", zIndex: 40 };
          } else {
            style = { transform: `translateY(${VISIBLE_DEPTH * 18}px) scale(0.86)`, opacity: 0, filter: "none", zIndex: 0 };
          }

          return (
            <div
              key={fix.id}
              aria-hidden={pos !== 0}
              data-depth={visible ? pos : leaving ? "leaving" : "hidden"}
              className="nk-stack__slot"
              style={style}
            >
              <FixCard fix={fix.usesProfileLogo && !fix.ngoLogoUrl ? { ...fix, ngoLogoUrl: profileLogo } : fix} />
            </div>
          );
        })}
      </div>

      {/* Controls */}
      {count > 1 && (
        <div className="nk-stack__controls">
          <span aria-live="polite">
            {active + 1} of {count}
            <span className="sr-only">: {current.ngoName} fixed {current.issueLabel}</span>
          </span>
          <div>
            <button
              type="button"
              onClick={() => go(-1)}
              className="nk-icon-btn"
              aria-label="Previous repair"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="nk-icon-btn"
              aria-label="Next repair"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            {!reducedMotion && (
              <button
                type="button"
                onClick={() => setUserPaused((p) => !p)}
                className="nk-icon-btn"
                aria-label={userPaused ? "Resume auto-scroll" : "Pause auto-scroll"}
              >
                {userPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
