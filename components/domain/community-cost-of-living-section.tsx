import Link from "next/link";

import type { CommunityEconomicsSummary } from "@/types/domain";

type CommunityCostOfLivingSectionProps = {
  summary: CommunityEconomicsSummary;
  comparison: CommunityEconomicsSummary[];
  communityId: string;
};

function formatCurrency(value: number | null | undefined) {
  if (!value) {
    return "Not seeded";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function ComparisonCard({ item, active }: { item: CommunityEconomicsSummary; active: boolean }) {
  return (
    <div className={active ? "rounded-3xl bg-civic-50 p-4 ring-1 ring-civic-200" : "rounded-3xl bg-slate-50 p-4"}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{item.levelLabel}</p>
          <p className="mt-1 text-sm font-semibold text-ink">{item.geographyLabel}</p>
        </div>
        <span className={active ? "rounded-full bg-civic-600 px-3 py-1 text-xs font-semibold text-white" : "rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"}>
          {item.costOfLivingIndex}
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-600">Index relative to the national average of 100.</p>
    </div>
  );
}

export function CommunityCostOfLivingSection({
  summary,
  comparison,
  communityId,
}: CommunityCostOfLivingSectionProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-civic-700">Cost of Living</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">What everyday costs look like here</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{summary.dataNote}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
          Index: {summary.costOfLivingIndex}
        </span>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-3xl bg-slate-50 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Median home price</p>
              <p className="mt-2 text-xl font-semibold text-ink">{formatCurrency(summary.medianHomePrice)}</p>
            </div>
            <div className="rounded-2xl bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Median rent</p>
              <p className="mt-2 text-xl font-semibold text-ink">{formatCurrency(summary.medianRent)}</p>
            </div>
            <div className="rounded-2xl bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Average income</p>
              <p className="mt-2 text-xl font-semibold text-ink">{formatCurrency(summary.averageIncome)}</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {summary.costBreakdown.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-700">{item.label}</p>
                  <p className="text-sm font-semibold text-slate-900">{item.index}</p>
                </div>
                <div className="mt-2 h-3 rounded-full bg-slate-200">
                  <div className="h-3 rounded-full bg-civic-500" style={{ width: `${Math.min(item.index, 160) / 1.6}%` }} />
                </div>
                {(item.relatedIssue || item.relatedOfficialId) ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                    {item.relatedIssue ? (
                      <Link href={`/voting?search=${encodeURIComponent(item.relatedIssue)}`} className="text-civic-700 transition hover:text-civic-900">
                        Related issue
                      </Link>
                    ) : null}
                    {item.relatedOfficialId ? (
                      <Link href={`/officials/${item.relatedOfficialId}`} className="text-civic-700 transition hover:text-civic-900">
                        Responsible official
                      </Link>
                    ) : null}
                    <Link href={`/my-community?communityId=${communityId}`} className="text-civic-700 transition hover:text-civic-900">
                      Local discussion
                    </Link>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {comparison.map((item) => (
            <ComparisonCard key={item.id} item={item} active={item.id === summary.id} />
          ))}
        </div>
      </div>
    </section>
  );
}
