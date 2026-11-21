import { Shield, Lock, EyeOff, MapPin, Database, CheckCircle2 } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-950 py-12 md:py-20">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-100 dark:bg-brand-950/80 text-brand-800 dark:text-brand-300 text-xs font-semibold mb-4 border border-brand-200 dark:border-brand-800">
            <Shield className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>Citizen data protection & privacy</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Privacy Policy & Cryptographic Guarantee
          </h1>
          <p className="mt-3 text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Nagrik is built with a privacy-by-design architecture. Citizens do not create accounts, plain-text phone numbers are never stored, and civic reports cannot be reverse-engineered to track individuals.
          </p>
        </div>

        {/* Core Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Card 1 */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <EyeOff className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              No email or phone number needed
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Citizens report only through the Telegram bot. The bot asks for a name and a password, which also let you see your own tickets on this website. We never ask for your email address or phone number, and passwords are stored only as salted hashes.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              HMAC-SHA256 Pseudonymization
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Your Telegram User ID is deterministically salted and hashed into an irreversible 64-character hexadecimal key. Even with direct database access, no one can compute your actual identity or Telegram handle.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              AES-256-GCM Notification Encryption
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              The internal chat identifier required to send you status updates is encrypted with authenticated AES-256-GCM using fresh 12-byte initialization vectors. It is decrypted strictly in memory at the exact moment a notification is dispatched.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              25–50m Spatial Discretization
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              To prevent revealing exact home doorsteps or private building entrances, all publicly published coordinates are snapped to a ~25–50m geographical grid (0.0003 degree step) before appearing on the public map.
            </p>
          </div>
        </div>

        {/* Detailed Disclosure Section */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-3">
            Operational Boundaries & Data Lifecycle
          </h2>

          <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 dark:text-slate-200">Pilot Geofence:</strong>{" "}
                Nagrik covers Kharghar, Navi Mumbai: a circle of about 6 km around the Kharghar city centre, which includes all its sectors. Reports with a location outside this area are not accepted.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 dark:text-slate-200">Private Evidence Storage:</strong>{" "}
                Citizen photographs and voice notes are stored in private, unexposed cloud buckets with access restricted to authenticated administrators. Only approved before/after repair photos are published.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 dark:text-slate-200">Advisory AI & No Facial Recognition:</strong>{" "}
                AI models (OpenAI) are used strictly server-side by human reviewers to evaluate before/after repair photographs. AI is never used for surveillance, biometric identification, or facial recognition.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 dark:text-slate-200">No Advertising or Commercial Tracking:</strong>{" "}
                Nagrik contains no advertising trackers, analytics scripts, or commercial surveillance SDKs.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
