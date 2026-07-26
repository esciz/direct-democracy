import Link from "next/link";

import {
  ContributorAttributionMap,
  contributorAttributionId,
} from "@/components/domain/contributor-attribution-map";
import type { CampaignFinanceSourceCardData } from "@/lib/civic-data/profile-source-cards";

function formatDate(value: string | null) {
  if (!value) return "Last checked pending";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function formatMoney(value: number | null | undefined, unavailableLabel = "Pending") {
  if (typeof value !== "number" || !Number.isFinite(value)) return unavailableLabel;
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
  const snapshot = data.financialSnapshot;
  const contributorFunding = data.allReportedFundingBreakdown ?? funding;
  const showFundingGraph = Boolean(contributorFunding?.hasDetailedContributions);
  const raisedAmount =
    funding?.totalRaised ??
    (funding?.hasDetailedContributions ? funding.totalContributions : null) ??
    snapshot?.totalRaised ??
    null;
  const spentAmount = funding?.totalSpent ?? snapshot?.totalSpent ?? null;
  const cashOnHandAmount = funding?.cashOnHand ?? snapshot?.cashOnHand ?? null;
  const reportingPeriod = funding?.reportingPeriod ?? snapshot?.reportingPeriod ?? null;
  const hasFinancialSnapshot = [raisedAmount, spentAmount, cashOnHandAmount].some(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
  const hasPriorCycles = data.cycleHistory.some((cycle) => !cycle.isCurrentCycle);
  const hasUnitemizedHistoricalActivity = Boolean(
    data.allReportedTotals &&
      data.cycleHistory.length <= 1 &&
      ((raisedAmount != null && data.allReportedTotals.totalRaised > raisedAmount) ||
        (spentAmount != null && data.allReportedTotals.totalSpent > spentAmount)),
  );
  const hasFilingEvidence = data.financeFilingCount > 0 || data.financeDocumentCount > 0 || data.filingSummaries.length > 0;
  const hasSourceLink = Boolean(data.sourceUrl || data.sourceLinks.length);
  const disclosure = data.personalFinancialDisclosure;
  const hasDisclosureSource = Boolean(disclosure.sourceUrl);
  const attributedContributorNames = new Set(data.contributorAttributions.map((attribution) => attribution.contributorName.toLowerCase()));

  return (
    <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Financial transparency</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">
            {hasFinancialSnapshot ? "Campaign money and history" : "Finance source status"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {hasFinancialSnapshot
              ? "Direct-campaign totals and reviewed contributor aggregates. Affiliated PACs and independent spending are tracked separately from candidate committees."
              : "Official report totals appear after the source record and reporting period have been reviewed."}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">
          {data.reviewStatus?.replaceAll("_", " ") ?? "pending source"}
        </span>
      </div>

      {hasFinancialSnapshot ? (
        <div className="mt-5 border-y border-white/10 py-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Raised</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">{formatMoney(raisedAmount)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Spent</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">{formatMoney(spentAmount, "Not reported")}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Cash on hand</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">{formatMoney(cashOnHandAmount, "Not reported")}</p>
            </div>
          </div>
          {reportingPeriod ? (
            <p className="mt-4 text-sm text-slate-400">Reporting period: {reportingPeriod}</p>
          ) : null}
        </div>
      ) : null}

      {data.allReportedTotals ? (
        <div className="mt-5 border-b border-white/10 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Campaign history</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-50">{data.allReportedTotals.label}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {data.allReportedTotals.reportingPeriod}. Totals cover the candidate committee records listed below.
              </p>
            </div>
            {data.allReportedTotals.sourceUrl ? (
              <Link href={data.allReportedTotals.sourceUrl} className="text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                Open all-cycle source
              </Link>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">All reported raised</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">{formatMoney(data.allReportedTotals.totalRaised)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">All reported spent</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">{formatMoney(data.allReportedTotals.totalSpent)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Cycles covered</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">{data.allReportedTotals.cycleCount}</p>
            </div>
          </div>

          {hasPriorCycles ? (
            <div className="mt-5 border-y border-white/10">
              {data.cycleHistory.map((cycle) => (
                <div key={`${cycle.cycleYear}-${cycle.periodEnd}`} className="grid gap-3 border-b border-white/10 py-4 last:border-b-0 md:grid-cols-[minmax(0,1.5fr)_minmax(7rem,0.7fr)_minmax(7rem,0.7fr)_auto] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-100">{cycle.displayLabel}</p>
                      {cycle.isCurrentCycle ? (
                        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-100">
                          Current
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{cycle.reportingPeriod}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Raised</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{formatMoney(cycle.totalRaised)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Spent</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{formatMoney(cycle.totalSpent)}</p>
                  </div>
                  {cycle.sourceUrl ? (
                    <Link href={cycle.sourceUrl} className="text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                      Source
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          ) : hasUnitemizedHistoricalActivity ? (
            <p className="mt-5 border-y border-white/10 py-4 text-sm leading-6 text-slate-400">
              Earlier activity is included in the all-reported aggregate. Cycle-by-cycle extraction is still pending.
            </p>
          ) : (
            <p className="mt-5 border-y border-white/10 py-4 text-sm leading-6 text-slate-400">
              No earlier non-zero campaign-finance cycle appears in this source.
            </p>
          )}
          {data.allReportedTotals.aggregationMethod ? (
            <p className="mt-3 text-xs leading-5 text-slate-500">Method: {data.allReportedTotals.aggregationMethod}</p>
          ) : null}
        </div>
      ) : null}

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
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Coverage</p>
          <p className="mt-3 text-sm font-semibold text-slate-100">{data.filingStatus ?? data.donorExtractionStatus}</p>
          <p className="mt-2 text-xs text-slate-500">
            {data.cycleHistory.length
              ? `${data.cycleHistory.length} cycle record${data.cycleHistory.length === 1 ? "" : "s"}`
              : `${data.financeFilingCount} filing${data.financeFilingCount === 1 ? "" : "s"}`}
            {" · "}
            {data.financeDocumentCount} document{data.financeDocumentCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Last checked</p>
          <p className="mt-3 text-sm font-semibold text-slate-100">{formatDate(data.lastCheckedAt)}</p>
          <p className="mt-2 text-xs text-slate-500">
            {data.approvedCount > 0
              ? `${data.approvedCount} reviewed source${data.approvedCount === 1 ? "" : "s"}`
              : data.pendingCount > 0
                ? "Source review pending"
                : "No source review recorded"}
          </p>
        </div>
      </div>

      {data.filingSummaries.length && !data.cycleHistory.length ? (
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

      {showFundingGraph && contributorFunding ? (
        <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Reviewed aggregate contributor sample</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-50">Largest contributors across reported cycles</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{contributorFunding.sourceCoverageNote}</p>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-slate-100">Reviewed contributors by type</p>
              <div className="mt-3">
                <BarList items={contributorFunding.byContributorType} />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-slate-100">Candidate vs outside sources</p>
              <div className="mt-3">
                <BarList items={contributorFunding.pacVsIndividual} />
              </div>
            </div>
            {contributorFunding.byIndustry.length ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-slate-100">Funding by industry/category</p>
                <div className="mt-3">
                  <BarList items={contributorFunding.byIndustry} />
                </div>
              </div>
            ) : null}
            <div
              className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${
                contributorFunding.byIndustry.length ? "" : "xl:col-span-2"
              }`}
            >
              <p className="text-sm font-semibold text-slate-100">Reviewed top contributors</p>
              <div className={contributorFunding.byIndustry.length ? "mt-3 space-y-2" : "mt-3 grid gap-2 md:grid-cols-2"}>
                {contributorFunding.topContributors.map((contributor) => (
                  <div key={contributor.name} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{contributor.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {contributor.contributorType}{contributor.industry ? ` · ${contributor.industry}` : ""}
                        </p>
                        {attributedContributorNames.has(contributor.name.toLowerCase()) ? (
                          <a
                            href={`#${contributorAttributionId(contributor.name)}`}
                            className="mt-2 inline-flex text-xs font-semibold text-cyan-200 hover:text-cyan-100"
                          >
                            Entity trail reviewed
                          </a>
                        ) : null}
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
          {hasFinancialSnapshot
            ? "Cycle totals are available. Contributor charts remain hidden until enough itemized donor records are reviewed."
            : hasFilingEvidence
            ? "Source filings are available. Industry and entity charts appear only after enough clean itemized contribution rows are parsed and reviewed."
            : hasSourceLink
              ? "The official source link is stored, but filing totals and report details have not been extracted and reviewed yet."
              : "Source filings have not been attached yet."}
        </div>
      )}

      <ContributorAttributionMap
        attributions={data.contributorAttributions}
        contributors={contributorFunding?.topContributors ?? []}
      />

      {data.campaignReportedSummary ? (
        <div className="mt-5 rounded-[1.35rem] border border-amber-300/18 bg-amber-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">Source summary</p>
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

      <div className="mt-5 border-t border-white/10 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Personal financial disclosure</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-50">
              {disclosure.filingSummaries.length ? "Disclosure filings located" : hasDisclosureSource ? "Official disclosure search registered" : "Disclosure source pending"}
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              These filings describe reportable financial interests and income sources. They are separate from campaign contributions and do not establish an exact net worth.
            </p>
          </div>
          {disclosure.reviewStatus ? (
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">
              {disclosure.reviewStatus.replaceAll("_", " ")}
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Filing authority</p>
            <p className="mt-3 text-sm font-semibold text-slate-100">{disclosure.sourceName ?? "Official source not registered"}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {disclosure.applicability === "required_or_likely"
                ? "This office is generally covered, subject to the filing rules for the office and term."
                : disclosure.applicability === "eligibility_review"
                  ? "Filing applicability still needs review for this office."
                  : "Filing applicability has not been classified yet."}
            </p>
            {disclosure.sourceUrl ? (
              <Link href={disclosure.sourceUrl} className="mt-3 inline-flex break-all text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                Search official disclosures
              </Link>
            ) : null}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Record status</p>
            <p className="mt-3 text-sm font-semibold text-slate-100">
              {disclosure.filingSummaries.length
                ? `${disclosure.filingSummaries.length} matched filing${disclosure.filingSummaries.length === 1 ? "" : "s"}`
                : disclosure.status === "source_registered"
                  ? "Search route ready; match pending"
                  : "Source review pending"}
            </p>
            <p className="mt-2 text-xs text-slate-500">{formatDate(disclosure.lastCheckedAt)}</p>
          </div>
        </div>

        {disclosure.filingSummaries.length ? (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {disclosure.filingSummaries.map((filing) => (
              <div key={`${filing.name}-${filing.url ?? filing.filedAt ?? "stored"}`} className="rounded-lg border border-white/10 bg-black/15 p-3">
                <p className="text-sm font-semibold text-slate-100">{filing.name}</p>
                <p className="mt-1 text-xs text-slate-500">{filing.filedAt ? formatDate(filing.filedAt) : "Filing date not parsed"}</p>
                {filing.url ? (
                  <Link href={filing.url} className="mt-2 inline-flex break-all text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                    Open filing
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {disclosure.note ? <p className="mt-3 text-xs leading-5 text-slate-500">{disclosure.note}</p> : null}
      </div>

    </section>
  );
}
