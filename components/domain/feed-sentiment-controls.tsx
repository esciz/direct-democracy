"use client";

import { useState, useTransition } from "react";

import { ActionLabel, ThumbsDownIcon, ThumbsUpIcon } from "@/components/ui/action-icons";
import { reactToFeedPost } from "@/lib/feed/actions";

type FeedSentimentControlsProps = {
  postId: string;
  initialUp: number;
  initialDown: number;
  initialSelection?: "up" | "down" | null;
  canReact: boolean;
};

export function FeedSentimentControls({
  postId,
  initialUp,
  initialDown,
  initialSelection = null,
  canReact,
}: FeedSentimentControlsProps) {
  const [isPending, startTransition] = useTransition();
  const [selection, setSelection] = useState<"up" | "down" | null>(initialSelection);
  const [counts, setCounts] = useState({ up: initialUp, down: initialDown });
  const [error, setError] = useState<string | null>(null);

  function updateOptimistically(nextSelection: "up" | "down") {
    setCounts((current) => {
      const nextCounts = { ...current };

      if (selection === nextSelection) {
        nextCounts[nextSelection] = Math.max(0, nextCounts[nextSelection] - 1);
        return nextCounts;
      }

      if (selection) {
        nextCounts[selection] = Math.max(0, nextCounts[selection] - 1);
      }

      nextCounts[nextSelection] += 1;
      return nextCounts;
    });

    setSelection((current) => (current === nextSelection ? null : nextSelection));
  }

  function handleReact(nextSelection: "up" | "down") {
    if (!canReact || isPending) {
      return;
    }

    const snapshot = { counts, selection };
    setError(null);
    updateOptimistically(nextSelection);

    startTransition(async () => {
      const result = await reactToFeedPost(postId, nextSelection);

      if (!result.ok) {
        setCounts(snapshot.counts);
        setSelection(snapshot.selection);
        setError(result.message ?? "That reaction could not be saved.");
        return;
      }

      setCounts(result.counts ?? snapshot.counts);
      setSelection(result.viewerReaction ?? snapshot.selection);
    });
  }

  if (!canReact) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <ActionLabel icon={<ThumbsUpIcon className="h-3.5 w-3.5" />}>Support {counts.up}</ActionLabel>
          </span>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
            <ActionLabel icon={<ThumbsDownIcon className="h-3.5 w-3.5" />}>Oppose {counts.down}</ActionLabel>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={selection === "up"}
          aria-label={`Support ${counts.up}`}
          disabled={isPending}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleReact("up");
          }}
          className={
            selection === "up"
              ? "inline-flex min-h-10 items-center justify-center rounded-full bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white"
              : "inline-flex min-h-10 items-center justify-center rounded-full border border-emerald-200 bg-white px-3.5 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-400"
          }
        >
          <ActionLabel icon={<ThumbsUpIcon className="h-3.5 w-3.5" />}>Support {counts.up}</ActionLabel>
        </button>
        <button
          type="button"
          aria-pressed={selection === "down"}
          aria-label={`Oppose ${counts.down}`}
          disabled={isPending}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleReact("down");
          }}
          className={
            selection === "down"
              ? "inline-flex min-h-10 items-center justify-center rounded-full bg-slate-950 px-3.5 py-2 text-sm font-semibold text-white"
              : "inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
          }
        >
          <ActionLabel icon={<ThumbsDownIcon className="h-3.5 w-3.5" />}>Oppose {counts.down}</ActionLabel>
        </button>
      </div>
      {error ? <p className="text-xs text-orange-700">{error}</p> : null}
    </div>
  );
}
