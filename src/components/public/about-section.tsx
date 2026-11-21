import Link from "next/link";
import { MapPin, Mic, Send, Ticket, UserCheck } from "lucide-react";
import { PUBLIC_BOT_URL } from "@/lib/telegram/public";

const PRINCIPLES = [
  { title: "Speak, don’t type", Icon: Mic },
  { title: "One spot, one issue", Icon: MapPin },
  { title: "People verify, not algorithms", Icon: UserCheck },
];

export function AboutSection() {
  return (
    <section id="about" className="nk-about">
      <div className="nk-about__inner">
        <div className="nk-about__text">
          <h2 className="nk-h2">About Nagrik</h2>
          <ul className="nk-about__points">
            {PRINCIPLES.map(({ title, Icon }) => (
              <li key={title}>
                <Icon size={20} aria-hidden />
                {title}
              </li>
            ))}
          </ul>
        </div>

        <div className="nk-cta">
          <h2 className="nk-cta__title">Spotted a civic problem near you?</h2>
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
