import Link from "next/link";
import { Send, MapPin, Camera, ShieldCheck, ArrowDown, AlertCircle } from "lucide-react";
import { getTelegramConfig } from "@/lib/telegram/config";

export function Hero() {
  const telegramConfig = getTelegramConfig();
  const isConfigured = Boolean(telegramConfig.botUsername);
  const botUsername = telegramConfig.botUsername || "NagrikCivicBot";
  const telegramUrl = `https://t.me/${botUsername}`;

  return (
    <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 bg-gradient-to-b from-brand-50/50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100/80 dark:bg-brand-950/80 text-brand-800 dark:text-brand-300 text-xs font-semibold border border-brand-200 dark:border-brand-800/80 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
            <span>Pilot Live in Sector 4, Kharghar (500m ITM Geofence)</span>
          </div>

          {/* Core Proposition */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
            Report civic problems. <br className="hidden sm:inline" />
            <span className="text-brand-600 dark:text-brand-400">Track action.</span> Verify resolution.
          </h1>

          {/* Description */}
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Citizens report local road hazards, sanitation failures, and broken public utilities directly on Telegram using photos and GPS location. Verified by administrators, tracked deterministically, and closed only with verified repair evidence.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {isConfigured ? (
              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 shadow-md shadow-brand-600/20 transition group focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <Send className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                <span>Report an Issue on Telegram</span>
              </a>
            ) : (
              <div
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-semibold text-sm cursor-not-allowed"
                title="Bot handle not configured in local environment"
              >
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Telegram Bot Unavailable (Demo Mode)</span>
              </div>
            )}

            <Link
              href="/#issues"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <span>Explore Public Issues</span>
              <ArrowDown className="w-4 h-4 opacity-60" />
            </Link>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 pt-1">
            <span>Primary channel:</span>
            {isConfigured ? (
              <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                @{botUsername}
              </code>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-medium text-[11px]">
                Not configured in environment (Sample Mode)
              </span>
            )}
            <span className="text-slate-400">&bull; No website account required for citizens</span>
          </div>
        </div>

        {/* Feature pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 max-w-4xl mx-auto">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-xs flex items-start gap-3.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                Telegram-First Reporting
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Submit photos, location pin, text, or voice notes in English, Hindi, or Marathi in under 2 minutes.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-xs flex items-start gap-3.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                Deterministic Spot Matching
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Reports are grouped into physical issues using fixed-anchor distance bands (0–5m / 5–10m) without AI guessing.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-xs flex items-start gap-3.5">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                Evidence-Backed Closure
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Authorities must upload mandatory after-repair photos. Final approval rests exclusively with the super-admin.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
