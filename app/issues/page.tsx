import { ExploreResultCard } from "@/components/domain/explore-result-card";
import { PageIntro } from "@/components/ui/page-intro";
import { PreserveScrollQueryForm } from "@/components/ui/preserve-scroll-query-form";
import Link from "next/link";
import { getIssueReviewRequests } from "@/lib/issues/review-requests";
import { getCurrentUser } from "@/lib/server/auth-session";
import { slugifyIssueText } from "@/lib/issues/utils";
import { getIssueDirectoryForUser, getIssueSummary } from "@/lib/server/issues";
import type { PublicIssueHubSummary } from "@/types/domain";

type IssuesIndexPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Update pending";
}

function renderIssueBadges(issue: PublicIssueHubSummary) {
  return (
    <>
      <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">{issue.scope}</span>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
        {issue.category}
      </span>
      {issue.sourceBacked ? (
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Real civic records</span>
      ) : null}
      {issue.reviewStatus ? (
        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
          {issue.reviewStatus.replaceAll("_", " ")}
        </span>
      ) : null}
      {issue.showDemoBadge ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Demo fallback</span> : null}
    </>
  );
}

export default async function IssuesIndexPage({ searchParams }: IssuesIndexPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const query = params?.q?.trim() ?? "";
  const [issues, reviewRequests] = await Promise.all([getIssueDirectoryForUser(user, { query }), getIssueReviewRequests()]);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Issues"
        title="Browse issue hubs"
        description="Issues are the connective layer for citizen submissions, news, meetings, votes, legislation, court records, officials, spending, projects, and communities."
        meta={
          <>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{issues.length} issues</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{reviewRequests.length} review requests</span>
          </>
        }
        actions={
          <Link href="/issues/report" className="dd-button-primary rounded-full px-4 py-3 text-sm font-semibold">
            Report an issue
          </Link>
        }
      />

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <PreserveScrollQueryForm action="/issues" className="flex flex-wrap gap-3">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search issues"
            className="min-w-[18rem] flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
          />
          <button type="submit" className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            Search
          </button>
        </PreserveScrollQueryForm>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Issue review requests</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">Citizen-submitted concerns under review</h2>
            <p className="mt-2 text-sm text-slate-600">
              These are issue objects, not cases. They can link to court records, meetings, votes, officials, agencies, news, spending, and projects after review.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {reviewRequests.length} request{reviewRequests.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {reviewRequests.length ? (
            reviewRequests.slice(0, 6).map((request) => (
              <article key={request.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{request.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{request.category} · {request.community}</p>
                  </div>
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{request.status.replaceAll("_", " ")}</span>
                </div>
                {request.proposedSummary ? <p className="mt-3 text-sm leading-6 text-slate-600">{request.proposedSummary}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                  <span className="rounded-full bg-slate-100 px-3 py-1">{request.evidence.length} evidence item{request.evidence.length === 1 ? "" : "s"}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">{request.identifiedCourtCaseNumbers.length} case number match{request.identifiedCourtCaseNumbers.length === 1 ? "" : "es"}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">{request.identifiedAgencies.length} agenc{request.identifiedAgencies.length === 1 ? "y" : "ies"}</span>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600 lg:col-span-2">
              No issue review requests have been imported or submitted yet.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="grid gap-4 xl:grid-cols-2">
          {issues.length ? (
            issues.map((issue) => (
              <ExploreResultCard
                key={issue.id}
                title={issue.plainTitle ?? issue.issueText}
                subtitle={`${issue.jurisdictionName} · ${issue.category ?? issue.scope}`}
                description={
                  issue.whyThisMatters ??
                  getIssueSummary(issue.issueText)
                }
                href={`/issues/${slugifyIssueText(issue.issueText)}`}
                ctaLabel="Open issue"
                badges={renderIssueBadges(issue)}
                avatar={{
                  name: issue.issueText,
                  entityType: "issue",
                }}
                chart={
                  <div className="grid min-w-[16rem] grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
                    <span className="rounded-2xl bg-slate-100 px-3 py-2">{issue.sourceCount ?? 0} sources</span>
                    <span className="rounded-2xl bg-slate-100 px-3 py-2">{issue.linkedMeetingsCount ?? 0} meetings</span>
                    <span className="rounded-2xl bg-slate-100 px-3 py-2">{issue.linkedVotesCount ?? 0} votes</span>
                    <span className="rounded-2xl bg-slate-100 px-3 py-2">{issue.linkedCourtRecordsCount ?? 0} court records</span>
                    <span className="rounded-2xl bg-slate-100 px-3 py-2">Updated {formatDate(issue.lastUpdatedAt ?? issue.createdAt)}</span>
                    <span className="rounded-2xl bg-slate-100 px-3 py-2">{Math.round((issue.confidence ?? 0) * 100)}% confidence</span>
                  </div>
                }
                favorite={{ targetType: "issue", targetId: issue.id }}
              />
            ))
          ) : (
            <div className="rounded-3xl bg-slate-50 p-6 text-sm leading-6 text-slate-600 xl:col-span-2">
              <p className="font-semibold text-ink">
                {query ? `No source-backed issues match “${query}” yet.` : "No source-backed issues are available yet for this community."}
              </p>
              <p className="mt-2">
                Direct Democracy is still importing meetings, votes, court records, and news for this area.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/issues" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                  Browse statewide issues
                </Link>
                <Link href="/cases" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                  Browse all public court records
                </Link>
                <Link href="/issues/report" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                  Submit an issue for review
                </Link>
                <Link href="/events" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                  View meetings
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
