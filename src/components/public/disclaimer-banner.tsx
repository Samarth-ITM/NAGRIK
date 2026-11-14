import { AlertCircle } from "lucide-react";

export function DisclaimerBanner() {
  return (
    <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-900/60 px-4 py-2 text-xs text-amber-900 dark:text-amber-200">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <span>
            <strong>INDEPENDENT CIVIC PILOT:</strong> Nagrik is a research and civic coordination platform for Sector 4, Kharghar. It is not an official government portal, CIDCO service, or PMC grievance system.
          </span>
        </div>
        <span className="hidden sm:inline-block text-[11px] font-medium opacity-80 shrink-0">
          Pilot Geofence: 500m Radius
        </span>
      </div>
    </div>
  );
}
