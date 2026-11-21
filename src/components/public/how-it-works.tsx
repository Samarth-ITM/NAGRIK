import { Check, Mic } from "lucide-react";
import { ReportIllustration } from "@/components/public/report-illustration";

/**
 * How it works: three cards, each a step with a picture of what you'll actually see.
 */

function TicketPhone() {
  return (
    <div className="nk-mini-phone" aria-hidden>
      <div className="nk-mini-phone__screen">
        <div className="nk-tg__head nk-tg__head--mini">
          <span className="nk-tg__avatar">N</span>
          <span>
            <span className="nk-tg__name">Nagrik Kharghar</span>
            <span className="nk-tg__status">bot</span>
          </span>
        </div>
        <div className="nk-mini-phone__chat">
          <div className="nk-tg__row nk-tg__row--me">
            <div className="nk-tg__bubble nk-tg__bubble--me">
              <span className="nk-tg__voice">
                <Mic size={13} />
                <span className="nk-tg__wave nk-tg__wave--mini" />
                0:06
              </span>
            </div>
          </div>
          <div className="nk-tg__row">
            <div className="nk-tg__bubble nk-tg__bubble--bot">
              <strong>Report submitted</strong>
              <br />
              Ticket: <code className="nk-tg__code">NAG-KHR-2026-000123</code>
              <br />
              Garbage accumulation, Sector 4
            </div>
            <div className="nk-tg__keys">
              <div className="nk-tg__keyrow">
                <span className="nk-tg__key">Track this ticket</span>
              </div>
            </div>
          </div>
        </div>
        <div className="nk-tg__composer nk-tg__composer--mini">
          <span>Message</span>
          <Mic size={14} />
        </div>
      </div>
    </div>
  );
}

const TRACK = [
  { label: "Reported", meta: "21 Nov", done: true },
  { label: "Picked up by Your NGO", meta: "22 Nov", done: true },
  { label: "Repaired, after-photo added", meta: "23 Nov", done: true },
  { label: "Verified fixed", meta: "Next", done: false },
];

function TicketTracker() {
  return (
    <div className="nk-tracker" aria-hidden>
      <div className="nk-tracker__head">
        <div>
          <p className="nk-tracker__title">Garbage accumulation</p>
          <p className="nk-tracker__code">NAG-KHR-2026-000123</p>
        </div>
        <span className="nk-pill nk-pill--check">In review</span>
      </div>
      <ol className="nk-tracker__list">
        {TRACK.map((t) => (
          <li key={t.label} data-done={t.done}>
            <span className="nk-tracker__dot">{t.done && <Check size={12} strokeWidth={3} />}</span>
            <span className="nk-tracker__label">{t.label}</span>
            <span className="nk-tracker__meta">{t.meta}</span>
          </li>
        ))}
      </ol>
      <div className="nk-tracker__photos">
        <span className="nk-tracker__ph nk-tracker__ph--before">Before</span>
        <span className="nk-tracker__ph nk-tracker__ph--after">After</span>
      </div>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="nk-steps">
      <div className="nk-steps__inner">
        <h2 className="nk-display">How it works</h2>

        <ol className="nk-steps__grid">
          <li className="nk-step nk-step--lead">
            <h3 className="nk-step__title">Report in Telegram</h3>
            <p className="nk-step__text">
              Pick your language and the type of problem, add a photo and a voice note, and share the location.
            </p>
            <div className="nk-step__media nk-step__media--illus">
              <ReportIllustration />
            </div>
          </li>

          <li className="nk-step">
            <h3 className="nk-step__title">Get a ticket</h3>
            <p className="nk-step__text">
              The bot replies straight away with a ticket number. Keep it to follow your report.
            </p>
            <div className="nk-step__media nk-step__media--phone">
              <TicketPhone />
            </div>
          </li>

          <li className="nk-step">
            <h3 className="nk-step__title">Follow it to the fix</h3>
            <p className="nk-step__text">
              Tap Track My Tickets in the bot, or sign in here, to see the latest status and the after-photo.
            </p>
            <div className="nk-step__media nk-step__media--tracker">
              <TicketTracker />
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}
