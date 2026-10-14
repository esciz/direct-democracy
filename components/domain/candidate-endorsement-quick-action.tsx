"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { useState, useTransition } from "react";

import {
  removeCandidateEndorsementInline,
  saveCandidateEndorsementInline,
} from "@/lib/candidates/endorsement-actions";

type CandidateEndorsementQuickActionProps = {
  candidateCampaignId: string;
  electionId: string;
  endorsementCount?: number;
  hasDirectEndorsement: boolean;
  hasOtherEndorsementInElection: boolean;
  canEndorse: boolean;
  compact?: boolean;
};

export function CandidateEndorsementQuickAction({
  candidateCampaignId,
  electionId,
  endorsementCount = 0,
  hasDirectEndorsement,
  hasOtherEndorsementInElection,
  canEndorse,
  compact = false,
}: CandidateEndorsementQuickActionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const primaryLabel = hasDirectEndorsement
    ? "Endorsed"
    : hasOtherEndorsementInElection
      ? "Switch endorsement"
      : "Endorse Candidate";

  const primaryClassName = hasDirectEndorsement
    ? "rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
    : "rounded-full border border-civic-200 bg-white px-3 py-2 text-xs font-semibold text-civic-700 transition hover:border-civic-500";

  function handleSave(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!canEndorse || isPending) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await saveCandidateEndorsementInline(candidateCampaignId);

      if (!result.ok) {
        setError(result.message ?? "That endorsement could not be saved.");
        return;
      }

      router.refresh();
    });
  }

  function handleRemove(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!canEndorse || isPending) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await removeCandidateEndorsementInline(electionId);

      if (!result.ok) {
        setError(result.message ?? "That endorsement could not be removed.");
        return;
      }

      router.refresh();
    });
  }

  if (!canEndorse) {
    return (
      <div className="space-y-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {endorsementCount} endorsement{endorsementCount === 1 ? "" : "s"}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "pt-1"}`}>
        <button type="button" disabled={isPending} onClick={handleSave} className={primaryClassName}>
          {primaryLabel}
        </button>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {endorsementCount} endorsement{endorsementCount === 1 ? "" : "s"}
        </span>
        {hasDirectEndorsement ? (
          <button
            type="button"
            disabled={isPending}
            onClick={handleRemove}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Remove
          </button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-orange-700">{error}</p> : null}
    </div>
  );
}
