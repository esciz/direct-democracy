import type { IssueTrendSummary } from "@/types/domain";

type CommunityTrendingSectionProps = {
  trends: IssueTrendSummary[];
  window: "7d" | "30d";
  windowTabs: Array<{
    label: string;
    href: string;
    active: boolean;
  }>;
};

function TrendSparkline({ values }: { values: number[] }) {
  if (!values.length) {
    return null;
  }

  const max = Math.max(...values, 1);
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${100 - (value / max) * 100}`).join(" ");

  return (
    <svg viewBox="0 0 100 100" className="h-10 w-24 overflow-visible" aria-hidden="true">
      <polyline fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

export function CommunityTrendingSection({ trends, window, windowTabs }: CommunityTrendingSectionProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-civic-700">Trending in Your Community</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">What&apos;s changing</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Based on recent community activity. This is a lightweight trend view from seeded issue snapshots, not precise polling.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {windowTabs.map((tab) => (
            <a
              key={tab.href}
              href={tab.href}
              className={
                tab.active
                  ? "inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                  : "inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              }
            >
              {tab.label}
            </a>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {trends.length ? (
          trends.map((trend) => {
            const isUp = trend.direction === "up";
            const isDown = trend.direction === "down";
            const changeLabel = `${trend.change > 0 ? "+" : ""}${trend.change}%`;

            return (
              <article key={`${trend.issue}-${window}`} className="rounded-3xl bg-slate-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-ink">{trend.issue}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      {trend.currentPercentage}% now · {trend.previousPercentage}% {window === "7d" ? "7 days ago" : "30 days ago"}
                    </p>
                  </div>
                  <div
                    className={
                      isUp
                        ? "rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700"
                        : isDown
                          ? "rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700"
                          : "rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700"
                    }
                  >
                    {isUp ? "↑" : isDown ? "↓" : "→"} {changeLabel}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-4 text-slate-500">
                  <TrendSparkline values={trend.snapshots} />
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Recent snapshot trend</p>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600 xl:col-span-2">
            No trend snapshots are available for this community yet.
          </div>
        )}
      </div>
    </section>
  );
}
