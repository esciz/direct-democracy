import type { CommunityEconomicsSummary } from "@/types/domain";

type CommunityFinanceSnapshotProps = {
  summary: CommunityEconomicsSummary;
};

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Not seeded";
  }

  return `${value.toFixed(2)}%`;
}

export function CommunityFinanceSnapshot({ summary }: CommunityFinanceSnapshotProps) {
  const topSpendingHighlights = [...summary.spendingBreakdown]
    .sort((left, right) => right.percentage - left.percentage)
    .slice(0, 3);

  return (
    <section className="rounded-[1.75rem] border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-6 shadow-card sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Community Snapshot</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Cost, taxes, and spending at a glance</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            Simplified / estimated data for {summary.geographyLabel}. This quick read is meant to orient you before you dive into the full charts.
          </p>
        </div>
        <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
          Cost of living index: {summary.costOfLivingIndex}
        </span>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-3xl bg-white/90 p-5 shadow-sm">
          <p className="text-sm font-semibold text-ink">Key tax indicators</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Sales tax rate</p>
              <p className="mt-2 text-xl font-semibold text-ink">{formatPercent(summary.salesTaxRate)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Property tax estimate</p>
              <p className="mt-2 text-xl font-semibold text-ink">{formatPercent(summary.propertyTaxRateEstimate)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white/90 p-5 shadow-sm">
          <p className="text-sm font-semibold text-ink">Top spending highlights</p>
          <div className="mt-4 space-y-3">
            {topSpendingHighlights.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{item.label}</p>
                  <p className="text-xs text-slate-500">One of the biggest spending buckets in this view</p>
                </div>
                <p className="text-sm font-semibold text-emerald-700">{item.percentage}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
