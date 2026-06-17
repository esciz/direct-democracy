import Link from "next/link";

import type { CampaignFinanceSourceCardData } from "@/lib/civic-data/profile-source-cards";

function formatDate(value: string | null) {
  if (!value) return "Last checked pending";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Pending";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function BarList({ items }: { items: Array<{ label: string; amount: number; percentage: number }> }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-white/10 bg-black/15 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-100">{item.label}</p>
            <p className="text-xs font-semibold text-slate-400">{formatMoney(item.amount)} · {item.percentage}%</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CampaignFinanceSourceCard({ data }: { data: CampaignFinanceSourceCardData }) {
  const funding = data.fundingBreakdown;
  const showFundingGraph = Boolean(funding?.hasDetailedContributions);
  const hasSourceBackedFilings = data.financeFilingCount > 0 || data.filingSummaries.length > 0 || data.sourceLinks.length > 0;

  return (
    <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Campaign finance</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Finance source status</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Source links and filing names are shown as soon as they are stored. Official report totals can still be useful even when donor-category charts are waiting on clean row-level contribution records.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">
          {data.reviewStatus?.replaceAll("_", " ") ?? "pending source"}
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Source</p>
          <p className="mt-3 text-sm font-semibold text-slate-100">{data.sourceName ?? "Campaign finance source needed"}</p>
          {data.sourceUrl ? (
            <Link href={data.sourceUrl} className="mt-3 inline-flex break-all text-xs font-semibold text-cyan-200 hover:text-cyan-100">
              Open finance source
            </Link>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Attach Nevada SOS or local finance source.</p>
          )}
        </div>
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Filing status</p>
          <p className="mt-3 text-sm font-semibold text-slate-100">{data.filingStatus ?? data.donorExtractionStatus}</p>
          <p className="mt-2 text-xs text-slate-500">
            {data.financeFilingCount} filing{data.financeFilingCount === 1 ? "" : "s"} · {data.financeDocumentCount} document{data.financeDocumentCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Last checked</p>
          <p className="mt-3 text-sm font-semibold text-slate-100">{formatDate(data.lastCheckedAt)}</p>
          <p className="mt-2 text-xs text-slate-500">
            {data.approvedCount} approved · {data.pendingCount} pending
          </p>
        </div>
      </div>

      {data.filingSummaries.length ? (
        <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Known filings</p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {data.filingSummaries.map((filing) => (
              <div key={`${filing.name}-${filing.filedAt ?? "pending"}`} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                <p className="text-sm font-semibold text-slate-100">{filing.name}</p>
                <p className="mt-2 text-xs text-slate-500">{filing.filedAt ? formatDate(filing.filedAt) : "Filing date pending"}</p>
                {filing.url ? (
                  <Link href={filing.url} className="mt-2 inline-flex break-all text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                    Open source
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {showFundingGraph && funding ? (
        <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Funding source graph</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-50">Where campaign money is coming from</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{funding.sourceCoverageNote}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-right">
              <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Raised</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{formatMoney(funding.totalRaised ?? funding.totalContributions)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Spent</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{formatMoney(funding.totalSpent)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Cash</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{formatMoney(funding.cashOnHand)}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-slate-100">Funding by contributor type</p>
              <div className="mt-3">
                <BarList items={funding.byContributorType} />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-slate-100">PAC vs individual vs business</p>
              <div className="mt-3">
                <BarList items={funding.pacVsIndividual} />
              </div>
            </div>
            {funding.byIndustry.length ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-slate-100">Funding by industry/category</p>
                <div className="mt-3">
                  <BarList items={funding.byIndustry} />
                </div>
              </div>
            ) : null}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-slate-100">Top contributors</p>
              <div className="mt-3 space-y-2">
                {funding.topContributors.map((contributor) => (
                  <div key={contributor.name} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{contributor.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {contributor.contributorType}{contributor.industry ? ` · ${contributor.industry}` : ""}
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-slate-400">{formatMoney(contributor.amount)} · {contributor.percentage}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
          {hasSourceBackedFilings
            ? "Source filings are available. Industry and entity charts appear only after enough clean itemized contribution rows are parsed and reviewed."
            : "Source filings have not been attached yet."}
        </div>
      )}

      {data.campaignReportedSummary ? (
        <div className="mt-5 rounded-[1.35rem] border border-amber-300/18 bg-amber-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">Campaign-reported</p>
          <p className="mt-3 text-sm leading-6 text-amber-50">{data.campaignReportedSummary}</p>
        </div>
      ) : null}

      {data.sourceLinks.length > 1 ? (
        <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Finance source links</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.sourceLinks.map((link) => (
              <Link key={link.url} href={link.url} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-100">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
        {data.donorExtractionStatus === "Detailed donor extraction pending" && hasSourceBackedFilings
          ? "Classification is incomplete, but source-backed report summaries and filing links are available."
          : data.donorExtractionStatus}
      </div>
    </section>
  );
}
