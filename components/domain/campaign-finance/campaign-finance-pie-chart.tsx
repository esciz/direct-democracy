import Link from "next/link";

import type { CampaignFinanceEntityRow } from "@/lib/nv-sos/finance-dashboard";

const COLORS = ["#22d3ee", "#34d399", "#f59e0b", "#f472b6", "#a78bfa", "#64748b"] as const;

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function polarToCartesian(center: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
}

function describeSlice(startAngle: number, endAngle: number) {
  const start = polarToCartesian(50, 40, endAngle);
  const end = polarToCartesian(50, 40, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M 50 50 L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A 40 40 0 ${largeArcFlag} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
}

export function CampaignFinancePieChart({
  title,
  subtitle = "Derived category share from parsed itemized rows.",
  items,
  emptyText,
}: {
  title: string;
  subtitle?: string;
  items: CampaignFinanceEntityRow[];
  emptyText: string;
}) {
  const safeItems = items.filter((item) => item.amount > 0);
  const total = safeItems.reduce((sum, item) => sum + item.amount, 0);

  if (!safeItems.length || total <= 0) {
    return (
      <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">{emptyText}</p>
      </div>
    );
  }

  let cursor = 0;
  const slices = safeItems.map((item, index) => {
    const startAngle = cursor;
    const endAngle = cursor + (item.amount / total) * 360;
    cursor = endAngle;
    return { item, startAngle, endAngle, color: COLORS[index % COLORS.length] };
  });

  return (
    <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm font-semibold text-slate-100">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-[140px_1fr] sm:items-center">
        <svg viewBox="0 0 100 100" className="mx-auto h-32 w-32" role="img" aria-label={title}>
          <title>{title}</title>
          {slices.length === 1 ? (
            <circle cx="50" cy="50" r="40" fill={slices[0].color} />
          ) : (
            slices.map((slice) => <path key={slice.item.name} d={describeSlice(slice.startAngle, slice.endAngle)} fill={slice.color} />)
          )}
          <circle cx="50" cy="50" r="23" fill="rgb(15 23 42)" opacity="0.92" />
        </svg>
        <div className="space-y-2">
          {safeItems.map((item, index) => {
            const row = (
              <>
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="min-w-0 flex-1">
                  <span className="block min-w-0 break-words text-sm font-semibold leading-5 text-slate-100 [overflow-wrap:anywhere]">{item.name}</span>
                  <span className="block text-xs text-slate-500">
                    {item.percentage.toFixed(1)}%{item.count ? ` · ${item.count} row${item.count === 1 ? "" : "s"}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-slate-200">{formatMoney(item.amount)}</span>
              </>
            );
            if (!item.sourceUrl) {
              return (
                <div key={item.name} className="flex items-start gap-2 rounded-2xl border border-white/10 bg-black/15 px-3 py-2">
                  {row}
                </div>
              );
            }
            return (
              <Link key={item.name} href={item.sourceUrl} className="flex items-start gap-2 rounded-2xl border border-white/10 bg-black/15 px-3 py-2 hover:border-cyan-300/30">
                {row}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
