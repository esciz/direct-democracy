import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { CampaignFinanceSummaryCard } from "@/components/domain/campaign-finance/campaign-finance-summary-card";
import { PageIntro } from "@/components/ui/page-intro";
import { buildCampaignFinanceDashboard, type DonorClassificationRecord } from "@/lib/nv-sos/finance-dashboard";
import { getNvSosDataQualityReport, getNvSosDocumentDashboard, getNvSosOperationalStatus, getNvSosSourceDashboard, getOfficialSourceDocumentsForProfile } from "@/lib/nv-sos/public";
import { getOfficials as getOfficialSummaries } from "@/lib/officials/store";
import { getCandidateProfiles } from "@/lib/server/elections-context";
import { getCurrentUser } from "@/lib/server/auth-session";
import type { NvSosFetchLogEntry } from "@/lib/nv-sos/pipeline";

export const dynamic = "force-dynamic";

type SearchFilters = {
  match?: string;
  recordType?: string;
  status?: string;
  donor?: string;
};

type AdminNvSosDocumentsPageProps = {
  searchParams?: Promise<SearchFilters>;
};

type MatchTarget = {
  label: string;
  href: string;
  id: string;
};

type ReviewRow = {
  id: string;
  recordType: "campaign_finance" | "candidate_detail" | "structured";
  title: string;
  candidateName: string | null;
  office: string | null;
  sourceUrl: string;
  cachedPath: string;
  status: string;
  confidence: number;
  unmatched: boolean;
  matchTarget: MatchTarget | null;
  contributionTotal: number | null;
  expenseTotal: number | null;
  cashOnHand: number | null;
  rowCounts: string;
};

type DonorReviewRow = DonorClassificationRecord & {
  candidateName: string;
};

function formatMoney(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Pending";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalNameTokens(value: string | null | undefined) {
  const aliases = new Map([
    ["joseph", "joe"],
    ["daniel", "danny"],
  ]);
  return normalizeName(value)
    .split(" ")
    .filter(Boolean)
    .map((token) => aliases.get(token) ?? token)
    .sort();
}

function namesMatch(left: string, right: string | null | undefined) {
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;
  const leftTokens = canonicalNameTokens(left);
  const rightTokens = canonicalNameTokens(right);
  return leftTokens.length > 1 && leftTokens.length === rightTokens.length && leftTokens.every((token, index) => token === rightTokens[index]);
}

function statusClass(status: string) {
  if (status === "success_html" || status === "success_pdf") return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
  if (status.startsWith("blocked_") || status === "forbidden") return "border-amber-300/20 bg-amber-500/10 text-amber-100";
  if (status === "error" || status === "error_http" || status === "error_fetch" || status === "not_found") return "border-rose-300/20 bg-rose-500/10 text-rose-100";
  return "border-white/10 bg-white/[0.05] text-slate-300";
}

function donorConfidenceClass(score: number) {
  if (score >= 85) return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
  if (score >= 60) return "border-cyan-300/20 bg-cyan-500/10 text-cyan-100";
  return "border-amber-300/20 bg-amber-500/10 text-amber-100";
}

function filterHref(current: Required<SearchFilters>, patch: Partial<SearchFilters>) {
  const params = new URLSearchParams({
    match: patch.match ?? current.match,
    recordType: patch.recordType ?? current.recordType,
    status: patch.status ?? current.status,
    donor: patch.donor ?? current.donor,
  });
  for (const [key, value] of [...params.entries()]) {
    if (value === "all" || value === "") params.delete(key);
  }
  const query = params.toString();
  return query ? `/admin/nv-sos-documents?${query}` : "/admin/nv-sos-documents";
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-2 text-xs font-semibold ${active ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-300"}`}
    >
      {children}
    </Link>
  );
}

function latestBySourceId(entries: NvSosFetchLogEntry[]) {
  const map = new Map<string, NvSosFetchLogEntry>();
  for (const entry of entries) map.set(entry.source_id, entry);
  return map;
}

export default async function AdminNvSosDocumentsPage({ searchParams }: AdminNvSosDocumentsPageProps) {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") redirect("/profile");

  const resolvedFilters = await searchParams;
  const filters: Required<SearchFilters> = {
    match: resolvedFilters?.match ?? "all",
    recordType: resolvedFilters?.recordType ?? "all",
    status: resolvedFilters?.status ?? "all",
    donor: resolvedFilters?.donor ?? "",
  };

  const [documents, sources, candidates, officials, qualityReport, operationalStatus, tarkanianPreview, lombardoPreview] = await Promise.all([
    getNvSosDocumentDashboard(),
    getNvSosSourceDashboard(),
    getCandidateProfiles(),
    getOfficialSummaries(),
    getNvSosDataQualityReport(),
    getNvSosOperationalStatus(),
    getOfficialSourceDocumentsForProfile("Danny Tarkanian"),
    getOfficialSourceDocumentsForProfile("Joe Lombardo"),
  ]);
  const allFetch = [...sources.fetchLog, ...sources.expandedFetchLog];
  const latestFetch = latestBySourceId(allFetch);
  const blocked = allFetch.filter((entry) => entry.status.startsWith("blocked_") || entry.status === "forbidden").length;
  const success = allFetch.filter((entry) => entry.status === "success_html" || entry.status === "success_pdf").length;
  const staleSession = operationalStatus?.session_status === "stale_blocked_session" || (allFetch.length > 0 && success === 0);

  function matchTarget(candidateName: string | null): MatchTarget | null {
    if (!candidateName) return null;
    const candidate = candidates.find((entry) => namesMatch(entry.name, candidateName));
    if (candidate) return { label: `Candidate · ${candidate.name}`, href: `/candidates/${candidate.id}`, id: candidate.id };
    const official = officials.find((entry) => namesMatch(entry.name, candidateName));
    if (official) return { label: `Official · ${official.name}`, href: `/officials/${official.id}`, id: official.id };
    return null;
  }

  const financeRows: ReviewRow[] = documents.campaignFinanceRecords.map((record) => {
    const status = latestFetch.get(record.source_id)?.status ?? "unknown";
    const target = matchTarget(record.candidate_name);
    return {
      id: `finance-${record.source_id}-${record.cached_path}`,
      recordType: "campaign_finance",
      title: record.report_name ?? "Campaign finance report",
      candidateName: record.candidate_name,
      office: record.office,
      sourceUrl: record.source_url,
      cachedPath: record.cached_path,
      status,
      confidence: record.parse_confidence,
      unmatched: record.unmatched || !target,
      matchTarget: target,
      contributionTotal: record.total_contributions,
      expenseTotal: record.total_expenses,
      cashOnHand: record.cash_on_hand,
      rowCounts: `${record.itemized_contributors.length} contributors · ${record.itemized_expenses.length} payees`,
    };
  });
  const candidateRows: ReviewRow[] = documents.candidateRecords.map((record) => {
    const status = latestFetch.get(record.source_id)?.status ?? "unknown";
    const target = matchTarget(record.candidate_name);
    return {
      id: `candidate-${record.source_id}-${record.cached_path}`,
      recordType: "candidate_detail",
      title: record.candidate_name ?? "Candidate filing list",
      candidateName: record.candidate_name,
      office: record.office,
      sourceUrl: record.source_url,
      cachedPath: record.cached_path,
      status,
      confidence: record.parse_confidence,
      unmatched: record.unmatched || !target,
      matchTarget: target,
      contributionTotal: null,
      expenseTotal: null,
      cashOnHand: null,
      rowCounts: record.public_contact.email || record.public_contact.phone || record.public_contact.website ? "Public contact parsed" : "No public contact parsed",
    };
  });
  const structuredRows: ReviewRow[] = documents.structured.map((document) => {
    const status = latestFetch.get(document.source_id)?.status ?? "unknown";
    const target = matchTarget(document.candidate_name);
    return {
      id: `structured-${document.source_id}-${document.cached_path}`,
      recordType: "structured",
      title: document.filing_report_type ?? document.source_type.replaceAll("_", " "),
      candidateName: document.candidate_name,
      office: document.office,
      sourceUrl: document.source_url,
      cachedPath: document.cached_path,
      status,
      confidence: document.parse_confidence,
      unmatched: document.unmatched || !target,
      matchTarget: target,
      contributionTotal: document.contribution_total,
      expenseTotal: document.expense_total,
      cashOnHand: document.cash_on_hand,
      rowCounts: `${document.itemized_contributors.length} contributors · ${document.itemized_payees.length} payees`,
    };
  });
  const rows = [...financeRows, ...candidateRows, ...structuredRows].filter((row) => {
    if (filters.match === "matched" && row.unmatched) return false;
    if (filters.match === "unmatched" && !row.unmatched) return false;
    if (filters.recordType !== "all" && row.recordType !== filters.recordType) return false;
    if (filters.status !== "all" && row.status !== filters.status) return false;
    return true;
  });
  const statuses = [...new Set([...financeRows, ...candidateRows, ...structuredRows].map((row) => row.status))].sort();
  const donorClassificationRows: DonorReviewRow[] = [...new Set(documents.campaignFinanceRecords.map((record) => record.candidate_name ?? "Unknown candidate"))].flatMap((candidateName) => {
    const candidateRecords = documents.campaignFinanceRecords.filter((record) => (record.candidate_name ?? "Unknown candidate") === candidateName);
    const dashboard = buildCampaignFinanceDashboard(candidateRecords, allFetch);
    return dashboard.donorClassifications.map((classification) => ({
      ...classification,
      candidateName,
    }));
  });
  const donorSearch = normalizeName(filters.donor);
  const filteredDonorRows = donorClassificationRows
    .filter((row) => {
      if (!donorSearch) return true;
      return normalizeName(`${row.normalizedName} ${row.originalName} ${row.entityType} ${row.industry} ${row.classificationSource}`).includes(donorSearch);
    })
    .slice(0, 40);
  const duplicateDonorGroups = [...donorClassificationRows.reduce((groups, row) => {
    const existing = groups.get(row.normalizedKey) ?? new Set<string>();
    existing.add(row.originalName);
    groups.set(row.normalizedKey, existing);
    return groups;
  }, new Map<string, Set<string>>()).entries()]
    .filter(([, originals]) => originals.size > 1)
    .slice(0, 8);
  const lowConfidenceDonors = donorClassificationRows.filter((row) => row.confidenceScore < 60).length;

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin · Nevada SOS"
        title="Parsed documents"
        description="Review matched and unmatched Nevada SoS candidate detail, campaign finance, and structured document records."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/nv-sos-sources" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
              Sources
            </Link>
            <Link href="/admin/data-factory/campaign-finance" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Finance factory
            </Link>
          </div>
        }
      />

      <section className={`rounded-2xl border p-5 ${staleSession ? "border-amber-300/25 bg-amber-500/10" : "border-emerald-300/20 bg-emerald-500/10"}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className={`text-sm font-semibold ${staleSession ? "text-amber-50" : "text-emerald-50"}`}>
              {staleSession ? "Stale/blocked session · cache serving profiles" : "Active session"}
            </p>
            <p className={`mt-2 max-w-3xl text-sm leading-6 ${staleSession ? "text-amber-100/80" : "text-emerald-100/80"}`}>
              {operationalStatus?.next_recommended_action ?? "Run npm run nv-sos:status to generate operational status."}
            </p>
          </div>
          <div className="grid gap-1 text-sm text-slate-200 lg:min-w-72">
            <p>Last successful live fetch: {formatDate(operationalStatus?.last_successful_live_fetch_at)}</p>
            <p>Last successful cached parse: {formatDate(operationalStatus?.last_successful_parse_at)}</p>
            <p>Records served from cache: {operationalStatus?.records_served_from_cache ?? financeRows.length + candidateRows.length + structuredRows.length}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Parsed records</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{financeRows.length + candidateRows.length + structuredRows.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Unmatched</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{qualityReport?.unmatched_records ?? documents.unmatched.length + documents.unmatchedCandidates.length + documents.unmatchedCampaignFinance.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100/70">Blocked fetches</p>
          <p className="mt-3 text-3xl font-semibold text-amber-50">{blocked}</p>
        </div>
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/70">Successful fetches</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-50">{success}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <p className="text-sm font-semibold text-slate-100">Filters</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["all", "matched", "unmatched"] as const).map((value) => (
            <FilterLink key={value} href={filterHref(filters, { match: value })} active={filters.match === value}>
              {value}
            </FilterLink>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["all", "campaign_finance", "candidate_detail", "structured"] as const).map((value) => (
            <FilterLink key={value} href={filterHref(filters, { recordType: value })} active={filters.recordType === value}>
              {value.replaceAll("_", " ")}
            </FilterLink>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <FilterLink href={filterHref(filters, { status: "all" })} active={filters.status === "all"}>
            all statuses
          </FilterLink>
          {statuses.map((status) => (
            <FilterLink key={status} href={filterHref(filters, { status })} active={filters.status === status}>
              {status.replaceAll("_", " ")}
            </FilterLink>
          ))}
        </div>
        <form action="/admin/nv-sos-documents" className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input type="hidden" name="match" value={filters.match} />
          <input type="hidden" name="recordType" value={filters.recordType} />
          <input type="hidden" name="status" value={filters.status} />
          <label className="sr-only" htmlFor="donor-search">
            Search donor classifications
          </label>
          <input
            id="donor-search"
            name="donor"
            defaultValue={filters.donor}
            placeholder="Search normalized donors, entity types, industries"
            className="min-h-11 flex-1 rounded-full border border-white/10 bg-black/20 px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/40"
          />
          <button type="submit" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
            Search donors
          </button>
          {filters.donor ? (
            <Link href={filterHref(filters, { donor: "" })} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-300">
              Clear
            </Link>
          ) : null}
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Admin preview</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">Public finance card rendering</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Preview of the chart dashboard using matched Nevada SoS campaign finance records with the richest parsed data.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-5 2xl:grid-cols-2">
          <div className="rounded-[1.35rem] border border-white/10 bg-slate-950/35 p-4">
            <CampaignFinanceSummaryCard dashboard={tarkanianPreview.campaignFinanceDashboard} previewLabel="Danny Tarkanian" />
          </div>
          <div className="rounded-[1.35rem] border border-white/10 bg-slate-950/35 p-4">
            <CampaignFinanceSummaryCard dashboard={lombardoPreview.campaignFinanceDashboard} previewLabel="Joe Lombardo" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Donor classification review</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">Normalized funding-source intelligence</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Manual overrides in data/source-seeds/nv-sos-donor-classification-overrides.json take precedence over known-entity, historical, and keyword classification. Merge candidates are grouped by normalized donor key.
            </p>
          </div>
          <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
              <p className="text-xs text-slate-500">Classified donors</p>
              <p className="mt-1 text-2xl font-semibold text-slate-50">{donorClassificationRows.length}</p>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-3">
              <p className="text-xs text-amber-100/70">Low confidence</p>
              <p className="mt-1 text-2xl font-semibold text-amber-50">{lowConfidenceDonors}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
              <p className="text-xs text-slate-500">Duplicate groups</p>
              <p className="mt-1 text-2xl font-semibold text-slate-50">{duplicateDonorGroups.length}</p>
            </div>
          </div>
        </div>

        {duplicateDonorGroups.length ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-sm font-semibold text-slate-100">Potential duplicate donor names already merged by normalization</p>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {duplicateDonorGroups.map(([normalizedKey, originals]) => (
                <div key={normalizedKey} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-sm font-semibold text-slate-100">{normalizedKey}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{[...originals].join(" · ")}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3">
          {filteredDonorRows.length ? (
            filteredDonorRows.map((row) => (
              <article key={`${row.candidateName}-${row.id}`} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-sm font-semibold leading-5 text-slate-100 [overflow-wrap:anywhere]">{row.normalizedName}</h3>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${donorConfidenceClass(row.confidenceScore)}`}>
                        {row.confidenceScore}% confidence
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-300">{row.classificationSource}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {row.candidateName} · {row.rowCount} row{row.rowCount === 1 ? "" : "s"} · {row.adjustmentRowCount} adjustment row{row.adjustmentRowCount === 1 ? "" : "s"}
                    </p>
                    <p className="mt-2 break-words text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">Original: {row.originalName}</p>
                    {row.address ? <p className="mt-1 break-words text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">Address: {row.address}</p> : null}
                  </div>
                  <div className="grid gap-2 text-sm text-slate-300 xl:min-w-96">
                    <p>Entity: {row.entityType} · {row.entityTypeConfidenceScore}%</p>
                    <p>Industry: {row.industry} · {row.industryConfidenceScore}%</p>
                    <p>Incoming amount used in charts: {formatMoney(row.contributionAmount)}</p>
                    <p>Excluded accounting amount: {formatMoney(row.excludedAdjustmentAmount)}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Entity reason: {row.entityTypeReason} Industry reason: {row.industryReason}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.sourceUrls.slice(0, 3).map((sourceUrl) => (
                    <a key={sourceUrl} href={sourceUrl} target="_blank" rel="noreferrer" className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:border-cyan-300/30">
                      Source report
                    </a>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-5 text-sm leading-6 text-slate-400">
              No donor classifications match the current search.
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        {rows.length ? (
          rows.map((row) => (
            <article key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-50">{row.title}</h2>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${statusClass(row.status)}`}>
                      {row.status.replaceAll("_", " ")}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                      {row.recordType.replaceAll("_", " ")}
                    </span>
                    {row.unmatched ? (
                      <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100">
                        unmatched
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {row.candidateName ?? "Candidate pending"} · {row.office ?? "Office pending"}
                  </p>
                  <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all text-xs font-semibold text-cyan-200">
                    {row.sourceUrl}
                  </a>
                  <p className="mt-2 break-all text-xs text-slate-500">Cache: {row.cachedPath}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Match target:{" "}
                    {row.matchTarget ? (
                      <Link href={row.matchTarget.href} className="font-semibold text-cyan-200">
                        {row.matchTarget.label} · {row.matchTarget.id}
                      </Link>
                    ) : (
                      "No profile match"
                    )}
                  </p>
                </div>
                <div className="grid gap-2 text-sm text-slate-300 xl:min-w-96">
                  <p>Contributions: {formatMoney(row.contributionTotal)}</p>
                  <p>Expenses: {formatMoney(row.expenseTotal)}</p>
                  <p>Cash on hand: {formatMoney(row.cashOnHand)}</p>
                  <p>Rows: {row.rowCounts}</p>
                  <p>Parse confidence: {Math.round(row.confidence * 100)}%</p>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-5 text-sm leading-6 text-slate-400">
            No Nevada SoS records match the selected filters.
          </div>
        )}
      </section>
    </div>
  );
}
