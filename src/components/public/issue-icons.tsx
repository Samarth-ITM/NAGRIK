/**
 * Small animated pictures of civic problems, used instead of long text lists.
 * Pure SVG + CSS (classes in nagrik-ui.css, "nk-ico"). Motion stops for
 * people who prefer reduced motion.
 */

export type IssueKind =
  | "garbage"
  | "bin"
  | "pothole"
  | "drain"
  | "leak"
  | "light"
  | "footpath"
  | "manhole"
  | "tree"
  | "other";

export const ISSUE_LABELS: Record<IssueKind, string> = {
  garbage: "Garbage",
  bin: "Overflowing bin",
  pothole: "Pothole",
  drain: "Blocked drain",
  leak: "Water leak",
  light: "Streetlight",
  footpath: "Broken footpath",
  manhole: "Open manhole",
  tree: "Fallen tree",
  other: "Anything else",
};

const INK = "#3B2A20";

function Art({ kind }: { kind: IssueKind }) {
  switch (kind) {
    case "garbage":
      return (
        <>
          <rect x="8" y="51" width="48" height="3" rx="1.5" fill="#D9B79A" />
          <path d="M12 51c-2-9 3-17 10-18l-2-4h8l-2 4c7 1 11 9 9 18z" fill="#4A4442" />
          <path d="M20 29l4 3 4-3" stroke="#2B2523" strokeWidth="1.6" fill="none" />
          <path d="M31 51c-1-8 3-14 9-15l-2-4h8l-2 4c6 1 10 7 8 15z" fill="#5C5552" />
          <rect x="38" y="44" width="5" height="9" rx="1.5" fill="#6BAA5C" transform="rotate(25 40 48)" />
          <path d="M8 52c3-4 6-4 8 0" fill="#E8C547" />
          <g className="nk-ico-orbit">
            <circle cx="46" cy="22" r="1.8" fill={INK} />
          </g>
          <g className="nk-ico-orbit nk-ico-orbit--slow">
            <circle cx="22" cy="20" r="1.5" fill={INK} />
          </g>
        </>
      );
    case "bin":
      return (
        <>
          <path d="M19 27h26l-3 25H22z" fill="#4F8F5B" />
          <path d="M25 33v14M32 33v14M39 33v14" stroke="#3B6E46" strokeWidth="2" strokeLinecap="round" />
          <circle cx="26" cy="24" r="5" fill="#E8890C" />
          <circle cx="36" cy="22" r="6" fill="#A8826A" />
          <rect x="30" y="17" width="9" height="6" rx="1.5" fill="#F4E9DF" stroke={INK} strokeWidth="1.2" />
          <g className="nk-ico-lid">
            <rect x="15" y="20" width="16" height="4" rx="2" fill="#3F7A4B" />
          </g>
          <rect x="10" y="52" width="44" height="3" rx="1.5" fill="#D9B79A" />
        </>
      );
    case "pothole":
      return (
        <>
          <rect x="5" y="28" width="54" height="26" rx="6" fill="#7A6D66" />
          <path d="M9 34h8M24 34h8M39 34h8" stroke="#EDE2D6" strokeWidth="2.4" strokeLinecap="round" />
          <ellipse cx="32" cy="45" rx="14" ry="6.5" fill="#3B2A20" />
          <ellipse className="nk-ico-ripple" cx="32" cy="45.5" rx="9" ry="3.2" fill="#6FB1E0" />
          <path d="M18 43l-4-2M46 43l5-2" stroke="#3B2A20" strokeWidth="1.6" strokeLinecap="round" />
        </>
      );
    case "drain":
      return (
        <>
          <ellipse className="nk-ico-pulse" cx="32" cy="44" rx="24" ry="9" fill="#6FB1E0" opacity="0.55" />
          <rect x="16" y="32" width="32" height="18" rx="3" fill="#5E534C" />
          <path d="M22 35v12M28 35v12M34 35v12M40 35v12" stroke="#3B2A20" strokeWidth="2.2" />
          <path d="M20 31c3-5 8-4 9-1" fill="#6BAA5C" />
          <ellipse cx="38" cy="31" rx="5" ry="2.5" fill="#E8890C" transform="rotate(-15 38 31)" />
          <rect x="24" y="28" width="6" height="4" rx="1" fill="#F4E9DF" stroke={INK} strokeWidth="1" />
        </>
      );
    case "leak":
      return (
        <>
          <rect x="6" y="16" width="52" height="10" rx="3" fill="#9BA7B0" />
          <rect x="28" y="13" width="9" height="16" rx="2" fill="#7F8B94" />
          <path d="M33 26l-2 3 2 2" stroke={INK} strokeWidth="1.4" fill="none" />
          <path className="nk-ico-drip" d="M32 31c0 0-4 5-4 7.5a4 4 0 008 0c0-2.5-4-7.5-4-7.5z" fill="#4D9BD6" />
          <path className="nk-ico-drip nk-ico-drip--late" d="M32 31c0 0-3 4-3 6a3 3 0 006 0c0-2-3-6-3-6z" fill="#6FB1E0" />
          <ellipse className="nk-ico-pulse" cx="32" cy="53" rx="15" ry="3.5" fill="#6FB1E0" opacity="0.7" />
        </>
      );
    case "light":
      return (
        <>
          <path className="nk-ico-flicker" d="M38 19L27 50h26z" fill="#FFD27A" opacity="0.85" />
          <path d="M22 56V18c0-4 3-6 7-6h9" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
          <rect x="35" y="14" width="13" height="6" rx="2" fill={INK} />
          <rect x="16" y="54" width="12" height="3" rx="1.5" fill={INK} />
        </>
      );
    case "footpath":
      return (
        <>
          <rect x="8" y="30" width="15" height="10" rx="1.5" fill="#D9B79A" stroke="#B48F70" />
          <rect x="25" y="30" width="15" height="10" rx="1.5" fill="#D9B79A" stroke="#B48F70" />
          <rect x="42" y="30" width="15" height="10" rx="1.5" fill="#D9B79A" stroke="#B48F70" />
          <rect x="8" y="42" width="15" height="10" rx="1.5" fill="#D9B79A" stroke="#B48F70" />
          <rect x="42" y="42" width="15" height="10" rx="1.5" fill="#D9B79A" stroke="#B48F70" />
          <rect x="25" y="44" width="15" height="9" rx="1" fill="#5E534C" />
          <g className="nk-ico-tile">
            <rect x="27" y="40" width="15" height="10" rx="1.5" fill="#C9A587" stroke="#8C6A52" />
          </g>
          <path d="M12 33l4 4 3-2" stroke="#8C6A52" strokeWidth="1.2" fill="none" />
        </>
      );
    case "manhole":
      return (
        <>
          <rect x="5" y="30" width="54" height="24" rx="6" fill="#7A6D66" />
          <ellipse cx="30" cy="44" rx="13" ry="6" fill="#1E140F" />
          <ellipse cx="47" cy="36" rx="9" ry="4" fill="#9A8D86" stroke="#5E534C" transform="rotate(-20 47 36)" />
          <g className="nk-ico-blink">
            <path d="M18 12l9 15H9z" fill="#E8890C" />
            <rect x="17" y="17" width="2" height="5" rx="1" fill={INK} />
            <circle cx="18" cy="24" r="1.1" fill={INK} />
          </g>
        </>
      );
    case "tree":
      return (
        <>
          <rect x="8" y="52" width="48" height="3" rx="1.5" fill="#D9B79A" />
          <rect x="14" y="44" width="34" height="6" rx="3" fill="#8C6A52" transform="rotate(-12 31 47)" />
          <g className="nk-ico-sway">
            <circle cx="46" cy="38" r="8" fill="#6BAA5C" />
            <circle cx="53" cy="44" r="6" fill="#5A9A4C" />
            <circle cx="42" cy="46" r="5" fill="#7FBF6E" />
          </g>
          <path d="M12 52l2-8" stroke="#8C6A52" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case "other":
    default:
      return (
        <>
          <circle className="nk-ico-spin" cx="32" cy="32" r="19" fill="none" stroke="#E8890C" strokeWidth="2.5" strokeDasharray="6 5" />
          <path d="M32 24v16M24 32h16" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
        </>
      );
  }
}

export function IssueIcon({ kind, size = 56 }: { kind: IssueKind; size?: number }) {
  return (
    <svg className="nk-ico" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <Art kind={kind} />
    </svg>
  );
}

/** Compact row of pictures with one-word labels (used in the hero). */
export function IssueStrip({ kinds }: { kinds: IssueKind[] }) {
  return (
    <ul className="nk-issue-strip" aria-label="Problems you can report">
      {kinds.map((k) => (
        <li key={k}>
          <span className="nk-issue-strip__pic">
            <IssueIcon kind={k} size={50} />
          </span>
          <span className="nk-issue-strip__label">{ISSUE_LABELS[k]}</span>
        </li>
      ))}
    </ul>
  );
}

/** "What you can report": a grid of pictures with short labels. */
export function ReportGrid() {
  const kinds: IssueKind[] = ["garbage", "bin", "pothole", "drain", "leak", "light", "footpath", "manhole", "tree", "other"];
  return (
    <section id="categories" className="nk-report-grid">
      <div className="nk-report-grid__inner">
        <h2 className="nk-h2">What you can report</h2>
        <ul className="nk-report-grid__list">
          {kinds.map((k) => (
            <li key={k} className="nk-report-grid__tile">
              <span className="nk-report-grid__pic">
                <IssueIcon kind={k} size={68} />
              </span>
              <span>{ISSUE_LABELS[k]}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
