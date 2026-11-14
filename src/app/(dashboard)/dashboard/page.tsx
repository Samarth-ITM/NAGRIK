import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="flex-1 p-8 max-w-4xl mx-auto">
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-8 bg-white dark:bg-slate-900 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Nagrik Operational Dashboard
        </h1>
        <p className="text-xs text-slate-500 mb-6">
          Phase 1 route placeholder. Role-based dashboards (Super-Admin and Authority) will be implemented in Phase 3.
        </p>
        <Link
          href="/"
          className="text-xs text-brand-600 hover:underline"
        >
          &larr; Back to Home
        </Link>
      </div>
    </main>
  );
}
