import Link from "next/link";

import { FilterTabs } from "@/components/ui/filter-tabs";
import type { CommunityBudgetBreakdownItem, CommunityDataLevel, CommunityEconomicsSummary } from "@/types/domain";

type CommunityTaxesSpendingSectionProps = {
  summary: CommunityEconomicsSummary;
  communityId: string;
  selectedLevel: CommunityDataLevel;
  levelTabs?: Array<{
    label: string;
    href: string;
    active: boolean;
  }>;
};

const COLORS = ["#0f766e", "#2563eb", "#f97316", "#7c3aed", "#e11d48", "#64748b"] as const;

function buildGradient(items: CommunityBudgetBreakdownItem[]) {
  let offset = 0;

  return items
    .map((item, index) => {
      const start = offset;
      const end = offset + item.percentage;
      offset = end;
      return `${COLORS[index % COLORS.length]} ${start}% ${end}%`;
    })
    .join(", ");
}

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

function BreakdownPanel({
  title,
  items,
  communityId,
}: {
  title: string;
  items: CommunityBudgetBreakdownItem[];
  communityId: string;
}) {
  return (
    <div className="rounded-3xl bg-slate-50 p-5">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        <div
          aria-hidden="true"
          className="h-24 w-24 shrink-0 rounded-full border-4 border-white shadow-inner"
          style={{ background: `conic-gradient(${buildGradient(items)})` }}
        />
      </div>

      <div className="mt-5 space-y-3">
        {items.map((item, index) => (
          <div key={item.label} className="rounded-2xl bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <p className="text-sm font-semibold text-ink">{item.label}</p>
              </div>
              <p className="text-sm font-semibold text-slate-700">{item.percentage}%</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
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
                Discussions
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CommunityTaxesSpendingSection({
  summary,
  communityId,
  selectedLevel,
  levelTabs,
}: CommunityTaxesSpendingSectionProps) {
  const topSpendingHighlights = [...summary.spendingBreakdown]
    .sort((left, right) => right.percentage - left.percentage)
    .slice(0, 3)
    .map((item) => `${item.label} (${item.percentage}%)`);

  return (
    <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-civic-700">Taxes &amp; Spending</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">How this level collects money and where it goes</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{summary.dataNote}</p>
        </div>
        {levelTabs?.length ? (
          <div className="min-w-[220px]">
            <FilterTabs tabs={levelTabs} />
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current view</p>
          <p className="mt-2 text-xl font-semibold text-ink">
            {summary.geographyLabel} ({summary.levelLabel})
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Simplified / estimated budget context for the {selectedLevel} layer of your community experience.
          </p>
        </div>
        <div className="rounded-3xl bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Estimated personal impact</p>
          <p className="mt-2 text-xl font-semibold text-ink">{formatCurrency(summary.estimatedAnnualTaxContribution)}</p>
          <p className="mt-3 text-sm text-slate-600">Approximate annual tax contribution using seeded average-income assumptions for this demo.</p>
        </div>
        <div className="rounded-3xl bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Biggest spending areas</p>
          <div className="mt-3 space-y-2">
            {topSpendingHighlights.map((item) => (
              <p key={item} className="text-sm font-medium text-slate-700">
                {item}
              </p>
            ))}
          </div>
        </div>
      </div>

      <details className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/80 p-4" open>
        <summary className="cursor-pointer list-none text-sm font-semibold text-civic-700">
          Expand revenue and spending details
        </summary>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <BreakdownPanel title="Where It Comes From" items={summary.revenueBreakdown} communityId={communityId} />
          <BreakdownPanel title="Where It Goes" items={summary.spendingBreakdown} communityId={communityId} />
        </div>
      </details>
    </section>
  );
}
