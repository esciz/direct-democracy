import Link from "next/link";

import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { RoleBadge } from "@/components/domain/role-badge";
import { promotePollToPetition, promotePollToSystemVote, voteOnPoll } from "@/lib/polls/actions";
import type { PollSummary, UserRole } from "@/types/domain";

type PollCardProps = {
  poll: PollSummary;
  returnPath?: string;
  viewerRole?: UserRole;
};

export function PollCard({ poll, returnPath = "/my-community", viewerRole = "citizen" }: PollCardProps) {
  const showResults = Boolean(poll.viewerVote) || !poll.canVote;
  const canPromote = viewerRole === "trustedCitizen" && poll.promotionEligible && !poll.promotedPetitionId && !poll.promotedVoteQuestionId;

  return (
    <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
          Citizen poll
        </span>
        <RoleBadge role={poll.creatorRole} />
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{poll.jurisdictionName}</span>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-slate-500">
          By {poll.creatorName} · {poll.totalVotes} vote{poll.totalVotes === 1 ? "" : "s"}
        </p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-ink">{poll.question}</h3>
      </div>

      {showResults ? (
        <div className="mt-5 space-y-3">
          {poll.viewerVote ? (
            <p className="text-sm text-slate-600">
              You voted <span className="font-semibold text-ink">{poll.viewerVote}</span>. Results update as more people respond.
            </p>
          ) : (
            <p className="text-sm text-slate-600">This poll is closed for you, so results are shown below.</p>
          )}
          {poll.results.map((result) => (
            <div key={result.option} className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium text-slate-600">
                <span>{result.option}</span>
                <span>
                  {result.voteCount} votes · {result.percentage}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-civic-500" style={{ width: `${result.percentage}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <form action={voteOnPoll} className="mt-5 space-y-3">
          <input type="hidden" name="pollId" value={poll.id} />
          <input type="hidden" name="returnPath" value={returnPath} />
          {poll.options.map((option) => (
            <button
              key={option}
              type="submit"
              name="selectedOption"
              value={option}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            >
              <span>{option}</span>
              <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Vote</span>
            </button>
          ))}
        </form>
      )}

      {poll.promotionEligible && !poll.promotedPetitionId && !poll.promotedVoteQuestionId ? (
        <div className="mt-5 rounded-3xl border border-civic-200 bg-civic-50 p-4 text-sm text-civic-900">
          This poll is gaining traction with {poll.engagementCount} votes.
          {canPromote ? " What would you like to do?" : " A trusted citizen can now promote it into a petition or a formal vote."}
        </div>
      ) : null}

      {poll.promotedPetitionId ? (
        <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Promoted to petition.{" "}
          <Link href={`/petitions/${poll.promotedPetitionId}`} className="font-semibold underline">
            View petition
          </Link>
        </div>
      ) : null}

      {poll.promotedVoteQuestionId ? (
        <div className="mt-5 rounded-3xl border border-civic-200 bg-civic-50 p-4 text-sm text-civic-900">
          Promoted into a formal vote.
        </div>
      ) : null}

      {canPromote ? (
        <details className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-civic-700">
            This poll is gaining traction. What would you like to do?
          </summary>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <form action={promotePollToPetition} className="rounded-3xl bg-white p-4">
              <input type="hidden" name="pollId" value={poll.id} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <p className="text-sm font-semibold text-ink">Convert to Petition</p>
              <p className="mt-2 text-sm text-slate-600">Carry the poll into an action-oriented petition with an editable title and description.</p>
              <div className="mt-4 space-y-3">
                <input
                  name="title"
                  defaultValue={poll.question}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
                />
                <textarea
                  name="summary"
                  rows={3}
                  defaultValue={`Community members responded strongly to this poll: ${poll.question}`}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
                />
                <textarea
                  name="body"
                  rows={4}
                  defaultValue={`This petition grows out of a community poll that asked: "${poll.question}" The next step is to turn that sentiment into a concrete request for action in ${poll.jurisdictionName}.`}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
                />
                <input
                  name="issueTag"
                  placeholder="Issue tag (example: housing or education)"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
                />
                <label className="flex items-start gap-3 text-sm text-slate-600">
                  <input type="checkbox" name="confirmPromotion" value="yes" className="mt-1" />
                  <span>I understand this will create a separate petition and keep the original poll visible as its own item.</span>
                </label>
                <FormSubmitButton
                  idleLabel="Convert to Petition"
                  pendingLabel="Creating petition..."
                  className="rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                />
              </div>
            </form>

            <form action={promotePollToSystemVote} className="rounded-3xl bg-white p-4">
              <input type="hidden" name="pollId" value={poll.id} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <p className="text-sm font-semibold text-ink">Promote to Formal Vote</p>
              <p className="mt-2 text-sm text-slate-600">
                Turn this early-signal poll into a serious public decision object tied to a jurisdiction, issue, and trackable civic outcome.
              </p>
              <div className="mt-4 space-y-3">
                <input
                  name="questionText"
                  defaultValue={poll.question}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
                />
                <input type="hidden" name="category" value="civic" />
                <input
                  name="issueTag"
                  placeholder="Issue category (example: taxes or healthcare)"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
                />
                <input
                  name="plainLanguageSummary"
                  defaultValue={`This formal vote grows out of a community poll about ${poll.question.toLowerCase()}.`}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
                />
                <label className="flex items-start gap-3 text-sm text-slate-600">
                  <input type="checkbox" name="confirmPromotion" value="yes" className="mt-1" />
                  <span>I understand this will create a separate formal vote and keep the original poll visible as a user poll.</span>
                </label>
                <FormSubmitButton
                  idleLabel="Promote to Formal Vote"
                  pendingLabel="Creating formal vote..."
                  className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>
            </form>
          </div>
        </details>
      ) : null}
    </article>
  );
}
