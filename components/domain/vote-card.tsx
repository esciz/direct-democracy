"use client";

import { useEffect, useState, useTransition } from "react";

import { submitQuickVoteInline } from "@/lib/feed/vote-actions";
import { getResultComparisonText, getVoteObjectLabel, getVoteParticipationPrompt, getVoteResponseLabels } from "@/lib/votes/presentation";
import type { VoteQuestionCardSummary } from "@/types/domain";

type VoteCardProps = {
  question: VoteQuestionCardSummary;
  compact?: boolean;
  returnPath?: string;
  canAnswer?: boolean;
  onVoteRecorded?: (question: VoteQuestionCardSummary) => void;
  onAdvance?: () => void;
  autoAdvance?: boolean;
};

const optionStyles = {
  yes:
    "border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(209,250,229,0.92))] text-emerald-800 shadow-[0_14px_30px_-22px_rgba(5,150,105,0.72)] hover:border-emerald-300 hover:-translate-y-0.5 hover:shadow-[0_20px_36px_-22px_rgba(5,150,105,0.72)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300",
  no:
    "border-rose-200 bg-[linear-gradient(135deg,rgba(255,241,242,0.98),rgba(255,228,230,0.92))] text-rose-800 shadow-[0_14px_30px_-22px_rgba(225,29,72,0.48)] hover:border-rose-300 hover:-translate-y-0.5 hover:shadow-[0_20px_36px_-22px_rgba(225,29,72,0.56)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300",
  skip:
    "border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(241,245,249,0.94))] text-slate-700 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.35)] hover:border-slate-300 hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300",
} as const;

const resultBarStyles = {
  yes: "bg-emerald-500",
  no: "bg-rose-500",
  skip: "bg-slate-400",
} as const;

const voteTypeLabels = {
  representativeVote: "Weekly sentiment",
  legislation: "Legislation",
  ballotMeasure: "Ballot measure",
  agendaItem: "Agenda item",
  schoolBoardDecision: "School board decision",
  executiveAction: "Executive action",
  caseVote: "Case vote",
  publicVote: "Public vote",
  citizenElevatedVote: "Citizen-elevated vote",
} as const;

function getStatusLabel(status: VoteQuestionCardSummary["status"]) {
  if (!status) {
    return "Active";
  }

  return status.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}

export function VoteCard({
  question,
  compact = false,
  returnPath = "/my-community",
  canAnswer = true,
  onVoteRecorded,
  onAdvance,
  autoAdvance = false,
}: VoteCardProps) {
  const [currentQuestion, setCurrentQuestion] = useState(question);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [isEditingVote, setIsEditingVote] = useState(false);
  const [isPending, startTransition] = useTransition();
  const responseLabels = getVoteResponseLabels(currentQuestion);
  const comparisonText = getResultComparisonText(currentQuestion);
  const contextPreview =
    currentQuestion.whyItMatters ??
    currentQuestion.whoIsAffected ??
    currentQuestion.plainLanguageSummary ??
    currentQuestion.officialPositionSummary ??
    currentQuestion.officialVoteSummary ??
    null;

  useEffect(() => {
    setCurrentQuestion(question);
    setMessage(null);
    setError(null);
    setShowContext(false);
    setIsEditingVote(false);
  }, [question]);

  const showResults = Boolean(currentQuestion.userAnswer);
  const canShowChangeVote = Boolean(currentQuestion.userAnswer && currentQuestion.canChangeVote && currentQuestion.votingPeriodStatus === "open");
  const isVotingClosed = currentQuestion.votingPeriodStatus === "closed";

  function handleVote(answer: "yes" | "no" | "skip") {
    if (!canAnswer || isPending || (showResults && !isEditingVote)) {
      return;
    }

    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await submitQuickVoteInline({
        questionId: currentQuestion.id,
        answer,
      });

      if (!result.ok || !result.question) {
        setError(result.message ?? "That vote could not be recorded. Please try again.");
        return;
      }

      setCurrentQuestion(result.question);
      setMessage(result.message ?? "Vote recorded.");
      setIsEditingVote(false);
      onVoteRecorded?.(result.question);
    });
  }

  return (
    <article className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-[linear-gradient(160deg,rgba(255,255,255,0.97),rgba(247,250,252,0.92))] p-6 shadow-[0_28px_60px_-36px_rgba(15,23,42,0.58)] backdrop-blur">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.1),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#0ea5e9,#f59e0b,#10b981)]" />
      <div className="relative flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-civic-200/70 bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
          {getVoteObjectLabel(currentQuestion)}
        </span>
        {currentQuestion.onboardingPosition && currentQuestion.onboardingTotal ? (
          <span className="rounded-full border border-orange-200/70 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">
            Vote {currentQuestion.onboardingPosition} of {currentQuestion.onboardingTotal}
          </span>
        ) : null}
        <span className="rounded-full border border-slate-200/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
          {voteTypeLabels[currentQuestion.voteType ?? "publicVote"]}
        </span>
        <span className="rounded-full border border-slate-200/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
          {getStatusLabel(currentQuestion.status)}
        </span>
        <span className="rounded-full border border-slate-200/70 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700">
          {currentQuestion.communityLabel ?? currentQuestion.jurisdictionName}
        </span>
        {currentQuestion.relatedIssueLabel ? (
          <span className="rounded-full border border-civic-200/70 bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
            {currentQuestion.relatedIssueLabel}
          </span>
        ) : null}
      </div>

      {currentQuestion.shortTitle ? (
        <p className="relative mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{currentQuestion.shortTitle}</p>
      ) : null}
      <h2 className={`relative mt-4 font-semibold tracking-tight text-ink ${compact ? "text-xl" : "text-[1.95rem] leading-tight"}`}>
        {currentQuestion.questionText}
      </h2>
      <p className="relative mt-3 text-sm font-medium text-civic-700">{getVoteParticipationPrompt(currentQuestion)}</p>
      {contextPreview ? (
        <div className="relative mt-4 rounded-[1.5rem] border border-civic-100/80 bg-white/78 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Why this matters</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{contextPreview}</p>
        </div>
      ) : null}

      {showResults && !isEditingVote ? (
        <div className="relative mt-5 space-y-3">
          {comparisonText ? <p className="text-sm text-slate-600">{comparisonText}</p> : null}
          <div className="rounded-[1.5rem] border border-emerald-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.9),rgba(255,255,255,0.96))] p-4 text-sm text-slate-700">
            <span className="font-semibold text-emerald-800">Vote recorded:</span>{" "}
            {currentQuestion.userAnswer === "yes"
              ? responseLabels.yes
              : currentQuestion.userAnswer === "no"
                ? responseLabels.no
                : responseLabels.skip}
            {currentQuestion.voteUpdatedAt ? (
              <span className="text-slate-500"> · Updated {new Date(currentQuestion.voteUpdatedAt).toLocaleDateString()}</span>
            ) : null}
          </div>
          {(["yes", "no", "skip"] as const).map((answer) => (
            <div key={answer} className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium text-slate-600">
                <span>{answer === "yes" ? responseLabels.yes : answer === "no" ? responseLabels.no : responseLabels.skip}</span>
                <span>
                  {currentQuestion.results[answer]} votes · {currentQuestion.percentages[answer]}%
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100">
                <div className={`h-2.5 rounded-full ${resultBarStyles[answer]}`} style={{ width: `${currentQuestion.percentages[answer]}%` }} />
              </div>
            </div>
          ))}
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{currentQuestion.totalResponses} total responses</p>
          {isVotingClosed ? (
            <p className="text-sm text-slate-500">This voting period is closed.</p>
          ) : null}
          {canShowChangeVote ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  setError(null);
                  setIsEditingVote(true);
                }}
                className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-civic-300 hover:text-civic-700"
              >
                Change vote
              </button>
            </div>
          ) : null}
          {onAdvance ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={onAdvance}
                className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                {autoAdvance ? "Next question" : "Continue"}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="relative mt-5 space-y-3">
          {isEditingVote ? (
            <div className="rounded-[1.5rem] border border-civic-100 bg-civic-50 p-4 text-sm text-civic-900">
              Update your vote for this current voting period. Your earlier vote will be replaced, not duplicated.
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!canAnswer || isPending}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleVote("yes");
              }}
              className={`rounded-2xl border px-4 py-3.5 text-sm font-semibold transition ${!canAnswer || isPending ? "cursor-not-allowed opacity-55" : ""} ${optionStyles.yes}`}
            >
              {responseLabels.yes}
            </button>
            <button
              type="button"
              disabled={!canAnswer || isPending}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleVote("no");
              }}
              className={`rounded-2xl border px-4 py-3.5 text-sm font-semibold transition ${!canAnswer || isPending ? "cursor-not-allowed opacity-55" : ""} ${optionStyles.no}`}
            >
              {responseLabels.no}
            </button>
            <button
              type="button"
              disabled={!canAnswer || isPending}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleVote("skip");
              }}
              className={`rounded-2xl border px-4 py-3.5 text-sm font-semibold transition ${!canAnswer || isPending ? "cursor-not-allowed opacity-55" : ""} ${optionStyles.skip}`}
            >
              {responseLabels.skip}
            </button>
          </div>
          {!canAnswer ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              Browse this question now. Voting unlocks after voter verification is complete.
            </div>
          ) : null}
          {isEditingVote ? (
            <div>
              <button
                type="button"
                onClick={() => setIsEditingVote(false)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
              >
                Cancel
              </button>
            </div>
          ) : null}
        </div>
      )}

      <div className="relative mt-5 rounded-3xl border border-slate-200 bg-slate-50/80">
          <button
            type="button"
            onClick={() => setShowContext((value) => !value)}
            className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-sm font-semibold text-slate-700 transition hover:text-civic-700"
          >
            <span>More context</span>
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">{showContext ? "Hide" : "View details"}</span>
          </button>
        {showContext ? (
          <div className="space-y-4 border-t border-slate-200 px-4 pb-4 pt-4">
          {currentQuestion.plainLanguageSummary ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Full summary</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{currentQuestion.plainLanguageSummary}</p>
            </div>
          ) : null}

          {(currentQuestion.whyItMatters || currentQuestion.whoIsAffected) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {currentQuestion.whyItMatters ? (
                <div className="rounded-3xl bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Why it matters</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{currentQuestion.whyItMatters}</p>
                </div>
              ) : null}
              {currentQuestion.whoIsAffected ? (
                <div className="rounded-3xl bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Who it affects</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{currentQuestion.whoIsAffected}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {(currentQuestion.whatYesMeans || currentQuestion.whatNoMeans) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {currentQuestion.whatYesMeans ? (
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">If this passes</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-900">{currentQuestion.whatYesMeans}</p>
                </div>
              ) : null}
              {currentQuestion.whatNoMeans ? (
                <div className="rounded-3xl border border-rose-100 bg-rose-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">If this fails</p>
                  <p className="mt-2 text-sm leading-6 text-rose-900">{currentQuestion.whatNoMeans}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {(currentQuestion.introducedBy || currentQuestion.officialBody || currentQuestion.officialPositionSummary || currentQuestion.officialVoteSummary) ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-600">
                {currentQuestion.introducedBy ? (
                  <span className="rounded-full bg-white px-3 py-2">
                    Introduced by {currentQuestion.introducedBy}
                    {currentQuestion.introducedByRole ? ` · ${currentQuestion.introducedByRole}` : ""}
                  </span>
                ) : null}
                {currentQuestion.officialBody ? (
                  <span className="rounded-full bg-white px-3 py-2">{currentQuestion.officialBody}</span>
                ) : null}
              </div>

              {currentQuestion.officialPositionSummary || currentQuestion.officialVoteSummary ? (
                <div className="rounded-3xl border border-civic-100 bg-civic-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Official context</p>
                  <p className="mt-2 text-sm leading-6 text-civic-900">
                    {currentQuestion.officialPositionSummary ?? currentQuestion.officialVoteSummary}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
          </div>
        ) : null}
      </div>

      {message ? <p className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm font-medium text-emerald-800">✓ {message}</p> : null}
      {error ? <p className="mt-3 text-sm text-orange-700">{error}</p> : null}
    </article>
  );
}
