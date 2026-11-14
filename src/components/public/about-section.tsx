import { Info, Target, Eye, Users, Shield, Cpu } from "lucide-react";

export function AboutSection() {
  return (
    <section id="about" className="py-16 md:py-24 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="max-w-2xl mx-auto text-center space-y-3 mb-14">
          <span className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
            About the Project
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Civic Intelligence for Kharghar
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nagrik is built on the belief that municipal accountability improves when reporting is frictionless for citizens, transparent to the public, and grounded in verifiable evidence.
          </p>
        </div>

        {/* 3 Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Accessibility as Entry Point
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Citizens already use Telegram daily. By removing web account barriers and supporting native Marathi and Hindi, reporting a broken paver or open drain takes less than two minutes.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Civic Intelligence Layer
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              When three citizens report the same pothole from different angles, Nagrik groups them under one canonical physical spot without erasing individual submission tickets.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Deterministic, Not AI-Hype
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              No black-box AI model decides whether an issue exists or can be resolved. Physical proximity uses exact mathematical Haversine calculations; resolution requires human photographic evidence.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
