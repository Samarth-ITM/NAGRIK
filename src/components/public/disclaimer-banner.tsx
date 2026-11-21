import { AlertCircle } from "lucide-react";

export function DisclaimerBanner() {
  return (
    <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-900/60 px-4 py-2 text-xs text-amber-900 dark:text-amber-200">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <span>
            <strong>Independent civic pilot</strong> for Kharghar, Navi Mumbai (not an official CIDCO or NMMC portal). Dial <strong>112</strong> for emergencies.
          </span>
        </div>
        <span className="hidden sm:inline-block text-xs font-medium opacity-80 shrink-0">
          Covers all of Kharghar
        </span>
      </div>
    </div>
  );
}
