"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { VoteCard } from "@/components/domain/vote-card";
import { voteOnPollInline } from "@/lib/polls/actions";
import type { PollSummary, VoteQuestionCardSummary } from "@/types/domain";

type QueuedPollSummary = PollSummary & {
  onboardingPosition?: number;
  onboardingTotal?: number;
};

type VotingPageSectionsProps = {
  initialQuestions: VoteQuestionCardSummary[];
  citizenPolls: PollSummary[];
  canVote: boolean;
  returnPath: string;
  activeFilter: "all" | "people" | "issues" | "cases";
};

function withQueueProgress(questions: VoteQuestionCardSummary[]) {
  return questions.map((question, index) => ({
    ...question,
    onboardingPosition: index + 1,
    onboardingTotal: questions.length,
  }));
}

function withPollQueueProgress(polls: PollSummary[]): QueuedPollSummary[] {
  return polls.map((poll, index) => ({
    ...poll,
    onboardingPosition: index + 1,
    onboardingTotal: polls.length,
  }));
}

function getCitizenPollContextLabels(poll: PollSummary) {
  return (poll.attachments ?? [])
    .filter((attachment) => attachment.type !== "community")
    .slice(0, 3)
    .map((attachment) => attachment.label);
}

function formatVoteLabel(poll: PollSummary, option: string) {
  return option;
}

export function VotingPageSections({ initialQuestions, citizenPolls, canVote, returnPath, activeFilter }: VotingPageSectionsProps) {
  const [questions, setQuestions] = useState(() => withQueueProgress(initialQuestions));
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(() => initialQuestions.find((question) => !question.userAnswer)?.id ?? initialQuestions[0]?.id ?? null);
  const [polls, setPolls] = useState<QueuedPollSummary[]>(() => withPollQueueProgress(citizenPolls));
  const [currentPollId, setCurrentPollId] = useState<string | null>(() => citizenPolls.find((poll) => !poll.viewerVote)?.id ?? citizenPolls[0]?.id ?? null);
  const [pollMessage, setPollMessage] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [showPollContext, setShowPollContext] = useState(false);
  const [isEditingPollVote, setIsEditingPollVote] = useState(false);
  const [isPollPending, startPollTransition] = useTransition();
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const nextQuestions = withQueueProgress(initialQuestions);
    setQuestions(nextQuestions);
    setCurrentQuestionId(nextQuestions.find((question) => !question.userAnswer)?.id ?? nextQuestions[0]?.id ?? null);
  }, [initialQuestions]);

  useEffect(() => {
    const nextPolls = withPollQueueProgress(citizenPolls);
    setPolls(nextPolls);
    setCurrentPollId(nextPolls.find((poll) => !poll.viewerVote)?.id ?? nextPolls[0]?.id ?? null);
    setPollMessage(null);
    setPollError(null);
    setShowPollContext(false);
    setIsEditingPollVote(false);
  }, [citizenPolls]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
      }
      if (pollAdvanceTimerRef.current) {
        clearTimeout(pollAdvanceTimerRef.current);
      }
    };
  }, []);

  const currentIndex = questions.findIndex((question) => question.id === currentQuestionId);
  const currentQuestion = currentIndex >= 0 ? questions[currentIndex] : null;
  const unansweredQuestions = useMemo(() => questions.filter((question) => !question.userAnswer), [questions]);
  const currentPollIndex = polls.findIndex((poll) => poll.id === currentPollId);
  const currentPoll = currentPollIndex >= 0 ? polls[currentPollIndex] : null;
  const unansweredPolls = useMemo(() => polls.filter((poll) => !poll.viewerVote), [polls]);
  const progressLabel = currentQuestion?.onboardingPosition && currentQuestion?.onboardingTotal
    ? `Question ${currentQuestion.onboardingPosition} of ${currentQuestion.onboardingTotal}`
    : questions.length
      ? `Question 1 of ${questions.length}`
      : "No active questions";
  const pollProgressLabel = currentPoll?.onboardingPosition && currentPoll?.onboardingTotal
    ? `Poll ${currentPoll.onboardingPosition} of ${currentPoll.onboardingTotal}`
    : polls.length
      ? `Poll 1 of ${polls.length}`
      : "No active citizen polls";
  const answeredCount = questions.length - unansweredQuestions.length;
  const progressPercent = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
  const pollAnsweredCount = polls.length - unansweredPolls.length;
  const pollProgressPercent = polls.length ? Math.round((pollAnsweredCount / polls.length) * 100) : 0;
  const progressMessage =
    unansweredQuestions.length === 0
      ? "You’re caught up for now."
      : unansweredQuestions.length <= 3
        ? "Almost done."
        : answeredCount
          ? "Keep your weekly civic pulse current."
          : "Start with the question that matters most right now.";
  const pollProgressMessage =
    unansweredPolls.length === 0
      ? "You’ve answered the current citizen polls."
      : unansweredPolls.length <= 1
        ? "One more community pulse check."
        : "A lighter civic pulse from trusted local voices.";
  const currentPollContextPreview = currentPoll
    ? getCitizenPollContextLabels(currentPoll).join(" · ") ||
      (currentPoll.attachments ?? [])
        .slice(0, 3)
        .map((attachment) => attachment.label)
        .join(" · ")
    : "";

  function moveToNextQuestion(fromQuestionId: string) {
    setCurrentQuestionId((currentId) => {
      const sourceIndex = questions.findIndex((question) => question.id === fromQuestionId);
      if (sourceIndex < 0) {
        return currentId;
      }

      const nextUnanswered = questions.find((question, index) => index > sourceIndex && !question.userAnswer);
      if (nextUnanswered) {
        return nextUnanswered.id;
      }

      const fallbackUnanswered = questions.find((question) => !question.userAnswer && question.id !== fromQuestionId);
      if (fallbackUnanswered) {
        return fallbackUnanswered.id;
      }

      return fromQuestionId;
    });
  }

  function moveToPreviousQuestion(fromQuestionId: string) {
    setCurrentQuestionId((currentId) => {
      const sourceIndex = questions.findIndex((question) => question.id === fromQuestionId);
      if (sourceIndex <= 0) {
        return currentId;
      }

      return questions[sourceIndex - 1]?.id ?? currentId;
    });
  }

  function handleVoteRecorded(updatedQuestion: VoteQuestionCardSummary) {
    setQuestions((current) => withQueueProgress(current.map((question) => (question.id === updatedQuestion.id ? { ...updatedQuestion } : question))));

    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
    }

    advanceTimerRef.current = setTimeout(() => {
      moveToNextQuestion(updatedQuestion.id);
    }, 1200);
  }

  function moveToNextPoll(fromPollId: string) {
    setCurrentPollId((currentId) => {
      const sourceIndex = polls.findIndex((poll) => poll.id === fromPollId);
      if (sourceIndex < 0) {
        return currentId;
      }

      const nextUnanswered = polls.find((poll, index) => index > sourceIndex && !poll.viewerVote);
      if (nextUnanswered) {
        return nextUnanswered.id;
      }

      const fallbackUnanswered = polls.find((poll) => !poll.viewerVote && poll.id !== fromPollId);
      if (fallbackUnanswered) {
        return fallbackUnanswered.id;
      }

      return fromPollId;
    });
  }

  function moveToPreviousPoll(fromPollId: string) {
    setCurrentPollId((currentId) => {
      const sourceIndex = polls.findIndex((poll) => poll.id === fromPollId);
      if (sourceIndex <= 0) {
        return currentId;
      }

      return polls[sourceIndex - 1]?.id ?? currentId;
    });
  }

  function handleCitizenPollVote(selectedOption: string) {
    if (!currentPoll || isPollPending || (!canVote && !currentPoll.canChangeVote)) {
      return;
    }

    if (currentPoll.viewerVote && !isEditingPollVote) {
      return;
    }

    setPollError(null);
    setPollMessage(null);

    startPollTransition(async () => {
      const result = await voteOnPollInline(currentPoll.id, selectedOption);

      if (!result.ok || !result.poll) {
        setPollError(result.message ?? "That citizen poll vote could not be recorded.");
        return;
      }

      const nextPolls = withPollQueueProgress(
        polls.map((poll) => (poll.id === result.poll.id ? { ...result.poll } : poll)),
      );
      setPolls(nextPolls);
      setPollMessage(result.message ?? "Citizen poll vote recorded.");
      setIsEditingPollVote(false);

      if (pollAdvanceTimerRef.current) {
        clearTimeout(pollAdvanceTimerRef.current);
      }

      pollAdvanceTimerRef.current = setTimeout(() => {
        moveToNextPoll(result.poll.id);
      }, 1200);
    });
  }

  const filterLabel = activeFilter === "all" ? "All voting questions" : activeFilter[0].toUpperCase() + activeFilter.slice(1);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-[linear-gradient(155deg,rgba(255,255,255,0.97),rgba(247,250,252,0.93))] p-6 shadow-[0_28px_65px_-38px_rgba(15,23,42,0.65)] backdrop-blur sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.08),transparent_34%)]" />
        <div className="mx-auto max-w-2xl">
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-civic-200/70 bg-civic-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
                <span>{filterLabel}</span>
              </div>
              <h2 className="mt-3 text-[2rem] font-semibold tracking-tight text-ink">{progressLabel}</h2>
              <p className="mt-2 text-sm text-slate-600">{progressMessage}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/80 bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.5)]">
                {answeredCount} answered
              </span>
              <span className="rounded-full border border-civic-200/70 bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
                {unansweredQuestions.length} remaining
              </span>
            </div>
          </div>

          <div className="relative mt-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <span>{answeredCount} of {questions.length || 0} answered</span>
              <span>{progressPercent}% complete</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100">
              <div
                className="h-2.5 rounded-full bg-[linear-gradient(90deg,#0ea5e9,#10b981)] transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-6">
            {currentQuestion ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-white/80 bg-white/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => moveToPreviousQuestion(currentQuestion.id)}
                      disabled={currentIndex <= 0}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-civic-300 hover:text-civic-700 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => moveToNextQuestion(currentQuestion.id)}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-civic-300 hover:text-civic-700"
                    >
                      Skip
                    </button>
                  </div>
                  <Link
                    href={`/voting/all?filter=${activeFilter}`}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-civic-300 hover:text-civic-700"
                  >
                    View all
                  </Link>
                </div>

                <VoteCard
                  key={currentQuestion.id}
                  question={currentQuestion}
                  returnPath={returnPath}
                  canAnswer={canVote}
                  onVoteRecorded={handleVoteRecorded}
                  onAdvance={() => moveToNextQuestion(currentQuestion.id)}
                  autoAdvance={Boolean(canVote)}
                />
              </div>
            ) : (
              <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                No active voting questions are available for this filter yet.
              </div>
            )}
          </div>
        </div>
      </section>

      {polls.length ? (
        <section className="relative overflow-hidden rounded-[1.9rem] border border-white/70 bg-[linear-gradient(155deg,rgba(255,255,255,0.92),rgba(248,250,252,0.84))] p-6 shadow-[0_24px_54px_-40px_rgba(15,23,42,0.52)] backdrop-blur sm:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.08),transparent_30%)]" />
          <div className="mx-auto max-w-2xl">
            <div className="relative flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Secondary layer</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Citizen Polls</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Polls created by eligible citizens and trusted voices, tied to your communities, issues, elections, cases, or petitions.
                </p>
                <p className="mt-2 text-sm text-slate-600">{pollProgressLabel} · {pollProgressMessage}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/80 bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700">
                  {pollAnsweredCount} answered
                </span>
                <span className="rounded-full border border-orange-200/70 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                  {unansweredPolls.length} remaining
                </span>
              </div>
            </div>

            <div className="relative mt-5 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span>{pollAnsweredCount} of {polls.length} answered</span>
                <span>{pollProgressPercent}% complete</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100">
                <div
                  className="h-2.5 rounded-full bg-[linear-gradient(90deg,#fb923c,#f59e0b)] transition-all"
                  style={{ width: `${pollProgressPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-6">
              {currentPoll ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-white/80 bg-white/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => moveToPreviousPoll(currentPoll.id)}
                        disabled={currentPollIndex <= 0}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => moveToNextPoll(currentPoll.id)}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-700"
                      >
                        Skip
                      </button>
                    </div>
                    <Link
                      href="/polls"
                      className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-700"
                      >
                      View all
                    </Link>
                  </div>

                  <article className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-[linear-gradient(160deg,rgba(255,255,255,0.97),rgba(250,250,249,0.92))] p-6 shadow-[0_28px_60px_-36px_rgba(15,23,42,0.5)] backdrop-blur">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.16),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.08),transparent_30%)]" />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#fb923c,#f59e0b,#f97316)]" />
                    <div className="relative flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-orange-200/70 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">
                        Citizen Poll
                      </span>
                      {currentPoll.onboardingPosition && currentPoll.onboardingTotal ? (
                        <span className="rounded-full border border-orange-200/70 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">
                          Poll {currentPoll.onboardingPosition} of {currentPoll.onboardingTotal}
                        </span>
                      ) : null}
                      <span className="rounded-full border border-slate-200/70 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700">
                        {currentPoll.jurisdictionName}
                      </span>
                      {getCitizenPollContextLabels(currentPoll).map((label) => (
                        <span key={`${currentPoll.id}-${label}`} className="rounded-full border border-orange-200/70 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                          {label}
                        </span>
                      ))}
                    </div>

                    <h4 className="relative mt-4 text-2xl font-semibold tracking-tight text-ink">{currentPoll.question}</h4>
                    <p className="relative mt-3 text-sm font-medium text-orange-700">
                      By {currentPoll.creatorName}. Citizen polls stay contextual and secondary to formal public votes.
                    </p>
                    {currentPollContextPreview ? (
                      <div className="relative mt-4 rounded-[1.5rem] border border-orange-100/90 bg-white/78 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">Context</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{currentPollContextPreview}</p>
                      </div>
                    ) : null}

                    {currentPoll.viewerVote && !isEditingPollVote ? (
                      <div className="relative mt-5 space-y-3">
                        <div className="rounded-[1.5rem] border border-orange-100 bg-[linear-gradient(135deg,rgba(255,247,237,0.95),rgba(255,255,255,0.98))] p-4 text-sm text-slate-700">
                          <span className="font-semibold text-orange-800">Answer recorded:</span> {formatVoteLabel(currentPoll, currentPoll.viewerVote)}
                          {currentPoll.viewerVoteCreatedAt ? (
                            <span className="text-slate-500"> · Updated {new Date(currentPoll.viewerVoteCreatedAt).toLocaleDateString()}</span>
                          ) : null}
                        </div>
                        {currentPoll.results.map((result) => (
                          <div key={result.option} className="space-y-2">
                            <div className="flex items-center justify-between text-sm font-medium text-slate-600">
                              <span>{formatVoteLabel(currentPoll, result.option)}</span>
                              <span>
                                {result.voteCount} votes · {result.percentage}%
                              </span>
                            </div>
                            <div className="h-2.5 rounded-full bg-slate-100">
                              <div className="h-2.5 rounded-full bg-orange-500" style={{ width: `${result.percentage}%` }} />
                            </div>
                          </div>
                        ))}
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{currentPoll.totalVotes} total responses</p>
                        {currentPoll.votingPeriodStatus === "closed" ? (
                          <p className="text-sm text-slate-500">This citizen poll is closed.</p>
                        ) : null}
                        {currentPoll.canChangeVote ? (
                          <div className="pt-1">
                            <button
                              type="button"
                            onClick={() => {
                              setPollMessage(null);
                              setPollError(null);
                              setIsEditingPollVote(true);
                            }}
                              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-700"
                            >
                              Change vote
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="relative mt-5 space-y-3">
                        {isEditingPollVote ? (
                          <div className="rounded-[1.5rem] border border-orange-100 bg-orange-50 p-4 text-sm text-orange-900">
                            Update your answer while this citizen poll is still open. Your previous answer will be replaced, not duplicated.
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-3">
                          {currentPoll.options.map((option) => (
                            <button
                              key={option}
                              type="button"
                              disabled={(!canVote && !currentPoll.canChangeVote) || isPollPending}
                              onClick={() => handleCitizenPollVote(option)}
                              className={`rounded-2xl border px-4 py-3.5 text-sm font-semibold shadow-[0_14px_30px_-24px_rgba(15,23,42,0.35)] transition ${
                                (!canVote && !currentPoll.canChangeVote) || isPollPending
                                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 opacity-55"
                                  : "border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-700 hover:shadow-[0_18px_34px_-24px_rgba(251,146,60,0.45)]"
                              }`}
                            >
                              {formatVoteLabel(currentPoll, option)}
                            </button>
                          ))}
                        </div>
                        {!canVote && !currentPoll.canChangeVote ? (
                          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                            Browse this citizen poll now. Answering unlocks after voter verification is complete.
                          </div>
                        ) : null}
                        {isEditingPollVote ? (
                          <div>
                            <button
                              type="button"
                              onClick={() => setIsEditingPollVote(false)}
                              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
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
                        onClick={() => setShowPollContext((value) => !value)}
                        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-sm font-semibold text-slate-700 transition hover:text-orange-700"
                      >
                        <span>More context</span>
                        <span className="text-xs uppercase tracking-[0.16em] text-slate-400">{showPollContext ? "Hide" : "View details"}</span>
                      </button>
                      {showPollContext ? (
                        <div className="space-y-4 border-t border-slate-200 px-4 pb-4 pt-4">
                          <div className="rounded-3xl bg-white px-4 py-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Appears under</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(currentPoll.attachments ?? []).map((attachment) => (
                                <span key={`${currentPoll.id}-${attachment.type}-${attachment.id}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                  {attachment.label}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-3xl bg-white px-4 py-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Created by</p>
                              <p className="mt-2 text-sm leading-6 text-slate-700">{currentPoll.creatorName}</p>
                            </div>
                            <div className="rounded-3xl bg-white px-4 py-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Voting period</p>
                              <p className="mt-2 text-sm leading-6 text-slate-700">
                                {currentPoll.expiresAt
                                  ? `Open until ${new Date(currentPoll.expiresAt).toLocaleDateString()}`
                                  : "Open-ended until the creator closes it"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {pollMessage ? <p className="mt-3 rounded-2xl border border-orange-100 bg-orange-50/80 px-4 py-3 text-sm font-medium text-orange-800">✓ {pollMessage}</p> : null}
                    {pollError ? <p className="mt-3 text-sm text-orange-700">{pollError}</p> : null}
                  </article>
                </div>
              ) : (
                <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                  No active citizen polls are available right now.
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
