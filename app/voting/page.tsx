import Link from "next/link";

import { VoteCard } from "@/components/domain/vote-card";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { canUserVote } from "@/lib/auth/guards";
import { getVerificationLabel } from "@/lib/auth/verification";
import { getCivicSignalsDashboard } from "@/lib/civic-signals/dashboard";
import { getCurrentUser } from "@/lib/server/auth-session";
import type { VoteQuestionCardSummary } from "@/types/domain";

type VotingPageProps = {
  searchParams?: Promise<{
    filter?: string;
    index?: string;
    voted?: string;
    voteError?: string;
  }>;
};

type VotingFilter = "all" | "people" | "issues" | "cases";

function normalizeFilter(value: string | undefined): VotingFilter {
  if (value === "people" || value === "issues" || value === "cases") {
    return value;
  }

  return "all";
}

function matchesQuestionFilter(filter: VotingFilter, question: VoteQuestionCardSummary) {
  if (filter === "all") return true;
  if (filter === "people") return question.objectType === "representative" && (question.civicEntityType === "OFFICIAL" || question.civicEntityType === "CANDIDATE");
  if (filter === "cases") return question.objectType === "case" || question.civicEntityType === "BALLOT_MEASURE" || question.civicEntityType === "ELECTION";
  return question.civicEntityType === "ISSUE_POSITION" || question.objectType === "decision" || question.objectType === "community";
}

function getQueueHref(filter: VotingFilter, index: number) {
  const params = new URLSearchParams();
  params.set("filter", filter);
  params.set("index", String(Math.max(0, index)));
  return `/voting?${params.toString()}`;
}

function parseActiveIndex(value: string | undefined, total: number) {
  const parsed = Number.parseInt(value ?? "0", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(parsed, Math.max(total - 1, 0));
}

function EmptyState({ children }: { children?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-slate-400">
      {children ?? "No verified real-data content available yet for this jurisdiction."}
    </div>
  );
}

function CivicQuestionsSection({
  questions,
  canVote,
  filter,
  activeIndex,
}: {
  questions: VoteQuestionCardSummary[];
  canVote: boolean;
  filter: VotingFilter;
  activeIndex: number;
}) {
  const activeQuestion = questions[activeIndex] ?? null;
  const tabs = [
    { label: "All", href: getQueueHref("all", 0), active: filter === "all" },
    { label: "People", href: getQueueHref("people", 0), active: filter === "people" },
    { label: "Issues", href: getQueueHref("issues", 0), active: filter === "issues" },
    { label: "Cases / Elections", href: getQueueHref("cases", 0), active: filter === "cases" },
  ];
  const previousIndex = activeIndex <= 0 ? questions.length - 1 : activeIndex - 1;
  const nextIndex = activeIndex >= questions.length - 1 ? 0 : activeIndex + 1;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Civic Questions</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Questions are generated only from imported, source-attributed Nevada civic records that have passed review.
          </p>
        </div>
        <Link href="/voting/history" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
          Voting history
        </Link>
      </div>
      <FilterTabs tabs={tabs} />
      {questions.length ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                Question {activeIndex + 1} of {questions.length}
              </p>
              <p className="mt-1 text-sm text-slate-400">{questions.length} verified real-data question{questions.length === 1 ? "" : "s"} in this queue.</p>
            </div>
            <Link
              href={`/voting/all?filter=${filter}`}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:text-cyan-100"
            >
              View all / {questions.length}
            </Link>
          </div>
          {activeQuestion ? <VoteCard key={activeQuestion.id} question={activeQuestion} canAnswer={canVote} returnPath={getQueueHref(filter, activeIndex)} /> : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={getQueueHref(filter, previousIndex)}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:text-cyan-100"
            >
              Back
            </Link>
            <div className="flex flex-wrap gap-3">
              <Link
                href={getQueueHref(filter, nextIndex)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:text-cyan-100"
              >
                Skip
              </Link>
              <Link href={getQueueHref(filter, nextIndex)} className="dd-button-primary rounded-full px-5 py-3 text-sm font-semibold">
                Next
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState>No verified real-data questions available yet.</EmptyState>
      )}
    </section>
  );
}

export default async function VotingPage({ searchParams }: VotingPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const user = await getCurrentUser();
  const verified = canUserVote(user);
  const dashboard = await getCivicSignalsDashboard(user);
  const filter = normalizeFilter(params?.filter);
  const questions = dashboard.questions.filter((question) => matchesQuestionFilter(filter, question));
  const activeIndex = parseActiveIndex(params?.index, questions.length);

  return (
    <div className="relative mx-auto max-w-6xl space-y-8 overflow-hidden pb-10 pt-2 sm:pt-4">
      <div className="pointer-events-none absolute inset-x-[-12%] top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_45%),radial-gradient(circle_at_top_right,rgba(129,140,248,0.14),transparent_38%),radial-gradient(circle_at_top_left,rgba(52,211,153,0.16),transparent_36%)]" />
      {params?.voted === "success" ? (
        <section className="rounded-[1.75rem] border border-emerald-300/16 bg-emerald-500/10 p-5 text-sm text-emerald-100">
          Your vote was recorded.
        </section>
      ) : null}
      {params?.voteError ? (
        <section className="rounded-[1.75rem] border border-orange-300/16 bg-orange-500/10 p-5 text-sm text-orange-100">
          {params.voteError === "verification"
            ? "Voter verification is required before platform votes count toward civic outcomes."
            : "That vote could not be recorded. Please try again."}
        </section>
      ) : null}

      <section className="dd-panel relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(52,211,153,0.12),transparent_32%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#34d399,#22d3ee,#818cf8)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              Nevada real-data beta
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">Civic Signals & Voting</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Production voting now shows only source-attributed Nevada public records that are approved or verified. If a section has no reviewed
              records, it stays empty instead of falling back to invented people, issues, candidates, or officials.
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
            {getVerificationLabel(user.verificationState)}
          </span>
        </div>
        <div className={`relative mt-5 rounded-[1.5rem] border px-4 py-3 text-sm ${verified ? "border-white/10 bg-white/5 text-slate-300" : "border-orange-300/16 bg-orange-500/10 text-orange-100"}`}>
          {verified
            ? "You’re verified to vote. Results are stored as community sentiment, separate from source data."
            : "You can browse reviewed real-data questions now, but voting unlocks after voter verification is complete."}
        </div>
        <div className="relative mt-4 flex flex-wrap gap-3">
          <Link href="/actions" className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:text-cyan-100">
            Browse action cards
          </Link>
          <Link href="/who-represents-me" className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:text-cyan-100">
            Match my districts
          </Link>
          <Link href="/who-represents-me#district-summary" className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:text-cyan-100">
            Filter by matched districts
          </Link>
        </div>
      </section>

      <CivicQuestionsSection questions={questions} canVote={verified} filter={filter} activeIndex={activeIndex} />
    </div>
  );
}
