import Link from "next/link";

import type { CampaignFinanceTimePoint } from "@/lib/nv-sos/finance-dashboard";

function formatCompactMoney(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Pending";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: value >= 1000000 ? 1 : 0,
  }).format(value);
}

function buildLine(points: CampaignFinanceTimePoint[], key: "cumulativeRaised" | "cumulativeSpent", maxValue: number) {
  const left = 18;
  const width = 284;
  const top = 18;
  const height = 86;
  return points
    .map((point, index) => {
      const x = left + (index / Math.max(points.length - 1, 1)) * width;
      const y = top + height - (point[key] / Math.max(maxValue, 1)) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function CampaignFinanceLineChart({ points }: { points: CampaignFinanceTimePoint[] }) {
  const safePoints = points.filter((point) => Number.isFinite(point.cumulativeRaised) || Number.isFinite(point.cumulativeSpent));
  const latest = safePoints.at(-1) ?? null;

  if (safePoints.length < 2 || !latest) {
    return (
      <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-semibold text-slate-100">Money over time</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">At least two parsed reports with contribution or expense totals are needed to draw the timeline.</p>
      </div>
    );
  }

  const maxValue = Math.max(...safePoints.flatMap((point) => [point.cumulativeRaised, point.cumulativeSpent]), 1);
  const raisedLine = buildLine(safePoints, "cumulativeRaised", maxValue);
  const spentLine = buildLine(safePoints, "cumulativeSpent", maxValue);

  return (
    <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Money over time</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Cumulative totals by parsed report order.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
          <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-cyan-100">Raised</span>
          <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-amber-100">Spent</span>
        </div>
      </div>

      <svg viewBox="0 0 320 126" className="mt-3 h-36 w-full overflow-visible" role="img" aria-label="Campaign money over time">
        <title>Campaign money over time</title>
        {[0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = 18 + 86 - ratio * 86;
          return <line key={ratio} x1="18" x2="302" y1={y} y2={y} stroke="rgba(148,163,184,0.16)" strokeWidth="1" />;
        })}
        <polyline fill="none" stroke="#22d3ee" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.4" points={raisedLine} />
        <polyline fill="none" stroke="#f59e0b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.9" points={spentLine} />
        <text x="18" y="121" fill="rgb(100,116,139)" fontSize="9" fontWeight="700">
          {safePoints[0]?.reportYear ?? safePoints[0]?.label}
        </text>
        <text x="302" y="121" fill="rgb(100,116,139)" fontSize="9" fontWeight="700" textAnchor="end">
          {latest.reportYear ?? latest.label}
        </text>
      </svg>

      <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
        <Link href={latest.sourceUrl} className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-3 hover:border-cyan-300/35">
          <span className="block text-xs text-cyan-100/70">Cumulative raised</span>
          <span className="mt-1 block font-semibold text-cyan-50">{formatCompactMoney(latest.cumulativeRaised)}</span>
        </Link>
        <Link href={latest.sourceUrl} className="rounded-2xl border border-amber-300/15 bg-amber-400/10 p-3 hover:border-amber-300/35">
          <span className="block text-xs text-amber-100/70">Cumulative spent</span>
          <span className="mt-1 block font-semibold text-amber-50">{formatCompactMoney(latest.cumulativeSpent)}</span>
        </Link>
      </div>
    </div>
  );
}
