import { MessageSquare, ListFilter, Camera, MapPin, Ticket, Activity, CheckCircle2 } from "lucide-react";

export function HowItWorks() {
  const steps = [
    {
      num: "01",
      icon: MessageSquare,
      title: "Open Telegram Bot",
      desc: "Send /start to the Nagrik bot and choose your preferred language: English, हिन्दी (Hindi), or मराठी (Marathi).",
      badge: "Language Select",
    },
    {
      num: "02",
      icon: ListFilter,
      title: "Select Issue Category",
      desc: "Navigate through the structured 3-tier guided taxonomy: Roads, Sanitation, or Public Utilities.",
      badge: "Standardised Taxonomy",
    },
    {
      num: "03",
      icon: Camera,
      title: "Capture Evidence",
      desc: "Upload up to 3 photographs of the defect, an optional voice note (up to 60s), or a brief text description.",
      badge: "Multi-modal Evidence",
    },
    {
      num: "04",
      icon: MapPin,
      title: "Share Location Pin",
      desc: "Share your GPS location or drop a pin directly onto the defect inside the 500m Kharghar Sector 4 pilot boundary.",
      badge: "500m Geofence",
    },
    {
      num: "05",
      icon: Ticket,
      title: "Receive Unique Ticket",
      desc: "Nagrik assigns a permanent ticket code (e.g. NAG-KHR-2026-000001) that remains linked to your private Telegram ID.",
      badge: "Traceable Ticket",
    },
    {
      num: "06",
      icon: Activity,
      title: "Track Action & Handoff",
      desc: "Receive automated Telegram alerts when an administrator reviews the issue, assigns it, or records an official handoff.",
      badge: "Real-time Updates",
    },
    {
      num: "07",
      icon: CheckCircle2,
      title: "Review Verified Repair",
      desc: "Before an issue is marked resolved, after-repair evidence is uploaded and reviewed by super-admins.",
      badge: "Evidence-Based Closure",
    },
  ];

  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-4">
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center space-y-3 mb-14">
          <span className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
            Citizen Workflow
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            How Civic Reporting Works
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            A guided 7-step journey from spotting a local defect to transparent verification without bureaucracy.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="relative p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-brand-300 dark:hover:border-brand-700 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-black text-slate-300 dark:text-slate-700 tracking-tighter">
                      {step.num}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {step.badge}
                    </span>
                  </div>

                  <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5" />
                  </div>

                  <h3 className="font-semibold text-base text-slate-900 dark:text-white mb-2">
                    {step.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {step.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                  <span>Step {idx + 1} of 7</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
