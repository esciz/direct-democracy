import { PageIntro } from "@/components/ui/page-intro";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { TopIssueCard } from "@/components/domain/top-issue-card";
import { TopIssueForm } from "@/components/domain/top-issue-form";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getTopIssuesForUser } from "@/lib/community/issues";
import { getIssuePickerOptions } from "@/lib/server/issues";
import type { VoteQuestionScope } from "@/types/domain";

type TopIssuesPageProps = {
  searchParams?: Promise<{
    scope?: string;
    issue?: string;
  }>;
};

function normalizeScope(scope: string | undefined): VoteQuestionScope {
  if (scope === "state" || scope === "national") {
    return scope;
  }

  return "local";
}

export default async function TopIssuesPage({ searchParams }: TopIssuesPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const user = await getCurrentUser();
  const scope = normalizeScope(params?.scope);
  const [issues, issueOptions] = await Promise.all([getTopIssuesForUser(user, scope), getIssuePickerOptions(user)]);
  const tabs = [
    { label: "Local", href: "/top-issues?scope=local", active: scope === "local" },
    { label: "State", href: "/top-issues?scope=state", active: scope === "state" },
    { label: "National", href: "/top-issues?scope=national", active: scope === "national" },
  ];
  const returnPath = `/top-issues?scope=${scope}`;

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Top Issues"
        title="Support what should rise today"
        description="Browse broad shared issues by scope, then support the ones that matter most to you."
        meta={<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{user.jurisdictionName}</span>}
      />

      {params?.issue === "success" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your top issue was added to the current issue board.
        </section>
      ) : null}
      {params?.issue === "error" ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          Please enter a clearer issue before submitting.
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-civic-700">Issue board</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">See what people want elevated</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                Switch perspectives to compare what is rising in your local area, across Nevada, and nationally.
              </p>
            </div>
            <FilterTabs tabs={tabs} />
          </div>
          <div className="mt-6 grid gap-4">
            {issues.length ? (
              issues.map((issue) => <TopIssueCard key={issue.id} issue={issue} returnPath={returnPath} />)
            ) : (
              <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">
                No issues are showing for this scope yet. Add a shared issue to seed the board.
              </div>
            )}
          </div>
        </section>

        <TopIssueForm jurisdictionName={user.jurisdictionName} selectedScope={scope} issueOptions={issueOptions} returnPath={returnPath} />
      </section>
    </div>
  );
}
