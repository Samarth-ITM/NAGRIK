import { BadgeCheck, Building2, Camera, ClipboardCheck, Info, RotateCcw, Send } from "lucide-react";

/**
 * The life of one ticket, from report to verified fix. This is a real sequence,
 * so it is shown as a numbered track rather than a grid of feature cards.
 */
const STAGES = [
  {
    icon: Send,
    who: "Resident",
    title: "Reported",
    body: "Photo, voice note and location are sent on Telegram. A ticket number is issued straight away.",
  },
  {
    icon: ClipboardCheck,
    who: "Nagrik reviewer",
    title: "Checked",
    body: "A person confirms the location and category. Reports of the same spot are linked, never deleted.",
  },
  {
    icon: Building2,
    who: "Partner NGO or authority",
    title: "Assigned",
    body: "The issue goes to the team responsible. Any handoff records where it went, when, and the proof.",
  },
  {
    icon: Camera,
    who: "Field team",
    title: "Repair submitted",
    body: "The team uploads an after-photo and a note. They can't mark their own work as fixed.",
  },
  {
    icon: BadgeCheck,
    who: "Independent reviewer",
    title: "Verified fixed",
    body: "Before and after photos are compared side by side. Only then does the ticket close.",
  },
];

export function AccountabilitySection() {
  return (
    <section id="accountability" className="nk-life">
      <div className="nk-life__inner">
        <div className="nk-life__intro">
          <h2 className="nk-h2">How we make sure fixes are real</h2>
          <p className="nk-lede">
            Complaints often vanish into a queue. Here, every ticket follows the same five steps in public, and it only
            closes when there&apos;s photo proof that the repair was done.
          </p>
        </div>

        <ol className="nk-life__track">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            const last = i === STAGES.length - 1;
            return (
              <li key={s.title} className={`nk-life__stage${last ? " nk-life__stage--done" : ""}`}>
                <div className="nk-life__marker">
                  <Icon size={18} aria-hidden />
                </div>
                <p className="nk-life__step">Step {i + 1}</p>
                <h3 className="nk-life__title">{s.title}</h3>
                <p className="nk-life__who">{s.who}</p>
                <p className="nk-life__body">{s.body}</p>
              </li>
            );
          })}
        </ol>

        <p className="nk-life__loop">
          <RotateCcw size={16} aria-hidden />
          If the after-photo doesn&apos;t show a complete repair, the ticket goes back to the field team instead of closing.
        </p>

        <div className="nk-life__notes">
          <p>
            <Info size={16} aria-hidden />
            <span>
              <strong>Photos are checked by people, not AI.</strong> Software can&apos;t reliably tell whether a photo is
              genuine, so Nagrik keeps a tamper-evident fingerprint of each photo and a person reviews it.
            </span>
          </p>
          <p>
            <Info size={16} aria-hidden />
            <span>
              <strong>An independent pilot.</strong> Nagrik isn&apos;t run by, connected to, or endorsed by CIDCO, PMC or
              any government body.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
