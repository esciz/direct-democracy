"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { voteOnPollFromFeed } from "@/lib/polls/actions";
import { getContentTypeTheme } from "@/lib/ui/content-type-theme";
import type { PollSummary } from "@/types/domain";

type FeedPollCardProps = {
  poll: PollSummary;
};

function formatFeedDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getRelativeFeedDate(value: string) {
  const diffMs = Date.parse(value) - Date.now();
  const absoluteMinutes = Math.max(1, Math.round(Math.abs(diffMs) / (1000 * 60)));

  if (absoluteMinutes < 60) {
    return diffMs > 0 ? `in ${absoluteMinutes}m` : `${absoluteMinutes}m ago`;
  }

  const absoluteHours = Math.round(absoluteMinutes / 60);
  if (absoluteHours < 24) {
    return diffMs > 0 ? `in ${absoluteHours}h` : `${absoluteHours}h ago`;
  }

  const absoluteDays = Math.round(absoluteHours / 24);
  return diffMs > 0 ? `in ${absoluteDays}d` : `${absoluteDays}d ago`;
}

function getPollScopeLabel(poll: PollSummary) {
  if (poll.scope === "local") return "Local Poll";
  if (poll.scope === "state") return "State Poll";
  return "National Poll";
}

export function FeedPollCard({ poll }: FeedPollCardProps) {
  const [isPending, startTransition] = useTransition();
  const [currentPoll, setCurrentPoll] = useState(poll);
  const [error, setError] = useState<string | null>(null);
  const pollTheme = getContentTypeTheme("Poll");

  const topResults = currentPoll.results.slice().sort((a, b) => b.voteCount - a.voteCount).slice(0, 3);
  const showResults = Boolean(currentPoll.viewerVote) || !currentPoll.canVote;

  function handleVote(option: string, event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (isPending || !currentPoll.canVote) {
      return;
    }

    const snapshot = currentPoll;
    setError(null);
    setCurrentPoll({
      ...currentPoll,
      viewerVote: option,
      canVote: false,
      totalVotes: currentPoll.totalVotes + 1,
      engagementCount: currentPoll.engagementCount + 1,
      results: currentPoll.options.map((entry) => {
        const currentResult = currentPoll.results.find((result) => result.option === entry);
        const voteCount = (currentResult?.voteCount ?? 0) + (entry === option ? 1 : 0);
        const totalVotes = currentPoll.totalVotes + 1;

        return {
          option: entry,
          voteCount,
          percentage: totalVotes ? Math.round((voteCount / totalVotes) * 100) : 0,
        };
      }),
    });

    startTransition(async () => {
      const result = await voteOnPollFromFeed(currentPoll.id, option);

      if (!result.ok || !result.poll) {
        setCurrentPoll(snapshot);
        setError(result.message ?? "That vote could not be saved.");
        return;
      }

      setCurrentPoll(result.poll);
    });
  }

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur">
      <Link href="/polls" className="block rounded-2xl transition hover:bg-slate-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-civic-400">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${pollTheme.badge}`}>Poll</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{formatFeedDate(currentPoll.createdAt)}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{currentPoll.jurisdictionName}</span>
        </div>
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
            <span className="font-semibold text-ink">{currentPoll.creatorName}</span>
            <span>{currentPoll.creatorRole}</span>
            <span>{getPollScopeLabel(currentPoll)}</span>
          </div>
          <h2 className="text-xl font-semibold text-ink">{currentPoll.question}</h2>
        </div>
      </Link>

      {showResults ? (
        <div className="mt-4 space-y-3 rounded-2xl bg-slate-50/80 p-4">
          {currentPoll.viewerVote ? (
            <p className="text-sm text-slate-600">
              You chose <span className="font-semibold text-ink">{currentPoll.viewerVote}</span>. Results update as more people respond.
            </p>
          ) : (
            <p className="text-sm text-slate-600">This poll is closed for you, so results are shown below.</p>
          )}
          <p className="text-sm text-slate-600">
            {currentPoll.totalVotes} vote{currentPoll.totalVotes === 1 ? "" : "s"} · {currentPoll.options.length} options
          </p>
          {currentPoll.totalVotes > 0 ? (
            <div className="space-y-2">
              {topResults.map((result) => (
                <div key={result.option} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
                    <span className={result.option === currentPoll.viewerVote ? "truncate text-civic-700" : "truncate"}>{result.option}</span>
                    <span>
                      {result.percentage}% · {result.voteCount}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-civic-500" style={{ width: `${Math.max(result.percentage, result.voteCount > 0 ? 6 : 0)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {currentPoll.options.map((option) => (
            <button
              key={option}
              type="button"
              disabled={isPending}
              onClick={(event) => handleVote(option, event)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span>{option}</span>
              <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Vote</span>
            </button>
          ))}
        </div>
      )}

      {error ? <p className="mt-3 text-xs text-orange-700">{error}</p> : null}

      <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
        <p className="text-sm text-slate-500">{showResults ? getRelativeFeedDate(currentPoll.createdAt) : "Vote here, then open the full poll for deeper context."}</p>
        <Link href="/polls" className="text-sm font-semibold text-civic-700 hover:text-civic-900">
          {showResults ? "View Poll" : "Open Poll"}
        </Link>
      </div>
    </section>
  );
}
