import { Check, X } from "lucide-react";
import { PILOT_CONFIG } from "@/lib/config/pilot";

const COVERED = [
  "Garbage, overflowing bins and illegal dumping",
  "Drains, stormwater and public sanitation",
  "Water supply and public taps",
  "Streetlights and electrical fixtures",
  "Roads, footpaths and road safety",
  "Parks, trees and green spaces",
];

const NOT_COVERED = [
  "Inside college campuses or private plots",
  "Roads inside housing societies",
  "Shops and commercial premises",
];

export function PilotArea() {
  return (
    <section id="pilot-area" className="nk-pilot">
      <div className="nk-pilot__inner">
        <div>
          <h2 className="nk-h2">Where Nagrik runs</h2>
          <p className="nk-lede">
            Nagrik covers the entire city of Kharghar across {PILOT_CONFIG.radiusMetres / 1000} km (all 45+ sectors from Sector 1 to Sector 45). Any civic problem in public spaces can be reported via Telegram. If a location pin is shared from outside Kharghar, the bot asks for a valid location inside the city.
          </p>

          <div className="nk-pilot__lists">
            <div>
              <h3 className="nk-pilot__h3">You can report</h3>
              <ul className="nk-pilot__list">
                {COVERED.map((c) => (
                  <li key={c}>
                    <Check size={16} className="nk-pilot__yes" aria-hidden />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="nk-pilot__h3">Not covered yet</h3>
              <ul className="nk-pilot__list">
                {NOT_COVERED.map((c) => (
                  <li key={c}>
                    <X size={16} className="nk-pilot__no" aria-hidden />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <figure className="nk-pilot__figure">
          <svg
            viewBox="0 0 320 320"
            role="img"
            aria-label={`Pilot area: a circle of ${PILOT_CONFIG.radiusMetres} metres around the ITM gate`}
          >
            <circle cx="160" cy="160" r="150" className="nk-pilot__ring" />
            <circle cx="160" cy="160" r="100" className="nk-pilot__ring nk-pilot__ring--inner" />
            <circle cx="160" cy="160" r="50" className="nk-pilot__ring nk-pilot__ring--inner" />
            <line x1="160" y1="160" x2="310" y2="160" className="nk-pilot__radius" />
            <text x="235" y="150" textAnchor="middle" className="nk-pilot__label">
              {PILOT_CONFIG.radiusMetres} m
            </text>
            <circle cx="160" cy="160" r="9" className="nk-pilot__pin" />
            <circle cx="160" cy="160" r="3.5" fill="#fff" />
          </svg>
          <figcaption>
            Centre: ITM Skills University main gate. The boundary is a pilot area, not an official municipal ward.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
