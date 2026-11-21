import Link from "next/link";
import { Shield } from "lucide-react";
import { PUBLIC_BOT_URL, PUBLIC_BOT_USERNAME } from "@/lib/telegram/public";

const EXPLORE = [
  { label: "How reporting works", href: "/#how-it-works" },
  { label: "What you can report", href: "/#categories" },
  { label: "Issue map", href: "/#issues" },
  { label: "How fixes are verified", href: "/#accountability" },
  { label: "Pilot area", href: "/#pilot-area" },
];

const FOR_YOU = [
  { label: "Track my tickets", href: "/login?role=citizen" },
  { label: "NGO field desk", href: "/login?role=ngo" },
  { label: "Privacy", href: "/privacy" },
  { label: "About", href: "/about" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="nk-footer">
      <div className="nk-footer__inner">
        <div className="nk-footer__brand">
          <Link href="/" className="nk-footer__logo">
            <span className="nk-footer__mark">
              <Shield size={16} aria-hidden />
            </span>
            Nagrik
          </Link>
          <p>
            Report any civic problem across Kharghar, Navi Mumbai: garbage, drains, water supply, streetlights, roads, parks and more. Then see who fixed it.
          </p>
          <a href={PUBLIC_BOT_URL} target="_blank" rel="noopener noreferrer" className="nk-footer__bot">
            @{PUBLIC_BOT_USERNAME} on Telegram
          </a>
        </div>

        <nav aria-label="Explore">
          <h2 className="nk-footer__h">Explore</h2>
          <ul>
            {EXPLORE.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Your account and policies">
          <h2 className="nk-footer__h">For you</h2>
          <ul>
            {FOR_YOU.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
            <li>
              <a href="mailto:pilot@nagrik.local">Contact the pilot team</a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="nk-footer__legal">
        <p>
          Nagrik is an independent civic portal across Kharghar, Navi Mumbai. It is not an official grievance portal of the City and
          Industrial Development Corporation (CIDCO), Panvel Municipal Corporation (PMC) or the Government of
          Maharashtra, and no official partnership or integration is claimed. Sample data is synthetic and kept
          separate from real reports. In an emergency, dial 112.
        </p>
        <p className="nk-footer__copy">© {year} Nagrik</p>
      </div>
    </footer>
  );
}
