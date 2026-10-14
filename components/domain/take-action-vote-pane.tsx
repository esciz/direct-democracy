"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { formatUnknownError } from "@/lib/errors/format-error";
import type { VoteQuestionCardSummary } from "@/types/domain";

type VoteCardComponent = typeof import("@/components/domain/vote-card").VoteCard;

type TakeActionVotePaneProps = {
  question: VoteQuestionCardSummary;
  compact?: boolean;
  returnPath?: string;
};

function VotePaneFallback({
  title,
  detail,
}: {
  title: string;
  detail?: string | null;
}) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
      <p className="font-semibold text-ink">{title}</p>
      {detail ? <p className="mt-2">{detail}</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/voting"
          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Open full Vote page
        </Link>
        <Link
          href="/take-action"
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          Retry this pane
        </Link>
      </div>
    </div>
  );
}

export function TakeActionVotePane({
  question,
  compact = false,
  returnPath = "/take-action",
}: TakeActionVotePaneProps) {
  const [VoteCard, setVoteCard] = useState<VoteCardComponent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    import("@/components/domain/vote-card")
      .then((module) => {
        if (!cancelled) {
          setVoteCard(() => module.VoteCard);
          setError(null);
        }
      })
      .catch((caughtError: unknown) => {
        console.error("Take Action vote pane failed to load.", caughtError);

        if (!cancelled) {
          setError(
            formatUnknownError(
              caughtError,
              "The quick vote module could not be loaded right now.",
            ),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
        <VotePaneFallback
        title="Formal vote is temporarily unavailable."
        detail={error}
      />
    );
  }

  if (!VoteCard) {
    return (
      <VotePaneFallback
        title="Loading the next formal vote..."
        detail="The rest of Take Action is ready while the formal vote pane finishes loading."
      />
    );
  }

  return <VoteCard question={question} compact={compact} returnPath={returnPath} />;
}
