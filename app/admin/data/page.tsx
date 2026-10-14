import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import {
  addCandidateWebsiteUrlAction,
  addOfficialWebsiteUrlAction,
  attachSourceToProfileAction,
  flagDataQualityIssueAction,
  markRecordVerifiedAction,
  mergeDuplicateCandidateRecordsAction,
  resolveDataQualityIssueAction,
} from "@/lib/civic-data/actions";
import { getCivicDataDashboard, getCivicDataMetrics } from "@/lib/civic-data/service";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

const adminLinks = [
  { href: "/admin/preview", label: "Preview Mode" },
  { href: "/admin/data/officials-qa", label: "Officials QA" },
  { href: "/admin/enrichment", label: "Enrichment Review" },
  { href: "/admin/documents", label: "Documents" },
  { href: "/admin/news-mentions", label: "News Mentions" },
  { href: "/admin/sources", label: "Data Sources" },
  { href: "/admin/imports", label: "Imports" },
  { href: "/admin/officials", label: "Officials" },
  { href: "/admin/elections", label: "Elections" },
  { href: "/admin/candidates", label: "Candidates" },
  { href: "/admin/initiatives", label: "Initiatives" },
  { href: "/admin/ballot-measures", label: "Ballot Measures" },
  { href: "/admin/elections/qa", label: "Elections QA" },
];

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value) : "Never";
}

export default async function AdminDataPage() {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }

  const [metrics, dashboard] = await Promise.all([getCivicDataMetrics(), getCivicDataDashboard()]);
  const metricCards = [
    { label: "Jurisdictions", value: metrics.jurisdictions },
    { label: "Offices", value: metrics.offices },
    { label: "Districts", value: metrics.districts },
    { label: "Officials", value: metrics.officials },
    { label: "Elections", value: metrics.elections },
    { label: "Bills", value: metrics.bills },
    { label: "Initiatives", value: metrics.initiatives },
    { label: "Meetings", value: metrics.meetings },
    { label: "Ads", value: metrics.ads },
    { label: "Data Sources", value: metrics.dataSources },
  ];

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Nevada beta data"
        description="Monitor the normalized civic data foundation for Nevada government, counties, cities, school districts, boards, and commissions."
        actions={
          <div className="flex flex-wrap gap-2">
            {adminLinks.map((link) => (
              <Link key={link.href} href={link.href} className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
                {link.label}
              </Link>
            ))}
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-50">{metric.value.toLocaleString()}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-5">
        <h2 className="text-lg font-semibold text-slate-50">Data foundation scope</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          This phase tracks Nevada State Government, Nevada Legislature, Nevada Federal Delegation, Carson City, Reno, Washoe County,
          University of Nevada, Reno, and Associated Students of the University of Nevada.
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">QA Workflow</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              These checks identify gaps in stored civic records. Import jobs and admins can persist individual problems to DataQualityIssue for review and resolution.
            </p>
          </div>
          <Link href="/admin/imports/manual-candidates" className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">
            Manual override tools
          </Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            { label: "Missing Candidate Bios", value: dashboard.qa.missingCandidateBios, detail: "Candidates without stored campaign statement or approved bio enrichment." },
            { label: "Missing Campaign Websites", value: dashboard.qa.missingCampaignWebsites, detail: "Candidates without a stored campaign or public website URL." },
            { label: "Missing District Matches", value: dashboard.qa.missingDistrictMatches, detail: "Candidate records not yet tied to an imported district boundary or source district." },
            { label: "Duplicate Candidates", value: dashboard.qa.duplicateCandidates, detail: "Same candidate name repeated in the same election." },
            { label: "Stale Sources", value: dashboard.qa.staleSources, detail: "Active sources not checked recently or currently in error." },
            { label: "Open Quality Issues", value: dashboard.qa.openQualityIssues, detail: "Persisted DataQualityIssue records still open or in review." },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-50">{item.value.toLocaleString()}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-slate-50">Manual Override Tools</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          These tools update stored records or create review issues only. They do not scrape pages or publish fake civic data.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <form action={addCandidateWebsiteUrlAction} className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-sm font-semibold text-slate-100">Add candidate website URL</p>
            <div className="mt-3 grid gap-2">
              <input name="candidateId" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Candidate ID" />
              <input name="entityName" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Candidate name" />
              <input name="websiteUrl" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="https://campaign.example" />
              <button className="dd-button-secondary rounded-xl px-3 py-2 text-sm font-semibold" type="submit">Save for review</button>
            </div>
          </form>
          <form action={addOfficialWebsiteUrlAction} className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-sm font-semibold text-slate-100">Add official website URL</p>
            <div className="mt-3 grid gap-2">
              <input name="officialId" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Official ID" />
              <input name="entityName" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Official name" />
              <input name="websiteUrl" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="https://official.example" />
              <button className="dd-button-secondary rounded-xl px-3 py-2 text-sm font-semibold" type="submit">Save for review</button>
            </div>
          </form>
          <form action={markRecordVerifiedAction} className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-sm font-semibold text-slate-100">Mark record verified</p>
            <div className="mt-3 grid gap-2">
              <input name="entityType" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="CANDIDATE / OFFICIAL / ISSUE_POSITION" />
              <input name="entityId" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Record ID" />
              <input name="entityName" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Display name" />
              <input name="sourceName" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Source name" />
              <input name="sourceUrl" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Source URL" />
              <button className="dd-button-secondary rounded-xl px-3 py-2 text-sm font-semibold" type="submit">Mark verified</button>
            </div>
          </form>
          <form action={attachSourceToProfileAction} className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-sm font-semibold text-slate-100">Attach source to profile</p>
            <div className="mt-3 grid gap-2">
              <input name="entityType" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="CANDIDATE / OFFICIAL" />
              <input name="entityId" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Record ID" />
              <input name="entityName" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Display name" />
              <input name="sourceSlug" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Existing source slug, optional" />
              <input name="sourceName" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Source name, optional" />
              <input name="sourceUrl" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Source URL" />
              <textarea name="notes" className="min-h-20 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Attachment notes" />
              <button className="dd-button-secondary rounded-xl px-3 py-2 text-sm font-semibold" type="submit">Attach for review</button>
            </div>
          </form>
          <form action={flagDataQualityIssueAction} className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-sm font-semibold text-slate-100">Flag record for correction</p>
            <div className="mt-3 grid gap-2">
              <input name="recordType" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="CANDIDATE / OFFICIAL / ELECTION" />
              <input name="recordId" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Record ID" />
              <input name="issueType" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="missing_bio / stale_source / duplicate_candidate" />
              <input name="severity" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="info / warning / error / critical" />
              <textarea name="notes" className="min-h-20 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Correction notes" />
              <button className="dd-button-secondary rounded-xl px-3 py-2 text-sm font-semibold" type="submit">Flag issue</button>
            </div>
          </form>
          <form action={mergeDuplicateCandidateRecordsAction} className="rounded-2xl border border-white/10 bg-black/15 p-4 lg:col-span-2">
            <p className="text-sm font-semibold text-slate-100">Queue duplicate candidate merge review</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">This creates a review issue only; it does not delete or merge records automatically.</p>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <input name="primaryCandidateId" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Primary candidate ID" />
              <input name="duplicateCandidateId" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Duplicate candidate ID" />
              <button className="dd-button-secondary rounded-xl px-3 py-2 text-sm font-semibold" type="submit">Queue review</button>
            </div>
          </form>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-50">Data Sources</h2>
            <Link href="/admin/sources" className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">Manage</Link>
          </div>
          <div className="mt-4 space-y-3">
            {dashboard.sources.slice(0, 5).map((source) => (
              <div key={source.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-50">{source.name}</p>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                    {source.syncStatus.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Priority {source.importPriority} · {source.dataCategory?.replaceAll("_", " ") ?? "uncategorized"} · {source.accessMethod.replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-xs text-slate-400">Every {source.refreshFrequency?.replaceAll("_", " ") ?? "unscheduled"} · last checked {formatDate(source.lastCheckedAt)}</p>
                {source.errorLog ? <p className="mt-2 text-xs text-amber-200">Stale warning: last check failed; keeping last good data.</p> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-50">Import Runs</h2>
            <Link href="/admin/imports" className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">View all</Link>
          </div>
          <div className="mt-4 space-y-3">
            {dashboard.importRuns.slice(0, 5).map((run) => (
              <div key={run.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
                <p className="font-semibold text-slate-50">{run.sourceName}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {run.status.replaceAll("_", " ")} · {run.recordsFound.toLocaleString()} found · {run.recordsCreated.toLocaleString()} created ·{" "}
                  {run.recordsUpdated.toLocaleString()} updated · {run.recordsFlaggedForReview.toLocaleString()} review
                </p>
              </div>
            ))}
            {dashboard.importRuns.length === 0 ? <p className="text-sm text-slate-400">No import runs recorded yet.</p> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-slate-50">Pending Review</h2>
          <div className="mt-4 space-y-3">
            {dashboard.pendingReviews.map((review) => (
              <div key={review.id} className="rounded-xl border border-amber-200/15 bg-amber-400/5 p-3">
                <p className="font-semibold text-slate-50">{review.entityName}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-amber-100">{review.entityType.replaceAll("_", " ")}</p>
                {review.summary ? <p className="mt-2 text-sm text-slate-300">{review.summary}</p> : null}
              </div>
            ))}
            {dashboard.pendingReviews.length === 0 ? <p className="text-sm text-slate-400">No import conflicts waiting for review.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-slate-50">Recently Updated Records</h2>
          <div className="mt-4 space-y-3">
            {dashboard.recentlyUpdatedRecords.map((record) => (
              <div key={record.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
                <p className="font-semibold text-slate-50">{record.entityType.replaceAll("_", " ")}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {record.changeType} · {record.changedFields.join(", ") || "source snapshot"} · {formatDate(record.recordedAt)}
                </p>
                <p className="mt-1 text-xs text-slate-500">{record.sourceName}</p>
              </div>
            ))}
            {dashboard.recentlyUpdatedRecords.length === 0 ? <p className="text-sm text-slate-400">No versioned updates recorded yet.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-slate-50">Data Completeness</h2>
          <div className="mt-4 space-y-3">
            {dashboard.completeness.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/15 p-3">
                <div>
                  <p className="font-semibold text-slate-50">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.count.toLocaleString()} stored records</p>
                </div>
                <span className={item.status === "ready" ? "text-xs font-semibold text-emerald-200" : "text-xs font-semibold text-amber-200"}>
                  {item.status === "ready" ? "Ready" : "Pending import"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-slate-50">Tracked Data Quality Issues</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {dashboard.dataQualityIssues.map((issue) => (
            <div key={issue.id} className="rounded-xl border border-amber-200/15 bg-amber-400/5 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-50">{issue.issueType.replaceAll("_", " ")}</p>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                  {issue.severity}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                  {issue.status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-2 text-xs uppercase tracking-[0.14em] text-amber-100">{issue.recordType.replaceAll("_", " ")}</p>
              {issue.recordId ? <p className="mt-1 text-xs text-slate-500">Record: {issue.recordId}</p> : null}
              {issue.notes ? <p className="mt-2 text-sm leading-6 text-slate-300">{issue.notes}</p> : null}
              <p className="mt-2 text-xs text-slate-500">Opened {formatDate(issue.createdAt)}</p>
              <form action={resolveDataQualityIssueAction} className="mt-3">
                <input type="hidden" name="issueId" value={issue.id} />
                <button type="submit" className="dd-button-secondary rounded-full px-3 py-2 text-xs font-semibold">Resolve</button>
              </form>
            </div>
          ))}
          {dashboard.dataQualityIssues.length === 0 ? <p className="text-sm text-slate-400">No persisted data quality issues are open.</p> : null}
        </div>
      </section>
    </div>
  );
}
