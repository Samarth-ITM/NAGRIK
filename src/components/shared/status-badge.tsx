import { cn } from "@/lib/utils";
import type { SpotStatus } from "@/types";

export interface StatusBadgeProps {
  status: SpotStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getBadgeStyle = (s: SpotStatus) => {
    switch (s) {
      case "NEW":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
      case "UNDER_REVIEW":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
      case "VERIFIED":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300";
      case "ASSIGNED":
      case "HANDED_OFF":
      case "AUTHORITY_ACKNOWLEDGED":
      case "IN_PROGRESS":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300";
      case "RESOLUTION_SUBMITTED":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
      case "RESOLVED":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
      case "REOPENED":
        return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300";
      case "REJECTED":
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        getBadgeStyle(status),
        className
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
