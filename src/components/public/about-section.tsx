import Link from "next/link";
import { Send, Ticket } from "lucide-react";
import { PUBLIC_BOT_URL } from "@/lib/telegram/public";

const PRINCIPLES = [
  {
    title: "Built for how people already talk",
    body: "Most residents already use Telegram. Reporting by voice in Marathi, Hindi or English takes less than two minutes, with no account or app.",
  },
  {
    title: "One problem, one place",
    body: "When three neighbours report the same overflowing bin or leaking pipe, it stays one issue on the map, and every report still counts.",
  },
  {
    title: "People decide, not algorithms",
    body: "Locations are checked by distance, not guesswork, and only a person can close a ticket after looking at the before and after photos.",
  },
];

export function AboutSection() {
  return (
    <section id="about" className="nk-about">
      <div className="nk-about__inner">
        <div className="nk-about__text">
          <h2 className="nk-h2">About Nagrik</h2>
          <p className="nk-lede">
            An independent pilot that makes it easy to report any civic problem in your neighbourhood, from garbage and
            drains to water, lighting, roads and parks, and makes every repair visible to the public.
          </p>
          <dl className="nk-about__list">
            {PRINCIPLES.map((p) => (
              <div key={p.title}>
                <dt>{p.title}</dt>
                <dd>{p.body}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="nk-cta">
          <h2 className="nk-cta__title">Spotted a civic problem near you?</h2>
          <p className="nk-cta__text">
            Send it on Telegram. You&apos;ll get a ticket number straight away, and the after-photo when it&apos;s fixed.
          </p>
          <div className="nk-cta__actions">
            <a href={PUBLIC_BOT_URL} target="_blank" rel="noopener noreferrer" className="nk-btn nk-btn--kerb">
              <Send size={18} aria-hidden />
              Report on Telegram
            </a>
            <Link href="/login?role=citizen" className="nk-btn nk-btn--on-dark">
              <Ticket size={18} aria-hidden />
              Track my tickets
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
