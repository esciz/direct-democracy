"use client";

import { useEffect, useState, useTransition } from "react";

import { CivicAvatar } from "@/components/domain/civic-avatar";
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
    "border-emerald-300/24 bg-[linear-gradient(135deg,rgba(6,95,70,0.42),rgba(5,46,22,0.58))] text-emerald-100 shadow-[0_18px_38px_-24px_rgba(16,185,129,0.55)] hover:border-emerald-300/40 hover:-translate-y-0.5 hover:shadow-[0_24px_42px_-24px_rgba(16,185,129,0.58)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40",
  no:
    "border-rose-300/20 bg-[linear-gradient(135deg,rgba(127,29,29,0.42),rgba(76,5,25,0.58))] text-rose-100 shadow-[0_18px_38px_-24px_rgba(244,63,94,0.42)] hover:border-rose-300/36 hover:-translate-y-0.5 hover:shadow-[0_24px_42px_-24px_rgba(244,63,94,0.48)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/35",
  skip:
    "border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.9),rgba(8,15,28,0.96))] text-slate-200 shadow-[0_16px_32px_-24px_rgba(2,8,23,0.7)] hover:border-white/18 hover:-translate-y-0.5 hover:bg-[rgba(15,23,42,0.92)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/30",
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

function getVoteAvatarType(question: VoteQuestionCardSummary) {
  if (question.referenceCaseId) {
    return "case";
  }

  if (question.objectType === "representative") {
    return "official";
  }

  if (question.objectType === "community") {
    return "community";
  }

  return "issue";
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
    <article className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(165deg,rgba(11,21,37,0.98),rgba(6,12,24,0.98))] p-6 shadow-[0_34px_72px_-40px_rgba(2,8,23,0.96)] backdrop-blur">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(52,211,153,0.12),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#34d399,#22d3ee,#818cf8)]" />
      <div className="relative flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-cyan-300/18 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
          {getVoteObjectLabel(currentQuestion)}
        </span>
        {currentQuestion.onboardingPosition && currentQuestion.onboardingTotal ? (
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
            Vote {currentQuestion.onboardingPosition} of {currentQuestion.onboardingTotal}
          </span>
        ) : null}
        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
          {voteTypeLabels[currentQuestion.voteType ?? "publicVote"]}
        </span>
        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
          {getStatusLabel(currentQuestion.status)}
        </span>
        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold text-slate-300">
          {currentQuestion.communityLabel ?? currentQuestion.jurisdictionName}
        </span>
        {currentQuestion.relatedIssueLabel ? (
          <span className="rounded-full border border-emerald-300/18 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
            {currentQuestion.relatedIssueLabel}
          </span>
        ) : null}
      </div>

      {currentQuestion.subjectName ? (
        <div className="relative mt-4 flex items-center gap-3">
          <CivicAvatar
            name={currentQuestion.subjectName}
            entityType={getVoteAvatarType(currentQuestion)}
            size="sm"
            verified={currentQuestion.objectType === "representative"}
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Currently voting on</p>
            <p className="mt-1 text-sm font-semibold text-slate-200">{currentQuestion.subjectName}</p>
          </div>
        </div>
      ) : null}
      {currentQuestion.shortTitle ? (
        <p className="relative mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{currentQuestion.shortTitle}</p>
      ) : null}
      <h2 className={`relative mt-4 font-semibold tracking-tight text-slate-50 ${compact ? "text-xl" : "text-[1.95rem] leading-tight"}`}>
        {currentQuestion.questionText}
      </h2>
      <p className="relative mt-3 text-sm font-medium text-emerald-200">{getVoteParticipationPrompt(currentQuestion)}</p>
      {contextPreview ? (
        <div className="relative mt-4 rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Why this matters</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{contextPreview}</p>
        </div>
      ) : null}

      {showResults && !isEditingVote ? (
        <div className="relative mt-5 space-y-3">
          {comparisonText ? <p className="text-sm text-slate-400">{comparisonText}</p> : null}
          <div className="rounded-[1.5rem] border border-emerald-300/16 bg-[linear-gradient(135deg,rgba(6,95,70,0.28),rgba(8,15,28,0.88))] p-4 text-sm text-slate-200">
            <span className="font-semibold text-emerald-200">Vote recorded:</span>{" "}
            {currentQuestion.userAnswer === "yes"
              ? responseLabels.yes
              : currentQuestion.userAnswer === "no"
                ? responseLabels.no
                : responseLabels.skip}
            {currentQuestion.voteUpdatedAt ? (
              <span className="text-slate-400"> · Updated {new Date(currentQuestion.voteUpdatedAt).toLocaleDateString()}</span>
            ) : null}
          </div>
          {(["yes", "no", "skip"] as const).map((answer) => (
            <div key={answer} className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center justify-between text-sm font-medium text-slate-300">
                <span>{answer === "yes" ? responseLabels.yes : answer === "no" ? responseLabels.no : responseLabels.skip}</span>
                <span>
                  {currentQuestion.results[answer]} votes · {currentQuestion.percentages[answer]}%
                </span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-white/8">
                <div className={`h-1.5 rounded-full ${resultBarStyles[answer]}`} style={{ width: `${currentQuestion.percentages[answer]}%` }} />
              </div>
            </div>
          ))}
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{currentQuestion.totalResponses} total responses</p>
          {isVotingClosed ? (
            <p className="text-sm text-slate-400">This voting period is closed.</p>
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
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/24 hover:text-emerald-100"
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
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                {autoAdvance ? "Next question" : "Continue"}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="relative mt-5 space-y-3">
          {isEditingVote ? (
            <div className="rounded-[1.5rem] border border-cyan-300/16 bg-cyan-500/10 p-4 text-sm text-cyan-100">
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
              className={`flex min-w-[12rem] flex-1 flex-col rounded-[1.35rem] border px-4 py-3.5 text-left text-sm font-semibold transition ${!canAnswer || isPending ? "cursor-not-allowed opacity-55" : ""} ${optionStyles.yes}`}
            >
              <span className="flex items-center justify-between gap-3">
                <span>{responseLabels.yes}</span>
                <span className="text-xs uppercase tracking-[0.16em] text-emerald-200/80">support</span>
              </span>
              <span className="mt-3 h-1.5 rounded-full bg-white/10">
                <span className="block h-1.5 w-[72%] rounded-full bg-emerald-300/70" />
              </span>
            </button>
            <button
              type="button"
              disabled={!canAnswer || isPending}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleVote("no");
              }}
              className={`flex min-w-[12rem] flex-1 flex-col rounded-[1.35rem] border px-4 py-3.5 text-left text-sm font-semibold transition ${!canAnswer || isPending ? "cursor-not-allowed opacity-55" : ""} ${optionStyles.no}`}
            >
              <span className="flex items-center justify-between gap-3">
                <span>{responseLabels.no}</span>
                <span className="text-xs uppercase tracking-[0.16em] text-rose-200/80">oppose</span>
              </span>
              <span className="mt-3 h-1.5 rounded-full bg-white/10">
                <span className="block h-1.5 w-[48%] rounded-full bg-rose-300/70" />
              </span>
            </button>
            <button
              type="button"
              disabled={!canAnswer || isPending}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleVote("skip");
              }}
              className={`flex min-w-[12rem] flex-1 flex-col rounded-[1.35rem] border px-4 py-3.5 text-left text-sm font-semibold transition ${!canAnswer || isPending ? "cursor-not-allowed opacity-55" : ""} ${optionStyles.skip}`}
            >
              <span className="flex items-center justify-between gap-3">
                <span>{responseLabels.skip}</span>
                <span className="text-xs uppercase tracking-[0.16em] text-slate-400">neutral</span>
              </span>
              <span className="mt-3 h-1.5 rounded-full bg-white/10">
                <span className="block h-1.5 w-[28%] rounded-full bg-slate-300/40" />
              </span>
            </button>
          </div>
          {!canAnswer ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
              Browse this question now. Voting unlocks after voter verification is complete.
            </div>
          ) : null}
          {isEditingVote ? (
            <div>
              <button
                type="button"
                onClick={() => setIsEditingVote(false)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/16"
              >
                Cancel
              </button>
            </div>
          ) : null}
        </div>
      )}

      <div className="relative mt-5 rounded-3xl border border-white/10 bg-white/[0.04]">
          <button
            type="button"
            onClick={() => setShowContext((value) => !value)}
            className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-sm font-semibold text-slate-200 transition hover:text-cyan-100"
          >
            <span>More context</span>
            <span className="text-xs uppercase tracking-[0.16em] text-slate-500">{showContext ? "Hide" : "View details"}</span>
          </button>
        {showContext ? (
          <div className="space-y-4 border-t border-white/10 px-4 pb-4 pt-4">
          {currentQuestion.plainLanguageSummary ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Full summary</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{currentQuestion.plainLanguageSummary}</p>
            </div>
          ) : null}

          {(currentQuestion.whyItMatters || currentQuestion.whoIsAffected) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {currentQuestion.whyItMatters ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Why it matters</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{currentQuestion.whyItMatters}</p>
                </div>
              ) : null}
              {currentQuestion.whoIsAffected ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Who it affects</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{currentQuestion.whoIsAffected}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {(currentQuestion.whatYesMeans || currentQuestion.whatNoMeans) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {currentQuestion.whatYesMeans ? (
                <div className="rounded-3xl border border-emerald-300/16 bg-emerald-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">If this passes</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-100">{currentQuestion.whatYesMeans}</p>
                </div>
              ) : null}
              {currentQuestion.whatNoMeans ? (
                <div className="rounded-3xl border border-rose-300/16 bg-rose-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-200">If this fails</p>
                  <p className="mt-2 text-sm leading-6 text-rose-100">{currentQuestion.whatNoMeans}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {(currentQuestion.introducedBy || currentQuestion.officialBody || currentQuestion.officialPositionSummary || currentQuestion.officialVoteSummary) ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-400">
                {currentQuestion.introducedBy ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                    Introduced by {currentQuestion.introducedBy}
                    {currentQuestion.introducedByRole ? ` · ${currentQuestion.introducedByRole}` : ""}
                  </span>
                ) : null}
                {currentQuestion.officialBody ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">{currentQuestion.officialBody}</span>
                ) : null}
              </div>

              {currentQuestion.officialPositionSummary || currentQuestion.officialVoteSummary ? (
                <div className="rounded-3xl border border-cyan-300/16 bg-cyan-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Official context</p>
                  <p className="mt-2 text-sm leading-6 text-cyan-100">
                    {currentQuestion.officialPositionSummary ?? currentQuestion.officialVoteSummary}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
          </div>
        ) : null}
      </div>

      {message ? <p className="mt-3 rounded-2xl border border-emerald-300/16 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-100">✓ {message}</p> : null}
      {error ? <p className="mt-3 text-sm text-orange-200">{error}</p> : null}
    </article>
  );
}
