import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-8">
      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-8 shadow-card backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Page not found</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-50">This civic page is not available</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
          The route may have moved, or the demo data for this item may not be available in the current workspace.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/explore" className="dd-button-primary rounded-full px-4 py-3 text-sm font-semibold">
            Open Explore
          </Link>
          <Link href="/" className="dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold">
            Home
          </Link>
        </div>
      </section>
    </div>
  );
}
