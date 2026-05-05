import Link from "next/link";

import { FilterTabs } from "@/components/ui/filter-tabs";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getVotingLibrary } from "@/lib/feed/quick-votes";
import { getVoteObjectLabel } from "@/lib/votes/presentation";
import type { VoteObjectType } from "@/types/domain";

type VotingAllPageProps = {
  searchParams?: Promise<{
    filter?: string;
  }>;
};

type VotingFilter = "all" | "people" | "issues" | "cases";

function normalizeFilter(value: string | undefined): VotingFilter {
  if (value === "people" || value === "issues" || value === "cases") {
    return value;
  }

  return "all";
}

function matchesFilter(filter: VotingFilter, objectType: VoteObjectType) {
  if (filter === "all") return true;
  if (filter === "people") return objectType === "representative";
  if (filter === "cases") return objectType === "case";
  return objectType === "decision" || objectType === "community";
}

export default async function VotingAllPage({ searchParams }: VotingAllPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const user = await getCurrentUser();
  const filter = normalizeFilter(params?.filter);
  const questions = (await getVotingLibrary(user, { scope: "all", category: "all", objectType: "all" })).filter((question) =>
    matchesFilter(filter, question.objectType ?? "decision"),
  );
  const tabs = [
    { label: "All", href: "/voting/all?filter=all", active: filter === "all" },
    { label: "People", href: "/voting/all?filter=people", active: filter === "people" },
    { label: "Issues", href: "/voting/all?filter=issues", active: filter === "issues" },
    { label: "Cases", href: "/voting/all?filter=cases", active: filter === "cases" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10 pt-2 sm:pt-4">
      <section className="rounded-[1.9rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-civic-700">Voting queue</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">All voting questions</h1>
            <p className="mt-2 text-sm text-slate-600">
              Browse the full queue, then jump back to the one-question voting flow when you’re ready.
            </p>
          </div>
          <Link
            href={`/voting?filter=${filter}`}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-300 hover:text-civic-700"
          >
            Back to VOTE
          </Link>
        </div>

        <div className="mt-5">
          <FilterTabs tabs={tabs} />
        </div>
      </section>

      <section className="space-y-3">
        {questions.map((question) => (
          <article key={question.id} className="rounded-[1.6rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">{getVoteObjectLabel(question)}</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">{question.questionText}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {question.communityLabel ?? question.jurisdictionName}
                </span>
                {question.relatedIssueLabel ? (
                  <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
                    {question.relatedIssueLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
