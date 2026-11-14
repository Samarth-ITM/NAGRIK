import { PILOT_CONFIG } from "@/lib/config/pilot";
import { MapPin, Navigation, ShieldAlert, Check, X } from "lucide-react";

export function PilotArea() {
  return (
    <section id="pilot-area" className="py-16 md:py-24 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="max-w-2xl mx-auto text-center space-y-3 mb-14">
          <span className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
            Operating Boundary
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Pilot Scope: Sector 4, Kharghar
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            To ensure high operational focus and rapid field verification, Nagrik begins with a controlled 500-metre demonstration perimeter.
          </p>
        </div>

        {/* Pilot Detail Card */}
        <div className="max-w-4xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 overflow-hidden shadow-xs">
          <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Col 1: Geography & Anchor */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-600 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {PILOT_CONFIG.name}
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    ID: {PILOT_CONFIG.id}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <strong className="block text-slate-900 dark:text-white mb-0.5">
                    Reference Anchor:
                  </strong>
                  {PILOT_CONFIG.anchorDescription}
                  <span className="block text-[11px] text-slate-400 mt-1 font-mono">
                    Lat: {PILOT_CONFIG.centreLatitude.toFixed(4)} &middot; Lon: {PILOT_CONFIG.centreLongitude.toFixed(4)}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <strong className="block text-slate-900 dark:text-white mb-0.5">
                    Operating Radius:
                  </strong>
                  {PILOT_CONFIG.radiusMetres} metres straight-line Haversine geofence.
                  <span className="block text-[11px] text-slate-400 mt-1">
                    Reports originating outside this perimeter are transparently routed to out-of-area advisory without ticket creation.
                  </span>
                </div>
              </div>
            </div>

            {/* Col 2: What is Included vs Excluded */}
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white mb-3">
                  Inclusion &amp; Exclusion Policy
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2 text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Included:</strong> Publicly accessible thoroughfares, footpaths, stormwater drains, public lighting, and municipal trash collection points.
                    </span>
                  </div>

                  <div className="flex items-start gap-2 text-rose-800 dark:text-rose-300 bg-rose-50/60 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-100 dark:border-rose-900/40">
                    <X className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Excluded:</strong> Campus interior plots, private residential society roads, and commercial establishments unless explicitly authorised.
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-2">
                <ShieldAlert className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Boundary shown is an illustrative pilot perimeter, not a surveyed municipal ward.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
