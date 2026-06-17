import Link from "next/link";

import type { CampaignFinanceDashboard } from "@/lib/nv-sos/finance-dashboard";

function formatDate(value: string | null) {
  if (!value) return "Update pending";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatMoney(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Pending";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export function CampaignFinanceSourceNote({ dashboard }: { dashboard: CampaignFinanceDashboard }) {
  const latestReportText = dashboard.summary.latestReportLabel
    ? `${dashboard.summary.latestReportLabel}${dashboard.summary.latestReportYear ? ` · ${dashboard.summary.latestReportYear}` : ""}`
    : "Latest report pending";

  return (
    <div className="rounded-[1.1rem] border border-cyan-300/15 bg-cyan-400/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Financial Transparency</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            Source: Nevada Secretary of State. Totals are parsed from cached official SoS report pages. When enough clean itemized rows exist, donor and spending categories are deterministic inferences from public filing text and should be reviewed against the source reports.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Last successfully fetched from Nevada Secretary of State on {formatDate(dashboard.summary.lastFetchedAt)}.
          </p>
        </div>
        {dashboard.summary.latestReportUrl ? (
          <Link href={dashboard.summary.latestReportUrl} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-100 hover:border-cyan-300/30">
            Latest: {latestReportText}
          </Link>
        ) : null}
      </div>

      {dashboard.sourceReports.length ? (
        <details className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100">View source reports</summary>
          <div className="mt-3 max-h-80 space-y-2 overflow-auto pr-1">
            {dashboard.sourceReports.map((report) => (
              <Link key={report.sourceUrl} href={report.sourceUrl} className="block rounded-2xl border border-white/10 bg-white/[0.04] p-3 hover:border-cyan-300/30">
                <span className="block text-sm font-semibold text-slate-100">
                  {report.label}{report.year ? ` · ${report.year}` : ""}
                </span>
                {report.period ? <span className="mt-1 block text-xs text-slate-500">{report.period}</span> : null}
                <span className="mt-2 grid gap-1 text-xs text-slate-300 sm:grid-cols-3">
                  <span>Raised: {formatMoney(report.totalContributions)}</span>
                  <span>Spent: {formatMoney(report.totalExpenses)}</span>
                  <span>Cash: {formatMoney(report.cashOnHand)}</span>
                </span>
              </Link>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
