"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-[#050b16] text-slate-100 antialiased">
        <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10">
          <section className="w-full rounded-[1.75rem] border border-orange-200 bg-white/90 p-8 text-slate-800 shadow-card backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-700">Something went wrong</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">Direct Democracy could not load cleanly</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Refresh the page or try again. If the issue was caused by a stale development bundle, a clean restart should clear it.
            </p>
            {error.digest ? <p className="mt-3 text-xs text-slate-400">{error.digest}</p> : null}
            <button
              type="button"
              onClick={reset}
              className="mt-5 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
