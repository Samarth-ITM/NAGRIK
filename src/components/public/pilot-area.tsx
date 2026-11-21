import { PILOT_CONFIG } from "@/lib/config/pilot";

export function PilotArea() {
  const km = PILOT_CONFIG.radiusMetres / 1000;
  return (
    <section id="pilot-area" className="nk-pilot">
      <div className="nk-pilot__inner">
        <div>
          <h2 className="nk-h2">Where Nagrik runs</h2>
          <p className="nk-pilot__stat">
            All of Kharghar · <span>{km} km</span>
          </p>
        </div>

        <figure className="nk-pilot__figure">
          <svg viewBox="0 0 320 320" role="img" aria-label={`Coverage area: a circle of ${km} km around Kharghar centre`}>
            <circle cx="160" cy="160" r="150" className="nk-pilot__ring" />
            <circle cx="160" cy="160" r="100" className="nk-pilot__ring nk-pilot__ring--inner" />
            <circle cx="160" cy="160" r="50" className="nk-pilot__ring nk-pilot__ring--inner" />
            <line x1="160" y1="160" x2="310" y2="160" className="nk-pilot__radius" />
            <text x="235" y="150" textAnchor="middle" className="nk-pilot__label">
              {km} km
            </text>
            <circle cx="160" cy="160" r="9" className="nk-pilot__pin" />
            <circle cx="160" cy="160" r="3.5" fill="#fff" />
          </svg>
        </figure>
      </div>
    </section>
  );
}
