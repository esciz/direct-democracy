import Link from "next/link";

import type { CommunityBudgetBreakdownItem, CommunityEconomicsSummary } from "@/types/domain";

type CommunityBudgetSectionProps = {
  summary: CommunityEconomicsSummary;
  communityId: string;
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

function BreakdownCard({
  title,
  subtitle,
  items,
  communityId,
}: {
  title: string;
  subtitle: string;
  items: CommunityBudgetBreakdownItem[];
  communityId: string;
}) {
  return (
    <div className="rounded-3xl bg-slate-50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
        </div>
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
            {(item.relatedIssue || item.relatedOfficialId) ? (
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
                  Community discussion
                </Link>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CommunityBudgetSection({ summary, communityId }: CommunityBudgetSectionProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-civic-700">Government Revenue &amp; Spending</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Where it comes from and where it goes</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{summary.dataNote}</p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <BreakdownCard
          title="Where It Comes From"
          subtitle="Simplified revenue categories for how this level of government is funded."
          items={summary.revenueBreakdown}
          communityId={communityId}
        />
        <BreakdownCard
          title="Where It Goes"
          subtitle="Simplified spending categories showing the biggest buckets in the current seeded view."
          items={summary.spendingBreakdown}
          communityId={communityId}
        />
      </div>
    </section>
  );
}
