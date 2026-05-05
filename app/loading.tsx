export default function RootLoading() {
  return (
    <div className="py-8">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-8 shadow-card backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Loading</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">Preparing the civic view</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          We&apos;re loading the latest demo data for posts, petitions, elections, and public profiles.
        </p>
      </section>
    </div>
  );
}
