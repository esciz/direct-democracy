import { ExploreResultCard } from "@/components/domain/explore-result-card";
import { PageIntro } from "@/components/ui/page-intro";
import { PreserveScrollQueryForm } from "@/components/ui/preserve-scroll-query-form";
import { getCurrentUser } from "@/lib/server/auth-session";
import { slugifyIssueText } from "@/lib/issues/utils";
import { getIssueDirectoryForUser, getIssueSummary } from "@/lib/server/issues";
import type { TopIssueSummary } from "@/types/domain";

type IssuesIndexPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

function renderIssueBadges(issue: TopIssueSummary) {
  return (
    <>
      <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">{issue.scope}</span>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
        {issue.source === "curated" ? "Canonical topic" : "Community activity"}
      </span>
      <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
        {issue.upvoteCount} supporter{issue.upvoteCount === 1 ? "" : "s"}
      </span>
    </>
  );
}

export default async function IssuesIndexPage({ searchParams }: IssuesIndexPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const query = params?.q?.trim() ?? "";
  const issues = await getIssueDirectoryForUser(user, { query });

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Issues"
        title="Browse issue hubs"
        description="Browse broad public-interest topics like Teacher Pay, Affordable Housing, and Water Access, then open a topic hub to see the connected civic activity."
        meta={<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{issues.length} issues</span>}
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
        <div className="grid gap-4 xl:grid-cols-2">
          {issues.length ? (
            issues.map((issue) => (
              <ExploreResultCard
                key={issue.id}
                title={issue.issueText}
                subtitle={`${issue.jurisdictionName} · ${issue.scope}`}
                description={getIssueSummary(issue.issueText)}
                href={`/issues/${slugifyIssueText(issue.issueText)}`}
                ctaLabel="Open issue"
                badges={renderIssueBadges(issue)}
                favorite={{ targetType: "issue", targetId: issue.id }}
              />
            ))
          ) : (
            <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600 xl:col-span-2">
              {query ? `No issues match “${query}” yet.` : "No issues are available yet."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
