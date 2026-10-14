import type { PollingComparisonSummary } from "@/types/domain";

type PollingComparisonCardProps = {
  comparisons: PollingComparisonSummary[];
};

export function PollingComparisonCard({ comparisons }: PollingComparisonCardProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Polling comparison</p>
      <p className="mt-2 text-sm text-slate-600">Platform sentiment and external polling are shown side by side for context. Demo data only.</p>
      <div className="mt-5 grid gap-4">
        {comparisons.map((comparison) => (
          <article key={`${comparison.source}-${comparison.fieldDate}`} className="rounded-3xl bg-slate-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{comparison.source}</p>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{comparison.fieldDate}</span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">External polling</p>
                <p className="mt-2 text-sm font-semibold text-ink">{comparison.externalResult}</p>
              </div>
              <div className="rounded-2xl bg-civic-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-civic-700">Platform sentiment</p>
                <p className="mt-2 text-sm font-semibold text-civic-900">{comparison.platformSentiment}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{comparison.differenceLabel}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
