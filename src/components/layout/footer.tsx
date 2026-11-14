import Link from "next/link";
import { Shield, ExternalLink, MapPin, AlertTriangle } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-xs">
      {/* Upper footer */}
      <div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Col 1: About Nagrik */}
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <div className="w-6 h-6 rounded bg-brand-600 flex items-center justify-center text-white">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm tracking-tight font-extrabold">NAGRIK</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Pilot v1.0
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
            Nagrik is a civic intelligence and grievance coordination platform. Citizens report civic infrastructure defects through Telegram. Reports are organised into real-world physical issues, tracked deterministically, and resolved only with verified evidence.
          </p>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <MapPin className="w-4 h-4 text-brand-600 shrink-0" />
            <span>Pilot Boundary: 500m radius around ITM Skills University, Sector 4, Kharghar, Navi Mumbai</span>
          </div>
        </div>

        {/* Col 2: Navigation */}
        <div className="space-y-2.5">
          <h4 className="font-semibold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
            Platform
          </h4>
          <ul className="space-y-1.5">
            <li>
              <Link href="/#how-it-works" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
                How It Works
              </Link>
            </li>
            <li>
              <Link href="/#categories" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
                Issue Categories
              </Link>
            </li>
            <li>
              <Link href="/#issues" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
                Public Issues Map
              </Link>
            </li>
            <li>
              <Link href="/#accountability" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
                Verification Workflow
              </Link>
            </li>
            <li>
              <Link href="/#pilot-area" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
                Pilot Geofence
              </Link>
            </li>
          </ul>
        </div>

        {/* Col 3: Governance & Access */}
        <div className="space-y-2.5">
          <h4 className="font-semibold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
            Access & Legal
          </h4>
          <ul className="space-y-1.5">
            <li>
              <Link href="/login" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
                Authority Portal Login
              </Link>
            </li>
            <li>
              <Link href="/api/health" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
                System Health Status
              </Link>
            </li>
            <li>
              <span className="text-slate-400 dark:text-slate-500">Privacy Notice (Phase 3)</span>
            </li>
            <li>
              <span className="text-slate-400 dark:text-slate-500">Terms of Pilot (Phase 3)</span>
            </li>
            <li>
              <a
                href="mailto:pilot@nagrik.local"
                className="hover:text-brand-600 dark:hover:text-brand-400 transition inline-flex items-center gap-1"
              >
                <span>Contact Pilot Team</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Disclaimers & Copyright */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-4 py-6">
        <div className="max-w-6xl mx-auto space-y-3">
          <div className="flex items-start gap-2 text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p>
              <strong>Disclaimer:</strong> Nagrik is an independent pilot technology platform operating in Sector 4, Kharghar. It is not an official grievance portal of City and Industrial Development Corporation (CIDCO), Panvel Municipal Corporation (PMC), or the Government of Maharashtra. No official partnership or integration is claimed or implied during this pilot phase. All demonstration data is synthetic and clearly segregated.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">
            <p>&copy; {currentYear} Nagrik Project. Open Civic Intelligence Platform.</p>
            <p>Built with Next.js &middot; Supabase &middot; Telegram Bot API &middot; Leaflet</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
