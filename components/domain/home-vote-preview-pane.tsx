"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { VoteCard } from "@/components/domain/vote-card";
import type { VoteQuestionCardSummary } from "@/types/domain";

type HomeVotePreviewPaneProps = {
  questions: VoteQuestionCardSummary[];
  canVote: boolean;
};

function withQueueProgress(questions: VoteQuestionCardSummary[]) {
  return questions.map((question, index) => ({
    ...question,
    onboardingPosition: index + 1,
    onboardingTotal: questions.length,
  }));
}

export function HomeVotePreviewPane({ questions, canVote }: HomeVotePreviewPaneProps) {
  const [queuedQuestions, setQueuedQuestions] = useState(() => withQueueProgress(questions));
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(
    () => questions.find((question) => !question.userAnswer)?.id ?? questions[0]?.id ?? null,
  );

  useEffect(() => {
    const nextQuestions = withQueueProgress(questions);
    setQueuedQuestions(nextQuestions);
    setCurrentQuestionId(nextQuestions.find((question) => !question.userAnswer)?.id ?? nextQuestions[0]?.id ?? null);
  }, [questions]);

  const currentIndex = queuedQuestions.findIndex((question) => question.id === currentQuestionId);
  const currentQuestion = currentIndex >= 0 ? queuedQuestions[currentIndex] : null;
  const unansweredCount = useMemo(
    () => queuedQuestions.filter((question) => !question.userAnswer).length,
    [queuedQuestions],
  );
  const answeredCount = queuedQuestions.length - unansweredCount;
  const progressPercent = queuedQuestions.length ? Math.round((answeredCount / queuedQuestions.length) * 100) : 0;

  function moveToPreviousQuestion() {
    setCurrentQuestionId((currentId) => {
      if (currentIndex <= 0) {
        return currentId;
      }

      return queuedQuestions[currentIndex - 1]?.id ?? currentId;
    });
  }

  function moveToNextQuestion() {
    setCurrentQuestionId((currentId) => {
      if (currentIndex < 0) {
        return currentId;
      }

      const nextUnanswered = queuedQuestions.find((question, index) => index > currentIndex && !question.userAnswer);
      if (nextUnanswered) {
        return nextUnanswered.id;
      }

      return queuedQuestions[Math.min(currentIndex + 1, queuedQuestions.length - 1)]?.id ?? currentId;
    });
  }

  function handleVoteRecorded(updatedQuestion: VoteQuestionCardSummary) {
    const nextQuestions = withQueueProgress(
      queuedQuestions.map((question) => (question.id === updatedQuestion.id ? { ...updatedQuestion } : question)),
    );
    setQueuedQuestions(nextQuestions);
  }

  if (!queuedQuestions.length || !currentQuestion) {
    return (
      <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">
        No active votes are waiting right now.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">
            {currentQuestion.onboardingPosition && currentQuestion.onboardingTotal
              ? `Question ${currentQuestion.onboardingPosition} of ${currentQuestion.onboardingTotal}`
              : "Featured vote"}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
            {answeredCount} answered · {unansweredCount} waiting
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={moveToPreviousQuestion}
            disabled={currentIndex <= 0}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/20 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Back
          </button>
          <button
            type="button"
            onClick={moveToNextQuestion}
            disabled={currentIndex >= queuedQuestions.length - 1}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/20 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Skip
          </button>
          <Link
            href="/voting"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/20 hover:text-cyan-100"
          >
            View all
          </Link>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#34d399,#818cf8)] transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <VoteCard
        question={currentQuestion}
        compact
        returnPath="/"
        canAnswer={canVote}
        onVoteRecorded={handleVoteRecorded}
        onAdvance={moveToNextQuestion}
        autoAdvance
      />
    </div>
  );
}
