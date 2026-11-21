import { BadgeCheck, Building2, Camera, ClipboardCheck, Send } from "lucide-react";

/**
 * The life of one ticket, from report to verified fix. This is a real sequence,
 * so it is shown as a numbered track rather than a grid of feature cards.
 */
const STAGES = [
  { icon: Send, title: "Reported", who: "Resident" },
  { icon: ClipboardCheck, title: "Checked", who: "Nagrik" },
  { icon: Building2, title: "Assigned", who: "NGO" },
  { icon: Camera, title: "Repaired", who: "After-photo" },
  { icon: BadgeCheck, title: "Verified", who: "Reviewer" },
];

export function AccountabilitySection() {
  return (
    <section id="accountability" className="nk-life">
      <div className="nk-life__inner">
        <div className="nk-life__intro">
          <h2 className="nk-h2">How fixes are proven</h2>
        </div>

        <ol className="nk-life__track nk-life__track--compact">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            const last = i === STAGES.length - 1;
            return (
              <li key={s.title} className={`nk-life__stage${last ? " nk-life__stage--done" : ""}`}>
                <div className="nk-life__marker">
                  <Icon size={18} aria-hidden />
                </div>
                <h3 className="nk-life__title">{s.title}</h3>
                <p className="nk-life__who">{s.who}</p>
              </li>
            );
          })}
        </ol>

      </div>
    </section>
  );
}
