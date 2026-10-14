import Link from "next/link";

import type { CampaignFinanceRawRow } from "@/lib/nv-sos/finance-dashboard";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function RecordRow({ row }: { row: CampaignFinanceRawRow }) {
  return (
    <Link href={row.sourceUrl} className="block rounded-2xl border border-white/10 bg-white/[0.04] p-3 hover:border-cyan-300/30">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="max-w-full break-words text-sm font-semibold leading-5 text-slate-100 [overflow-wrap:anywhere]">{row.displayName}</p>
          {row.originalName !== row.displayName ? (
            <p className="mt-1 max-w-full break-words text-[11px] leading-4 text-slate-500 [overflow-wrap:anywhere]">Raw: {row.originalName}</p>
          ) : null}
          {row.normalizedName !== row.displayName ? (
            <p className="mt-1 max-w-full break-words text-[11px] leading-4 text-slate-500 [overflow-wrap:anywhere]">Normalized: {row.normalizedName}</p>
          ) : null}
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {row.reportLabel ?? "Parsed report"}{row.reportYear ? ` · ${row.reportYear}` : ""}{row.date ? ` · ${row.date}` : ""}
          </p>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="text-sm font-semibold text-slate-100">{formatMoney(row.amount)}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{row.confidence} confidence</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{row.isAdjustment ? "Adjustment" : row.fundingCategory}</span>
        {row.spendingCategory ? <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{row.spendingCategory}</span> : null}
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{row.entityType}</span>
        {row.industry !== "Other" ? <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{row.industry}</span> : null}
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{row.classificationSource}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        {row.reason} Entity: {row.entityTypeReason} Industry: {row.industryReason}
      </p>
    </Link>
  );
}

export function CampaignFinanceRawRecords({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: CampaignFinanceRawRow[];
  emptyText: string;
}) {
  const safeRows = rows.filter((row) => !row.isBoilerplate);

  return (
    <details className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-4">
      <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100">
        {title} <span className="text-slate-500">({safeRows.length})</span>
      </summary>
      {safeRows.length ? (
        <div className="mt-4 max-h-96 space-y-2 overflow-auto pr-1">
          {safeRows.map((row) => (
            <RecordRow key={row.id} row={row} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-400">{emptyText}</p>
      )}
    </details>
  );
}
