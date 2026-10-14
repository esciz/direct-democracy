"use client";

import { useState, useTransition } from "react";

import { ActionLabel, MegaphoneIcon } from "@/components/ui/action-icons";
import { boostFeedPost } from "@/lib/feed/actions";

type FeedPostBoostButtonProps = {
  postId: string;
  initialCount: number;
  initiallyBoosted: boolean;
  guestMode?: boolean;
};

export function FeedPostBoostButton({
  postId,
  initialCount,
  initiallyBoosted,
  guestMode = false,
}: FeedPostBoostButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [count, setCount] = useState(initialCount);
  const [hasBoosted, setHasBoosted] = useState(initiallyBoosted);
  const [error, setError] = useState<string | null>(null);

  function handleBoost() {
    if (guestMode || isPending || hasBoosted) {
      return;
    }

    setError(null);
    setCount((current) => current + 1);
    setHasBoosted(true);

    startTransition(async () => {
      const result = await boostFeedPost(postId);

      if (!result.ok) {
        setCount(initialCount);
        setHasBoosted(initiallyBoosted);
        setError(result.message ?? "That boost could not be saved.");
        return;
      }

      setCount(result.boostCount ?? initialCount);
      setHasBoosted(result.viewerHasBoosted ?? initiallyBoosted);
    });
  }

  return (
    <div className="space-y-2">
      {guestMode ? (
        <span className="inline-flex min-h-10 items-center justify-center rounded-full border border-amber-200 bg-white px-3.5 py-2 text-sm font-semibold text-amber-700">
          <ActionLabel icon={<MegaphoneIcon className="h-4 w-4" />}>{`Boost ${count}`}</ActionLabel>
        </span>
      ) : (
        <button
          type="button"
          aria-pressed={hasBoosted}
          aria-label={hasBoosted ? `Boosted ${count}` : `Boost ${count}`}
          disabled={isPending || hasBoosted}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleBoost();
          }}
          className={
            hasBoosted
              ? "inline-flex min-h-10 items-center justify-center rounded-full bg-amber-500 px-3.5 py-2 text-sm font-semibold text-white"
              : "inline-flex min-h-10 items-center justify-center rounded-full border border-amber-200 bg-white px-3.5 py-2 text-sm font-semibold text-amber-700 transition hover:border-amber-400 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          }
        >
          <ActionLabel icon={<MegaphoneIcon className="h-4 w-4" />}>{hasBoosted ? `Boosted ${count}` : `Boost ${count}`}</ActionLabel>
        </button>
      )}
      {error ? <p className="text-xs text-orange-700">{error}</p> : null}
    </div>
  );
}
