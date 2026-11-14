import { ShieldCheck, Eye, FileText, CheckCircle2, UserCheck, AlertCircle, Ban } from "lucide-react";

export function AccountabilitySection() {
  const principles = [
    {
      icon: Eye,
      title: "1. Human Super-Admin Review",
      description:
        "Every citizen submission is manually checked for location validity and correct taxonomy placement before becoming a verified physical spot. No automated AI algorithm can reject or merge issues autonomously.",
    },
    {
      icon: FileText,
      title: "2. Verifiable Handoff Proof",
      description:
        "Setting an issue to 'Handed Off' requires the administrator to record the real destination department, submission date, method, and documentary proof. Nagrik never fabricates government complaint references.",
    },
    {
      icon: CheckCircle2,
      title: "3. Mandatory Repair Evidence",
      description:
        "Authorities cannot simply mark an issue 'Resolved'. They must submit a resolution request containing mandatory after-repair photographs and a completion note before verification can proceed.",
    },
    {
      icon: UserCheck,
      title: "4. Independent Final Approval",
      description:
        "Final resolution approval rests solely with the platform super-admin. The reviewer inspects before and after photos side-by-side. If work is incomplete, the issue is remanded back to in-progress.",
    },
  ];

  return (
    <section id="accountability" className="py-16 md:py-24 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="max-w-2xl mx-auto text-center space-y-3 mb-14">
          <span className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
            Verification Protocol
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Accountability &amp; Evidence Architecture
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Civic grievances often disappear into opaque queues. Nagrik enforces strict evidence barriers so that issues are only closed when physical repairs are genuinely confirmed.
          </p>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
          {principles.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Strict Operating Disclaimers Card */}
        <div className="max-w-4xl mx-auto p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 mb-3 text-slate-900 dark:text-white font-bold text-sm">
            <ShieldCheck className="w-4 h-4 text-brand-600" />
            <span>Honest Engineering Boundaries</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-start gap-2">
              <Ban className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <p>
                <strong>No AI Authenticity Claims:</strong> Vision models cannot reliably certify whether a photograph is unstaged or genuine. Nagrik records cryptographic SHA-256 provenance and relies on human visual audit.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p>
                <strong>No Unauthorised Integrations:</strong> Nagrik is an independent research pilot in Kharghar. We do not claim any official government endorsement, API connection, or formal partnership with CIDCO or PMC.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
