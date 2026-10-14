"use client";

import { useState, useTransition } from "react";

import { ActionLabel, ThumbsUpIcon } from "@/components/ui/action-icons";
import { supportPetitionFromFeed } from "@/lib/petitions/actions";

type FeedPetitionSupportButtonProps = {
  petitionId: string;
  initialCount: number;
  initiallySupported: boolean;
  canSupport: boolean;
  guestMode?: boolean;
};

export function FeedPetitionSupportButton({
  petitionId,
  initialCount,
  initiallySupported,
  canSupport,
  guestMode = false,
}: FeedPetitionSupportButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [count, setCount] = useState(initialCount);
  const [hasSupported, setHasSupported] = useState(initiallySupported);
  const [error, setError] = useState<string | null>(null);

  function handleSupport() {
    if (guestMode || isPending || hasSupported || !canSupport) {
      return;
    }

    setError(null);
    setCount((current) => current + 1);
    setHasSupported(true);

    startTransition(async () => {
      const result = await supportPetitionFromFeed(petitionId);

      if (!result.ok) {
        setCount(initialCount);
        setHasSupported(initiallySupported);
        setError(result.message ?? "That support action could not be saved.");
        return;
      }

      setCount(result.signatureCount ?? initialCount);
      setHasSupported(result.hasSigned ?? initiallySupported);
    });
  }

  return (
    <div className="space-y-2">
      {guestMode ? (
        <span className="inline-flex min-h-10 items-center justify-center rounded-full border border-emerald-200 bg-white px-3.5 py-2 text-sm font-semibold text-emerald-700">
          <ActionLabel icon={<ThumbsUpIcon className="h-3.5 w-3.5" />}>{`Support ${count}`}</ActionLabel>
        </span>
      ) : (
        <button
          type="button"
          aria-pressed={hasSupported}
          aria-label={hasSupported ? `Supported ${count}` : `Support ${count}`}
          disabled={isPending || hasSupported || !canSupport}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleSupport();
          }}
          className={
            hasSupported
              ? "inline-flex min-h-10 items-center justify-center rounded-full bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white"
              : "inline-flex min-h-10 items-center justify-center rounded-full border border-emerald-200 bg-white px-3.5 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          }
        >
          <ActionLabel icon={<ThumbsUpIcon className="h-3.5 w-3.5" />}>{hasSupported ? `Supported ${count}` : `Support ${count}`}</ActionLabel>
        </button>
      )}
      {error ? <p className="text-xs text-orange-700">{error}</p> : null}
    </div>
  );
}
