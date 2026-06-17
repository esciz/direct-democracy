import Link from "next/link";

import type { CampaignFinanceEntityRow } from "@/lib/nv-sos/finance-dashboard";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function CampaignFinanceBarChart({
  title,
  subtitle = "Derived category totals from parsed itemized rows.",
  items,
  emptyText,
}: {
  title: string;
  subtitle?: string;
  items: CampaignFinanceEntityRow[];
  emptyText: string;
}) {
  const safeItems = items.filter((item) => item.amount > 0).slice(0, 8);
  const maxAmount = Math.max(...safeItems.map((item) => item.amount), 0);

  if (!safeItems.length || maxAmount <= 0) {
    return (
      <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm font-semibold text-slate-100">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
      <div className="mt-4 space-y-3">
        {safeItems.map((item) => {
          const width = Math.max((item.amount / maxAmount) * 100, 4);
          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-words text-sm font-semibold leading-5 text-slate-100 [overflow-wrap:anywhere]">{item.name}</p>
                <p className="shrink-0 text-sm font-semibold text-slate-200">{formatMoney(item.amount)}</p>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-800/80">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" style={{ width: `${width}%` }} />
              </div>
              {item.note || item.reportLabel || item.date ? (
                <p className="mt-1 text-xs text-slate-500">
                  {item.note ?? item.reportLabel ?? "Parsed category"}{item.date ? ` · ${item.date}` : ""}
                </p>
              ) : null}
            </>
          );

          if (!item.sourceUrl) {
            return (
              <div key={item.name} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                {content}
              </div>
            );
          }
          return (
            <Link key={item.name} href={item.sourceUrl} className="block rounded-2xl border border-white/10 bg-black/15 p-3 hover:border-cyan-300/30">
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
