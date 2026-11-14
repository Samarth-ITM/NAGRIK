import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-8 bg-white dark:bg-slate-900 shadow-sm w-full">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Nagrik Portal Sign In
        </h1>
        <p className="text-xs text-slate-500 mb-6">
          Phase 1 route placeholder. Authentication will be implemented in Phase 3.
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
