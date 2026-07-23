import Link from "next/link";

import type { CampaignFinanceDashboard, CampaignFinanceRawRow, CampaignFinanceReviewRow, CampaignFinanceSourceReport } from "@/lib/nv-sos/finance-dashboard";

import { CampaignFinanceBarChart } from "./campaign-finance-bar-chart";
import { CampaignFinanceLineChart } from "./campaign-finance-line-chart";
import { CampaignFinanceMetricRow } from "./campaign-finance-metric-row";
import { CampaignFinancePieChart } from "./campaign-finance-pie-chart";
import { CampaignFinanceRawRecords } from "./campaign-finance-raw-records";
import { CampaignFinanceSourceNote } from "./campaign-finance-source-note";

function formatMoney(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Pending";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatCompactMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Pending";
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string | null) {
  if (!value) return "Not parsed";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatReportPeriod(value: string | null) {
  const text = (value ?? "").trim();
  if (!text) return "Not parsed";
  if (/^\d+\.\s+total\b/i.test(text) || /total monetary contributions|total amount of all/i.test(text)) return "Not parsed";
  return text;
}

function dateRangeText(dashboard: CampaignFinanceDashboard) {
  const years = dashboard.sourceReports.map((report) => report.year).filter((year): year is number => typeof year === "number" && Number.isFinite(year));
  if (years.length) {
    const min = Math.min(...years);
    const max = Math.max(...years);
    return min === max ? `${max}` : `${min}-${max}`;
  }
  const periods = dashboard.sourceReports.map((report) => report.period).filter((period): period is string => Boolean(period));
  if (periods.length) return periods.slice(-2).join(" to ");
  return "Report dates pending";
}

function latestReportText(dashboard: CampaignFinanceDashboard) {
  const summary = dashboard.summary;
  if (summary.latestReportLabel) return `${summary.latestReportLabel}${summary.latestReportYear ? ` · ${summary.latestReportYear}` : ""}`;
  return "Pending";
}

function adjustmentTotal(dashboard: CampaignFinanceDashboard) {
  return dashboard.rawAdjustmentRows.reduce((sum, row) => sum + row.amount, 0);
}

function classificationStatus(row: CampaignFinanceRawRow) {
  if (row.confidenceScore < 60 || row.entityType === "Unknown" || row.classificationSource === "Not enough signal") {
    return "needs review";
  }
  if (row.entityType === "Individual") return "individual";
  if (row.isOrganization) return "organization";
  return "unknown";
}

function sourceLabel(reportOrRow: Pick<CampaignFinanceRawRow, "sourceUrl" | "cachedPath"> | Pick<CampaignFinanceSourceReport, "sourceUrl" | "cachedPath">) {
  return reportOrRow.sourceUrl ? "Source report" : reportOrRow.cachedPath ? "Cached file" : "Source pending";
}

function SourceReference({ sourceUrl, cachedPath }: { sourceUrl: string | null; cachedPath: string | null }) {
  return (
    <div className="space-y-1">
      {sourceUrl ? (
        <Link href={sourceUrl} className="inline-flex text-xs font-semibold text-cyan-200 hover:text-cyan-100">
          {sourceLabel({ sourceUrl, cachedPath })}
        </Link>
      ) : null}
      {cachedPath ? <p className="break-all font-mono text-[10px] leading-4 text-slate-500">{cachedPath}</p> : null}
    </div>
  );
}

function ReportsParsedTable({ reports }: { reports: CampaignFinanceSourceReport[] }) {
  if (!reports.length) return null;

  return (
    <section className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Reports parsed</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Official report summaries provide totals. Row-level tables come from parsed contributor and payee records inside those source reports.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
          {formatNumber(reports.length)} source report{reports.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-4 max-h-[32rem] overflow-auto rounded-2xl border border-white/10">
        <table className="min-w-[980px] w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-950/95 text-[11px] uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-3 py-3 font-semibold">Report</th>
              <th className="px-3 py-3 font-semibold">Filing date</th>
              <th className="px-3 py-3 font-semibold">Reporting period</th>
              <th className="px-3 py-3 text-right font-semibold">Contributions</th>
              <th className="px-3 py-3 text-right font-semibold">Expenditures</th>
              <th className="px-3 py-3 text-right font-semibold">Cash</th>
              <th className="px-3 py-3 text-right font-semibold">Rows</th>
              <th className="px-3 py-3 font-semibold">Source</th>
              <th className="px-3 py-3 font-semibold">Parser</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {reports.map((report) => (
              <tr key={report.sourceUrl} className="align-top text-slate-300">
                <td className="px-3 py-3">
                  <p className="font-semibold text-slate-100">{report.label}</p>
                  {report.year ? <p className="mt-1 text-slate-500">{report.year}</p> : null}
                </td>
                <td className="px-3 py-3 text-slate-400">{formatDate(report.filingDate)}</td>
                <td className="px-3 py-3 text-slate-400">{formatReportPeriod(report.period)}</td>
                <td className="px-3 py-3 text-right font-semibold text-slate-100">{formatMoney(report.totalContributions)}</td>
                <td className="px-3 py-3 text-right font-semibold text-slate-100">{formatMoney(report.totalExpenses)}</td>
                <td className="px-3 py-3 text-right font-semibold text-slate-100">{formatMoney(report.cashOnHand)}</td>
                <td className="px-3 py-3 text-right text-slate-400">
                  <p>{formatNumber(report.contributionRowCount)} contribution</p>
                  <p>{formatNumber(report.expenditureRowCount)} payee</p>
                  <p>{formatNumber(report.excludedAdjustmentRowCount)} review</p>
                </td>
                <td className="px-3 py-3">
                  <SourceReference sourceUrl={report.sourceUrl} cachedPath={report.cachedPath} />
                </td>
                <td className="px-3 py-3">
                  <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-semibold text-slate-300">
                    {report.parserStatus.replaceAll("_", " ")}
                  </span>
                  <p className="mt-2 text-[11px] text-slate-500">{formatPercent(report.parseConfidence)} confidence</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FinanceRecordTable({
  title,
  subtitle,
  rows,
  kind,
  emptyText,
}: {
  title: string;
  subtitle: string;
  rows: CampaignFinanceRawRow[];
  kind: "contribution" | "expenditure";
  emptyText: string;
}) {
  return (
    <section className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">{title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
          {formatNumber(rows.length)} row{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      {rows.length ? (
        <div className="mt-4 max-h-96 overflow-auto rounded-2xl border border-white/10">
          <table className="min-w-[860px] w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-950/95 text-[11px] uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-3 py-3 font-semibold">{kind === "contribution" ? "Contributor / payor" : "Payee / vendor"}</th>
                <th className="px-3 py-3 font-semibold">Normalized</th>
                <th className="px-3 py-3 text-right font-semibold">Amount</th>
                <th className="px-3 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">{kind === "contribution" ? "Classification" : "Purpose / status"}</th>
                <th className="px-3 py-3 font-semibold">Report source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((row) => (
                <tr key={row.id} className="align-top text-slate-300">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-slate-100">{row.displayName}</p>
                    {row.originalName !== row.displayName ? <p className="mt-1 text-[11px] leading-4 text-slate-500">Raw: {row.originalName}</p> : null}
                  </td>
                  <td className="px-3 py-3 text-slate-400">{row.normalizedName}</td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-100">{formatMoney(row.amount)}</td>
                  <td className="px-3 py-3 text-slate-400">{row.date ?? "Not parsed"}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-semibold text-slate-300">
                      {kind === "contribution" ? classificationStatus(row) : row.spendingCategory ?? "needs review"}
                    </span>
                    <p className="mt-2 text-[11px] leading-4 text-slate-500">
                      {row.confidenceScore}% confidence · {row.classificationSource}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-[11px] font-semibold text-slate-400">
                      {row.reportLabel ?? "Parsed report"}{row.reportYear ? ` · ${row.reportYear}` : ""}
                    </p>
                    <SourceReference sourceUrl={row.sourceUrl} cachedPath={row.cachedPath} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/15 p-4 text-sm leading-6 text-slate-400">{emptyText}</p>
      )}
    </section>
  );
}

function ReviewRowsList({ rows }: { rows: CampaignFinanceReviewRow[] }) {
  if (!rows.length) {
    return <p className="mt-3 text-sm leading-6 text-slate-400">No rows in this review queue.</p>;
  }

  return (
    <div className="mt-3 max-h-80 overflow-auto rounded-2xl border border-white/10">
      <table className="min-w-[760px] w-full text-left text-xs">
        <thead className="sticky top-0 bg-slate-950/95 text-[11px] uppercase tracking-[0.14em] text-slate-500">
          <tr>
            <th className="px-3 py-3 font-semibold">Row</th>
            <th className="px-3 py-3 text-right font-semibold">Amount</th>
            <th className="px-3 py-3 font-semibold">Status</th>
            <th className="px-3 py-3 font-semibold">Report source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.slice(0, 80).map((row) => (
            <tr key={row.id} className="align-top text-slate-300">
              <td className="px-3 py-3">
                <p className="font-semibold text-slate-100">{row.displayName}</p>
                {row.originalName ? <p className="mt-1 text-[11px] leading-4 text-slate-500">Raw: {row.originalName}</p> : null}
                <p className="mt-1 text-[11px] text-slate-500">{row.rowKind} · {row.date ?? "date not parsed"}</p>
              </td>
              <td className="px-3 py-3 text-right font-semibold text-slate-100">{formatMoney(row.amount)}</td>
              <td className="px-3 py-3">
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-semibold text-slate-300">{row.status}</span>
                <p className="mt-2 text-[11px] leading-4 text-slate-500">
                  {row.confidenceScore !== null ? `${row.confidenceScore}% confidence · ` : ""}{row.reason}
                </p>
              </td>
              <td className="px-3 py-3">
                <p className="text-[11px] font-semibold text-slate-400">
                  {row.reportLabel ?? "Parsed report"}{row.reportYear ? ` · ${row.reportYear}` : ""}
                </p>
                <SourceReference sourceUrl={row.sourceUrl} cachedPath={row.cachedPath} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 80 ? <p className="border-t border-white/10 px-3 py-2 text-xs text-slate-500">Showing first 80 of {formatNumber(rows.length)} rows.</p> : null}
    </div>
  );
}

function NeedsReviewSection({ dashboard }: { dashboard: CampaignFinanceDashboard }) {
  const queues = dashboard.reviewQueues;
  const queueCards = [
    {
      id: "missing-name",
      title: "Rows with missing names",
      rows: queues.missingNameRows,
      description: "Rows where the parser did not find a contributor or payee name.",
    },
    {
      id: "ambiguous",
      title: "Ambiguous contributor/payee type",
      rows: queues.ambiguousRows,
      description: "Rows with a name and amount, but not enough signal to classify the entity type confidently.",
    },
    {
      id: "excluded",
      title: "Refunds, offsets, reversals, or corrections",
      rows: queues.excludedAdjustmentRows,
      description: "Rows excluded from donor charts and valid-contribution tables because they look like accounting activity.",
    },
    {
      id: "low-confidence",
      title: "Low-confidence parser/classifier rows",
      rows: queues.lowConfidenceRows,
      description: "Rows below the confidence threshold for voter-facing classification.",
    },
  ];
  const totalReviewRows = queueCards.reduce((sum, card) => sum + card.rows.length, 0);

  return (
    <section className="rounded-[1.1rem] border border-amber-300/15 bg-amber-400/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-50">Needs review</p>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-amber-100/75">
            Classification incomplete does not mean there is no finance data. Official totals are still shown from report summaries; these queues explain which row-level records are not safe to use in donor or industry charts yet.
          </p>
        </div>
        <span className="rounded-full border border-amber-200/20 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-amber-100">
          {formatNumber(totalReviewRows)} review row{totalReviewRows === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {queueCards.map((card) => (
          <details key={card.id} className="rounded-2xl border border-white/10 bg-black/15 p-3">
            <summary className="cursor-pointer list-none">
              <span className="block text-sm font-semibold text-slate-100">{card.title}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                {formatNumber(card.rows.length)} row{card.rows.length === 1 ? "" : "s"} · {card.description}
              </span>
            </summary>
            <ReviewRowsList rows={card.rows} />
          </details>
        ))}
      </div>
    </section>
  );
}

function FundingSplitIndicator({ dashboard }: { dashboard: CampaignFinanceDashboard }) {
  const split = dashboard.individualVsOrganizational;

  if (split.totalAmount <= 0) {
    return (
      <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-semibold text-slate-100">Individual vs organizational funding</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          The parsed itemized contributor rows do not currently include reliable incoming funding rows for this profile.
        </p>
      </div>
    );
  }

  const organizationWidth = Math.max(split.organizationalPercentage, split.organizationalAmount > 0 ? 5 : 0);
  const individualWidth = Math.max(split.individualPercentage, split.individualAmount > 0 ? 5 : 0);
  const unknownWidth = Math.max(split.unknownPercentage, split.unknownAmount > 0 ? 5 : 0);

  return (
    <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm font-semibold text-slate-100">Individual vs organizational funding</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">Uses classified incoming itemized contribution rows. Refunds and reimbursements are excluded.</p>
      <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-slate-800">
        {split.individualAmount > 0 ? <div className="bg-cyan-300" style={{ width: `${individualWidth}%` }} /> : null}
        {split.organizationalAmount > 0 ? <div className="bg-emerald-300" style={{ width: `${organizationWidth}%` }} /> : null}
        {split.unknownAmount > 0 ? <div className="bg-slate-500" style={{ width: `${unknownWidth}%` }} /> : null}
      </div>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-3">
          <p className="text-xs text-cyan-100/70">Individuals</p>
          <p className="mt-1 font-semibold text-cyan-50">{formatCompactMoney(split.individualAmount)}</p>
          <p className="mt-1 text-xs text-cyan-100/70">{split.individualPercentage.toFixed(0)}%</p>
        </div>
        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/10 p-3">
          <p className="text-xs text-emerald-100/70">Organizations</p>
          <p className="mt-1 font-semibold text-emerald-50">{formatCompactMoney(split.organizationalAmount)}</p>
          <p className="mt-1 text-xs text-emerald-100/70">{split.organizationalPercentage.toFixed(0)}%</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs text-slate-500">Unclassified</p>
          <p className="mt-1 font-semibold text-slate-100">{formatCompactMoney(split.unknownAmount)}</p>
          <p className="mt-1 text-xs text-slate-500">{split.unknownPercentage.toFixed(0)}%</p>
        </div>
      </div>
    </div>
  );
}

function VoterInsights({ dashboard }: { dashboard: CampaignFinanceDashboard }) {
  if (!dashboard.voterInsights.length) return null;

  return (
    <div className="rounded-[1.1rem] border border-cyan-300/15 bg-cyan-400/10 p-4">
      <p className="text-sm font-semibold text-cyan-50">What this means</p>
      <div className="mt-3 grid gap-2">
        {dashboard.voterInsights.map((insight) => (
          <p key={insight} className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2 text-sm leading-6 text-slate-200">
            {insight}
          </p>
        ))}
      </div>
    </div>
  );
}

function AccountingBreakdownCard({ dashboard }: { dashboard: CampaignFinanceDashboard }) {
  const rows = dashboard.accountingBreakdown.filter((row) => row.amount > 0 || row.count > 0);
  const maxAmount = Math.max(...rows.map((row) => Math.abs(row.amount)), 1);

  return (
    <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Campaign finance accounting</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Simple money-in, money-out view from parsed official totals and available rows.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
          Covers {dateRangeText(dashboard)}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row) => {
          const width = Math.max((Math.abs(row.amount) / maxAmount) * 100, row.amount > 0 ? 5 : 0);
          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold leading-5 text-slate-100 [overflow-wrap:anywhere]">{row.name}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {row.note}{row.count ? ` · ${formatNumber(row.count)} row${row.count === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-slate-200">{formatMoney(row.amount)}</p>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-800/80">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" style={{ width: `${width}%` }} />
              </div>
            </>
          );

          if (!row.sourceUrl) {
            return (
              <div key={row.id} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                {content}
              </div>
            );
          }
          return (
            <Link key={row.id} href={row.sourceUrl} className="block rounded-2xl border border-white/10 bg-black/15 p-3 hover:border-cyan-300/30">
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function DataQualityTransparencyCard({ dashboard }: { dashboard: CampaignFinanceDashboard }) {
  const status = dashboard.dataStatus;
  const canShowDonorCharts = status.voterFacingMode === "full_breakdown";
  const hasSomeDonorRows = status.voterFacingMode === "limited_breakdown";
  const sourceReportCount = dashboard.sourceReports.length;

  return (
    <div className="rounded-[1.1rem] border border-cyan-300/15 bg-cyan-400/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cyan-50">Data Quality / Transparency</p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
            {canShowDonorCharts
              ? "There are enough clean itemized contribution rows to show donor-category charts. Categories are still deterministic inferences from public filing text, not endorsements or official industry labels."
              : hasSomeDonorRows
                ? "We can show official totals and source filings, but there are not enough clean itemized contribution rows yet to make donor categories reliable for voters."
                : "Detailed donor categories are not available from the parsed records yet. The public filings show total money raised and spent, but the itemized rows currently available are mostly refunds, reimbursements, or accounting adjustments."}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
          {status.confidenceLevel} confidence · {status.voterFacingMode.replaceAll("_", " ")}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">What we can show</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Official totals, spending totals, net position, report count, source filing links, and a separated accounting view for refunds or adjustments.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">What we cannot infer yet</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {canShowDonorCharts
              ? "Industry categories should still be treated as reviewable estimates from names and keywords."
              : "We cannot responsibly label funders, industries, or political influence from rows that look like refunds or bookkeeping entries."}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">Why categories may be hidden</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {formatNumber(status.contributionRowsCount)} clean donor row{status.contributionRowsCount === 1 ? "" : "s"} · {formatNumber(status.excludedRefundAdjustmentRowsCount)} refund/adjustment row{status.excludedRefundAdjustmentRowsCount === 1 ? "" : "s"} · {formatNumber(status.rawRowsCount)} raw row{status.rawRowsCount === 1 ? "" : "s"} preserved.
          </p>
        </div>
      </div>

      {sourceReportCount ? (
        <details className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100">
            View source reports <span className="text-slate-500">({sourceReportCount})</span>
          </summary>
          <div className="mt-3 max-h-80 space-y-2 overflow-auto pr-1">
            {dashboard.sourceReports.map((report) => (
              <Link key={report.sourceUrl} href={report.sourceUrl} className="block rounded-2xl border border-white/10 bg-white/[0.04] p-3 hover:border-cyan-300/30">
                <span className="block text-sm font-semibold text-slate-100">
                  {report.label}{report.year ? ` · ${report.year}` : ""}
                </span>
                <span className="mt-1 block text-xs text-slate-500">Reporting period: {formatReportPeriod(report.period)}</span>
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

function TopOrganizations({ dashboard }: { dashboard: CampaignFinanceDashboard }) {
  if (!dashboard.topOrganizations.length) {
    return null;
  }

  return (
    <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm font-semibold text-slate-100">Top organizations</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">Largest classified organizational contributors from incoming itemized rows.</p>
      <div className="mt-4 space-y-2">
        {dashboard.topOrganizations.map((organization) => (
          <a key={organization.id} href={organization.sourceUrl ?? "#"} className="block rounded-2xl border border-white/10 bg-black/15 p-3 hover:border-cyan-300/30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold leading-5 text-slate-100 [overflow-wrap:anywhere]">{organization.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {organization.industry} · {organization.entityType} · {organization.confidenceScore}% confidence
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-slate-100">{formatCompactMoney(organization.amount)}</p>
                <p className="mt-1 text-xs text-slate-500">{organization.percentage.toFixed(0)}%</p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function RaceComparison({ dashboard }: { dashboard: CampaignFinanceDashboard }) {
  const comparison = dashboard.raceComparison;
  if (!comparison?.candidates.length) return null;
  const maxAmount = Math.max(...comparison.candidates.map((candidate) => candidate.totalContributions ?? 0), 1);

  return (
    <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm font-semibold text-slate-100">Funding comparison</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">Matched candidates for {comparison.office ?? "the same office"} with parsed Nevada SoS totals.</p>
      <div className="mt-4 space-y-3">
        {comparison.candidates.slice(0, 5).map((candidate) => {
          const width = Math.max(((candidate.totalContributions ?? 0) / maxAmount) * 100, candidate.totalContributions ? 5 : 0);
          return (
            <a key={candidate.candidateName} href={candidate.sourceUrl ?? "#"} className={`block rounded-2xl border p-3 ${candidate.isCurrentProfile ? "border-cyan-300/25 bg-cyan-400/10" : "border-white/10 bg-black/15"} hover:border-cyan-300/30`}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-100">{candidate.candidateName}</p>
                <p className="text-sm font-semibold text-slate-200">{formatMoney(candidate.totalContributions)}</p>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-800/80">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" style={{ width: `${width}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {candidate.reportCount} report{candidate.reportCount === 1 ? "" : "s"} · {candidate.percentageOfRaceFunding.toFixed(0)}% of matched race funding
              </p>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export function CampaignFinanceSummaryCard({ dashboard, previewLabel }: { dashboard: CampaignFinanceDashboard; previewLabel?: string }) {
  const summary = dashboard.summary;
  const hasParsedData = summary.reportCount > 0 || summary.recordsWithTotals > 0;
  const showDonorInfluenceCharts = dashboard.dataStatus.voterFacingMode === "full_breakdown";
  const validContributionRows = dashboard.topContributors;
  const validPayeeRows = dashboard.topPayees;

  if (!hasParsedData) {
    return (
      <div className="rounded-[1.35rem] border border-dashed border-white/12 bg-white/[0.03] p-5">
        <p className="text-sm font-semibold text-slate-100">Campaign finance dashboard</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">No source-document finance extraction is attached here. Reviewed totals and filings may still be available in the profile's finance source card.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{previewLabel ?? "Campaign finance"}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Nevada Secretary of State finance dashboard</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Official report totals and source-linked accounting from Nevada Secretary of State campaign finance records. Classification incomplete does not mean no finance data: totals come from official report summaries, while donor/payee tables come from parsed row-level records.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">
          {summary.reportCount} report{summary.reportCount === 1 ? "" : "s"}
        </span>
      </div>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Campaign Finance Summary</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-50">Money raised, spent, and reported</h3>
        </div>

        <CampaignFinanceMetricRow
          metrics={[
            {
              label: "Total raised",
              value: formatMoney(summary.totalContributions),
              href: summary.totalContributionsSourceUrl,
              tone: "cyan",
              note: summary.recordsWithTotals ? "Parsed SoS totals" : "Totals pending",
            },
            {
              label: "Total spent",
              value: formatMoney(summary.totalExpenses),
              href: summary.totalExpensesSourceUrl,
              tone: "amber",
              note: summary.recordsWithTotals ? "Parsed SoS totals" : "Totals pending",
            },
            {
              label: "Cash on hand",
              value: formatMoney(summary.cashOnHand),
              href: summary.cashOnHandSourceUrl,
              tone: summary.cashOnHand !== null && summary.cashOnHand >= 0 ? "emerald" : "slate",
              note: summary.cashOnHand !== null ? "Latest parsed cash figure" : "Not available in parsed reports",
            },
            {
              label: "Net remaining",
              value: formatMoney(summary.netTotal),
              href: summary.netTotalSourceUrl,
              tone: summary.netTotal !== null && summary.netTotal >= 0 ? "emerald" : "slate",
              note: "Raised minus spent",
            },
            {
              label: "Latest period",
              value: formatReportPeriod(summary.latestReportPeriod),
              href: summary.latestReportUrl,
              tone: "slate",
              note: latestReportText(dashboard),
            },
            {
              label: "Reports parsed",
              value: `${summary.reportCount}`,
              href: summary.latestReportUrl,
              tone: "slate",
              note: `${summary.recordsWithTotals} with totals`,
            },
            {
              label: "Contribution rows",
              value: formatNumber(dashboard.validation.rawContributorRowCountPreserved),
              tone: validContributionRows.length ? "cyan" : "slate",
              note: `${formatNumber(dashboard.dataStatus.contributionRowsCount)} usable for donor tables`,
            },
            {
              label: "Expenditure rows",
              value: formatNumber(dashboard.validation.rawPayeeRowCountPreserved),
              tone: validPayeeRows.length ? "amber" : "slate",
              note: `${formatNumber(validPayeeRows.length)} usable payee/vendor rows`,
            },
            {
              label: "Excluded rows",
              value: formatMoney(adjustmentTotal(dashboard)),
              tone: dashboard.rawAdjustmentRows.length ? "amber" : "slate",
              note: `${formatNumber(dashboard.dataStatus.excludedRefundAdjustmentRowsCount)} refund/offset row${dashboard.dataStatus.excludedRefundAdjustmentRowsCount === 1 ? "" : "s"} excluded from donor charts`,
            },
          ]}
        />

        <CampaignFinanceLineChart points={dashboard.timeSeries} />

        <div className="grid gap-4 xl:grid-cols-2">
          <AccountingBreakdownCard dashboard={dashboard} />
          {validPayeeRows.length ? (
            <CampaignFinanceBarChart
              title="Spending destinations"
              subtitle="Parsed vendor/payee rows grouped into voter-friendly spending categories."
              items={dashboard.spendingCategoryBreakdown}
              emptyText={dashboard.itemizationStatus.expenseNote ?? "Itemized payee or vendor rows have not been parsed for this profile yet."}
            />
          ) : (
            <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-slate-100">Spending destinations</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Valid payee/vendor rows are not available from the current parsed records. Expense totals still come from official report summaries, and excluded refund/reimbursement rows are listed in Needs review.
              </p>
            </div>
          )}
        </div>
      </section>

      <ReportsParsedTable reports={dashboard.sourceReports} />

      <section className="grid gap-4 xl:grid-cols-2">
        <FinanceRecordTable
          title="Largest contribution records"
          subtitle="Valid incoming contribution rows only. Refunds, offsets, reimbursements, corrections, and negative rows are excluded."
          rows={validContributionRows}
          kind="contribution"
          emptyText="No valid incoming contribution rows are available from the current parsed records. The official report totals still show money raised, and excluded refund/offset rows are listed in Needs review."
        />
        <FinanceRecordTable
          title="Largest expenditure/payee records"
          subtitle="Valid spending or vendor rows only. Refunds, reimbursements, offsets, and corrections are excluded."
          rows={validPayeeRows}
          kind="expenditure"
          emptyText="No valid expenditure/payee rows are available from the current parsed records. The official report totals still show spending, and excluded refund/reimbursement rows are listed in Needs review."
        />
      </section>

      <NeedsReviewSection dashboard={dashboard} />

      <VoterInsights dashboard={dashboard} />

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Who Funded This Campaign?</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-50">
            {showDonorInfluenceCharts ? "Clean donor records parsed" : "Not enough clean donor records parsed yet"}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {showDonorInfluenceCharts
              ? "These charts use incoming itemized contributions only. Refunds, reimbursements, and bookkeeping adjustments stay out of donor-influence charts."
              : "We can show totals, source filings, parsed row tables, and review queues, but not reliable donor-industry charts yet."}
          </p>
        </div>

        {showDonorInfluenceCharts ? (
          <>
            <div className="grid gap-4 xl:grid-cols-2">
              <CampaignFinancePieChart
                title="Donor mix by sector"
                subtitle="High-confidence sector classification from incoming itemized contributions."
                items={dashboard.industrySectorBreakdown}
                emptyText={dashboard.itemizationStatus.contributorNote ?? "No reliable incoming contributor sector mix is available yet."}
              />
              <CampaignFinancePieChart
                title="Donor mix by entity type"
                subtitle="Entity-type classification from normalized donor names."
                items={dashboard.donorTypeBreakdown}
                emptyText={dashboard.itemizationStatus.contributorNote ?? "No reliable incoming donor-type mix is available yet."}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <CampaignFinanceBarChart
                title="Largest donor sectors"
                subtitle="Largest classified sector totals from incoming itemized contributions."
                items={dashboard.industrySectorBreakdown}
                emptyText="No reliable sector categories could be inferred from incoming contributor rows."
              />
              <FundingSplitIndicator dashboard={dashboard} />
            </div>

            <TopOrganizations dashboard={dashboard} />
          </>
        ) : (
          <DataQualityTransparencyCard dashboard={dashboard} />
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <RaceComparison dashboard={dashboard} />
        {showDonorInfluenceCharts ? <DataQualityTransparencyCard dashboard={dashboard} /> : null}
      </div>

      {dashboard.rawAdjustmentRows.length ? (
        <CampaignFinanceRawRecords
          title="View refunds and accounting adjustments"
          rows={dashboard.rawAdjustmentRows}
          emptyText="No refunds, reimbursements, or accounting adjustments were identified in the parsed rows."
        />
      ) : null}

      <CampaignFinanceSourceNote dashboard={dashboard} />
    </div>
  );
}
