"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsLeftRight } from "lucide-react";

/**
 * Before / after: one illustrated street in Sector 4, drawn twice.
 * A divider sweeps across (or is dragged) to reveal the repaired version.
 * As it passes each problem, a check pops on it and its label below turns green.
 */

const W = 1200;
const H = 600;

// x positions (viewBox units) of each fix, used for the badges and the labels.
const FIXES = [
  { id: "light", x: 175, label: "Streetlight repaired" },
  { id: "garbage", x: 395, label: "Garbage cleared" },
  { id: "pothole", x: 625, label: "Pothole filled" },
  { id: "drain", x: 850, label: "Drain unblocked" },
  { id: "tree", x: 1045, label: "Tree planted" },
] as const;

const BADGE_Y: Record<string, number> = { light: 118, garbage: 248, pothole: 420, drain: 350, tree: 196 };

/* ------------------------------ shared scenery ------------------------------ */

function Backdrop({ fixed }: { fixed: boolean }) {
  return (
    <>
      <defs>
        <linearGradient id={`sky-${fixed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={fixed ? "#FFE2C6" : "#EFDCCB"} />
          <stop offset="1" stopColor={fixed ? "#FFF3E8" : "#F5E9DE"} />
        </linearGradient>
        <radialGradient id={`glow-${fixed}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFE6A8" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFE6A8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#sky-${fixed})`} />
      <circle cx="1010" cy="110" r="62" fill={fixed ? "#FFC98F" : "#EAD0BA"} />

      {/* Buildings */}
      <g>
        <rect x="40" y="150" width="210" height="215" rx="4" fill="#F1CBAE" />
        <rect x="265" y="95" width="170" height="270" rx="4" fill="#E9BD9B" />
        <rect x="450" y="170" width="250" height="195" rx="4" fill="#F3D3BA" />
        <rect x="715" y="120" width="190" height="245" rx="4" fill="#EBC3A3" />
        <rect x="920" y="185" width="240" height="180" rx="4" fill="#F1CBAE" />
        {[
          [40, 150, 210, 215],
          [265, 95, 170, 270],
          [450, 170, 250, 195],
          [715, 120, 190, 245],
          [920, 185, 240, 180],
        ].map(([bx, by, bw, bh], i) => (
          <g key={i} fill={fixed ? "#FFF6EC" : "#F7E6D7"}>
            {Array.from({ length: Math.floor((bh - 40) / 42) }).map((_, r) =>
              Array.from({ length: Math.floor((bw - 30) / 44) }).map((__, c) => (
                <rect key={`${r}-${c}`} x={bx + 22 + c * 44} y={by + 22 + r * 42} width="22" height="22" rx="2" />
              ))
            )}
          </g>
        ))}
      </g>

      {/* Footpath, kerb, road */}
      <rect x="0" y="365" width={W} height="40" fill="#E6C6AC" />
      <rect x="0" y="405" width={W} height="10" fill={`url(#kerb-${fixed})`} />
      <defs>
        <pattern id={`kerb-${fixed}`} width="56" height="10" patternUnits="userSpaceOnUse">
          <rect width="28" height="10" fill="#F7941D" />
          <rect x="28" width="28" height="10" fill="#2F1F17" />
        </pattern>
      </defs>
      <rect x="0" y="415" width={W} height="185" fill={fixed ? "#5A4A42" : "#655349"} />
      {Array.from({ length: 12 }).map((_, i) => (
        <rect key={i} x={20 + i * 105} y="503" width="60" height="7" rx="3" fill="#F3E4D6" opacity={fixed ? 0.9 : 0.45} />
      ))}
    </>
  );
}

/* --------------------------------- before --------------------------------- */

const BeforeScene = memo(function BeforeScene() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden className="nk-ba__svg">
      <Backdrop fixed={false} />

      {/* Broken streetlight: dark, tilted head, dangling wire */}
      <g>
        <rect x="170" y="150" width="10" height="218" fill="#7E6E64" />
        <path d="M175 155 q40 -10 62 8" stroke="#7E6E64" strokeWidth="8" fill="none" strokeLinecap="round" />
        <g transform="rotate(18 238 168)">
          <rect x="222" y="160" width="36" height="14" rx="4" fill="#9C8B80" />
        </g>
        <path d="M232 176 q6 30 -6 52" stroke="#4A3B33" strokeWidth="2" fill="none" />
        <rect x="160" y="290" width="30" height="40" rx="3" fill="#8D7C71" />
        <path d="M168 300 l14 20 M182 300 l-14 20" stroke="#5A4A42" strokeWidth="2" />
      </g>

      {/* Overflowing bin + scattered bags */}
      <g>
        <rect x="370" y="300" width="56" height="68" rx="5" fill="#6E5C51" />
        <rect x="364" y="294" width="68" height="10" rx="3" fill="#5A4A42" transform="rotate(-14 398 299)" />
        <circle cx="384" cy="292" r="16" fill="#8A8F5A" />
        <circle cx="408" cy="284" r="18" fill="#6F7447" />
        <circle cx="398" cy="270" r="13" fill="#A49B63" />
        <ellipse cx="344" cy="372" rx="22" ry="14" fill="#7C8150" />
        <ellipse cx="450" cy="374" rx="26" ry="15" fill="#6F7447" />
        <ellipse cx="478" cy="388" rx="14" ry="9" fill="#A49B63" />
        <rect x="320" y="392" width="16" height="6" rx="2" fill="#D9C3B0" transform="rotate(20 328 395)" />
        <rect x="500" y="384" width="14" height="5" rx="2" fill="#C9B19C" transform="rotate(-25 507 386)" />
        {/* flies */}
        <g fill="#3A2C25">
          <circle cx="382" cy="252" r="2" className="nk-ba__fly" />
          <circle cx="416" cy="258" r="2" className="nk-ba__fly nk-ba__fly--b" />
          <circle cx="398" cy="242" r="2" className="nk-ba__fly nk-ba__fly--c" />
        </g>
      </g>

      {/* Pothole with cracks and dirty water */}
      <g>
        <ellipse cx="625" cy="462" rx="78" ry="22" fill="#2B201B" />
        <ellipse cx="620" cy="460" rx="58" ry="13" fill="#6E7F86" opacity="0.55" />
        <path
          d="M547 462 l-26 -10 M545 468 l-30 14 M703 458 l28 -12 M705 466 l26 18 M610 440 l-6 -20 M650 482 l10 22"
          stroke="#2B201B"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>

      {/* Blocked drain: leaves on grate, puddle spreading onto footpath */}
      <g>
        <ellipse cx="850" cy="398" rx="92" ry="16" fill="#8FA3AC" opacity="0.75" />
        <rect x="818" y="404" width="64" height="12" rx="2" fill="#3E322B" />
        <circle cx="830" cy="404" r="7" fill="#9A6B3C" />
        <circle cx="846" cy="401" r="6" fill="#B57E44" />
        <circle cx="864" cy="405" r="7" fill="#8A5D33" />
        <circle cx="876" cy="400" r="5" fill="#B57E44" />
      </g>

      {/* Empty planter with a dead stump */}
      <g>
        <rect x="1000" y="330" width="90" height="38" rx="4" fill="#A27E66" />
        <rect x="1038" y="300" width="12" height="32" rx="2" fill="#7A5B45" />
        <path d="M1044 304 l-14 -14 M1046 312 l16 -12" stroke="#7A5B45" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  );
});

/* ---------------------------------- after ---------------------------------- */

function AfterScene({ done }: { done: Record<string, boolean> }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden className="nk-ba__svg">
      <Backdrop fixed />

      {/* Working streetlight with warm cone of light */}
      <g>
        <polygon points="226,182 140,410 330,410" fill="#FFE2A0" opacity="0.38" className="nk-ba__cone" />
        <circle cx="240" cy="176" r="46" fill="url(#glow-true)" className="nk-ba__glow" />
        <rect x="170" y="150" width="10" height="218" fill="#5A4A42" />
        <path d="M175 155 q40 -10 62 8" stroke="#5A4A42" strokeWidth="8" fill="none" strokeLinecap="round" />
        <rect x="222" y="164" width="36" height="14" rx="4" fill="#3A2C25" />
        <rect x="226" y="176" width="28" height="6" rx="3" fill="#FFF0C4" />
      </g>

      {/* Clean bin, lid closed */}
      <g>
        <rect x="370" y="300" width="56" height="68" rx="5" fill="#C46A00" />
        <rect x="364" y="292" width="68" height="10" rx="3" fill="#9E5500" />
        <path d="M388 326 l10 -10 l10 10 M398 316 v24" stroke="#FFE9C7" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>

      {/* Pothole patched: a neat, slightly darker rectangle */}
      <g>
        <rect x="548" y="446" width="156" height="34" rx="6" fill="#4C3E37" />
        <rect x="548" y="446" width="156" height="34" rx="6" fill="none" stroke="#6B5A51" strokeWidth="2" />
      </g>

      {/* Clear drain */}
      <g>
        <rect x="818" y="404" width="64" height="12" rx="2" fill="#3E322B" />
        {[826, 838, 850, 862, 874].map((x) => (
          <rect key={x} x={x} y="406" width="4" height="8" fill="#6B5A51" />
        ))}
      </g>

      {/* Planter with a young tree and marigolds */}
      <g>
        <rect x="1000" y="330" width="90" height="38" rx="4" fill="#A27E66" />
        <rect x="1040" y="262" width="9" height="70" rx="2" fill="#7A5B45" />
        <circle cx="1044" cy="240" r="40" fill="#4F8A5B" />
        <circle cx="1018" cy="258" r="24" fill="#5E9A69" />
        <circle cx="1072" cy="256" r="26" fill="#467F51" />
        {[1012, 1030, 1060, 1078].map((x) => (
          <circle key={x} cx={x} cy="328" r="6" fill="#F7941D" />
        ))}
      </g>

      {/* Check badges pop as each fix is revealed */}
      {FIXES.map((f) => (
        <g
          key={f.id}
          className="nk-ba__badge"
          data-on={done[f.id]}
          style={{ transformOrigin: `${f.x}px ${BADGE_Y[f.id]}px` }}
        >
          <circle cx={f.x} cy={BADGE_Y[f.id]} r="17" fill="#1F7A4D" stroke="#fff" strokeWidth="4" />
          <path
            d={`M${f.x - 7} ${BADGE_Y[f.id]} l5 5 l9 -10`}
            stroke="#fff"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------- component -------------------------------- */

export function BeforeAfter() {
  // pos: % of width revealed as "after" (from the left)
  const [pos, setPos] = useState(50);
  const [userControlled, setUserControlled] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [inView, setInView] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Auto sweep: 6 → 94 → 6 with pauses, only while visible and untouched.
  useEffect(() => {
    if (userControlled || reducedMotion || !inView) return;
    let raf = 0;
    const start = performance.now();
    const SWEEP = 4200;
    const HOLD = 1400;
    const CYCLE = 2 * (SWEEP + HOLD);
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const tick = (now: number) => {
      const t = (now - start) % CYCLE;
      let p: number;
      if (t < SWEEP) p = 6 + 88 * ease(t / SWEEP);
      else if (t < SWEEP + HOLD) p = 94;
      else if (t < 2 * SWEEP + HOLD) p = 94 - 88 * ease((t - SWEEP - HOLD) / SWEEP);
      else p = 6;
      setPos(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [userControlled, reducedMotion, inView]);

  const setFromClientX = useCallback((clientX: number) => {
    const el = frameRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = ((clientX - r.left) / r.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    setUserControlled(true);
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) setFromClientX(e.clientX);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 20 : 5;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      setUserControlled(true);
      setPos((p) => Math.max(0, p - step));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      setUserControlled(true);
      setPos((p) => Math.min(100, p + step));
    } else if (e.key === "Home") {
      setUserControlled(true);
      setPos(0);
    } else if (e.key === "End") {
      setUserControlled(true);
      setPos(100);
    }
  };

  // The frame has the same 2:1 shape as the drawing, so x positions map straight to %.
  const done: Record<string, boolean> = {};
  for (const f of FIXES) done[f.id] = pos >= (f.x / W) * 100;
  const fixedCount = FIXES.filter((f) => done[f.id]).length;
  const doneKey = FIXES.map((f) => (done[f.id] ? 1 : 0)).join("");

  // Memoised so each animation frame only moves the divider, not the whole drawing.
  const beforeEl = useMemo(() => <BeforeScene />, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const afterEl = useMemo(() => <AfterScene done={done} />, [doneKey]);

  return (
    <section id="before-after" className="nk-ba">
      <div className="nk-ba__inner">
        <div className="nk-ba__head">
          <h2 className="nk-display nk-display--sm">Before and after</h2>
          <p className="nk-lede">
            A ticket only closes when there&apos;s an after-photo to prove the repair. Drag the line across this
            street to see what that looks like.
          </p>
        </div>

        <div
          ref={frameRef}
          className="nk-ba__frame"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="nk-ba__layer nk-ba__layer--before">
            {beforeEl}
          </div>
          <div className="nk-ba__layer nk-ba__layer--after" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
            {afterEl}
          </div>

          <span className="nk-ba__tag nk-ba__tag--after" style={{ opacity: pos > 14 ? 1 : 0 }}>
            After
          </span>
          <span className="nk-ba__tag nk-ba__tag--before" style={{ opacity: pos < 86 ? 1 : 0 }}>
            Before
          </span>

          <div className="nk-ba__divider" style={{ left: `${pos}%` }}>
            <button
              type="button"
              className="nk-ba__handle"
              role="slider"
              aria-label="Compare before and after"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pos)}
              aria-valuetext={`${fixedCount} of ${FIXES.length} problems fixed`}
              onKeyDown={onKeyDown}
            >
              <ChevronsLeftRight size={20} aria-hidden />
            </button>
          </div>
        </div>

        <ul className="nk-ba__fixes" aria-label="What gets fixed">
          {FIXES.map((f) => (
            <li key={f.id} data-on={done[f.id]}>
              <span className="nk-ba__tick">
                <Check size={12} strokeWidth={3} aria-hidden />
              </span>
              {f.label}
            </li>
          ))}
        </ul>
        <p className="nk-ba__note">Illustration of typical fixes reported through Nagrik.</p>
      </div>
    </section>
  );
}
