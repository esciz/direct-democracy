import Link from "next/link";

import { getCurrentUser } from "@/lib/server/auth-session";
import { getVotingLibrary } from "@/lib/feed/quick-votes";
import { getVoteObjectLabel, getVoteResponseLabels } from "@/lib/votes/presentation";

export default async function VotingHistoryPage() {
  const user = await getCurrentUser();
  const answeredQuestions = (await getVotingLibrary(user, { scope: "all", category: "all", objectType: "all" })).filter(
    (question) => Boolean(question.userAnswer),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10 pt-2 sm:pt-4">
      <section className="rounded-[1.9rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-civic-700">Voting history</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Your recorded votes</h1>
            <p className="mt-2 text-sm text-slate-600">
              Review previous votes by question, category, and jurisdiction without interrupting the active queue.
            </p>
          </div>
          <Link
            href="/voting"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-300 hover:text-civic-700"
          >
            Back to voting queue
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        {answeredQuestions.length ? (
          answeredQuestions.map((question) => {
            const responseLabels = getVoteResponseLabels(question);
            const answerLabel =
              question.userAnswer === "yes"
                ? responseLabels.yes
                : question.userAnswer === "no"
                  ? responseLabels.no
                  : responseLabels.skip;

            return (
              <article key={question.id} className="rounded-[1.6rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">{getVoteObjectLabel(question)}</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">{question.questionText}</h2>
                  </div>
                  <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">{answerLabel}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {question.communityLabel ?? question.jurisdictionName}
                  </span>
                  {question.relatedIssueLabel ? (
                    <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
                      {question.relatedIssueLabel}
                    </span>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            No votes recorded yet. Head back to the queue to cast your first vote.
          </div>
        )}
      </section>
    </div>
  );
}
