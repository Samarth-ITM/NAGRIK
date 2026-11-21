import { cn } from "@/lib/utils";
import type { SpotStatus } from "@/types";

export interface StatusBadgeProps {
  status: SpotStatus;
  className?: string;
}

/** Plain-language labels for status codes (shared by the badge, map popups and dashboards). */
export const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  UNDER_REVIEW: "Under review",
  VERIFIED: "Verified",
  ASSIGNED: "Assigned",
  HANDED_OFF: "Handed off",
  AUTHORITY_ACKNOWLEDGED: "Acknowledged",
  IN_PROGRESS: "In progress",
  RESOLUTION_SUBMITTED: "Repair submitted",
  RESOLVED: "Fixed",
  REOPENED: "Reopened",
  REJECTED: "Closed",
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "";
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getBadgeStyle = (s: SpotStatus) => {
    switch (s) {
      case "NEW":
        return "bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-200 border border-blue-200 dark:border-blue-800";
      case "UNDER_REVIEW":
        return "bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-200 dark:border-amber-800";
      case "VERIFIED":
        return "bg-indigo-100 text-indigo-900 dark:bg-indigo-950/80 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800";
      case "ASSIGNED":
      case "HANDED_OFF":
      case "AUTHORITY_ACKNOWLEDGED":
      case "IN_PROGRESS":
        return "bg-purple-100 text-purple-900 dark:bg-purple-950/80 dark:text-purple-200 border border-purple-200 dark:border-purple-800";
      case "RESOLUTION_SUBMITTED":
        return "bg-orange-100 text-orange-900 dark:bg-orange-950/80 dark:text-orange-200 border border-orange-200 dark:border-orange-800";
      case "RESOLVED":
        return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800";
      case "REOPENED":
        return "bg-rose-100 text-rose-900 dark:bg-rose-950/80 dark:text-rose-200 border border-rose-200 dark:border-rose-800";
      case "REJECTED":
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
    }
  };

  const getDotColor = (s: SpotStatus) => {
    switch (s) {
      case "NEW":
        return "bg-blue-600";
      case "UNDER_REVIEW":
        return "bg-amber-600";
      case "VERIFIED":
        return "bg-indigo-600";
      case "ASSIGNED":
      case "HANDED_OFF":
      case "AUTHORITY_ACKNOWLEDGED":
      case "IN_PROGRESS":
        return "bg-purple-600 animate-pulse";
      case "RESOLUTION_SUBMITTED":
        return "bg-orange-600";
      case "RESOLVED":
        return "bg-emerald-600";
      case "REOPENED":
        return "bg-rose-600";
      case "REJECTED":
        return "bg-slate-400";
      default:
        return "bg-slate-400";
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0",
        getBadgeStyle(status),
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", getDotColor(status))} />
      <span>{statusLabel(status)}</span>
    </span>
  );
}
