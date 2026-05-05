import { CommunityPulseCard } from "@/components/domain/community-pulse-card";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageIntro } from "@/components/ui/page-intro";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getCommunityPulsePageData } from "@/lib/community/dashboard";
import type { VoteQuestionScope } from "@/types/domain";

type CommunityPulsePageProps = {
  searchParams?: Promise<{
    scope?: string;
  }>;
};

function normalizeScope(scope: string | undefined): VoteQuestionScope | "all" {
  if (scope === "local" || scope === "state" || scope === "national") {
    return scope;
  }

  return "all";
}

export default async function CommunityPulsePage({ searchParams }: CommunityPulsePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const user = await getCurrentUser();
  const scope = normalizeScope(params?.scope);
  const data = await getCommunityPulsePageData(user, scope);
  const tabs = [
    { label: "All", href: "/community-pulse?scope=all", active: scope === "all" },
    { label: "Local", href: "/community-pulse?scope=local", active: scope === "local" },
    { label: "State", href: "/community-pulse?scope=state", active: scope === "state" },
    { label: "National", href: "/community-pulse?scope=national", active: scope === "national" },
  ];

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Community Pulse"
        title="See how communities are voting on formal decisions"
        description="Community Pulse now highlights formal votes with public response, making it easier to compare live public sentiment with real decision objects."
        meta={
          <>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{user.jurisdictionName}</span>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
              {data.progress.answered} of {data.progress.total} daily votes answered
            </span>
          </>
        }
      />

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-civic-700">Scope</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Browse formal votes by perspective</h2>
          </div>
          <FilterTabs tabs={tabs} />
        </div>
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {data.questions.length ? (
            data.questions.map((question) => <CommunityPulseCard key={question.id} question={question} />)
          ) : (
            <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600 xl:col-span-2">
              There are no formal vote results to show for this scope yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
