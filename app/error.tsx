"use client";

import { formatUnknownError } from "@/lib/errors/format-error";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-8">
      <section className="rounded-[1.75rem] border border-orange-200 bg-white/90 p-8 shadow-card backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-700">Something went wrong</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">The page could not be loaded cleanly</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          Please try again. If the issue persists, resetting the demo state or refreshing the page should help.
        </p>
        <p className="mt-3 text-xs text-slate-400">{error.digest ?? formatUnknownError(error)}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Try again
        </button>
      </section>
    </div>
  );
}
