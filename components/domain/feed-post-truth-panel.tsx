"use client";

import { useState, type MouseEvent } from "react";

import type { PostSummary, TruthRatingValue } from "@/types/domain";

type FeedPostTruthPanelProps = {
  postId: string;
  truthEligible?: boolean;
  truthPreviewLabel?: PostSummary["truthPreviewLabel"];
  truthRatingCount?: number;
  truthDistribution?: PostSummary["truthDistribution"];
};

const TRUTH_TONE_BY_LABEL: Record<string, string> = {
  "Mostly Accurate": "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  Mixed: "bg-amber-50 text-amber-700 border-amber-200/80",
  Misleading: "bg-rose-50 text-rose-700 border-rose-200/80",
};

const DETAIL_LABELS: TruthRatingValue[] = ["Accurate", "Mostly True", "Mixed / Unclear", "Misleading", "False"];

function getTruthTone(label?: string | null) {
  if (!label) {
    return "bg-slate-50 text-slate-700 border-slate-200/80";
  }

  return TRUTH_TONE_BY_LABEL[label] ?? "bg-slate-50 text-slate-700 border-slate-200/80";
}

function getTruthSnippet(label?: string | null, ratingCount = 0) {
  if (!ratingCount) {
    return "No community truth ratings yet. Open the full post for deeper context and rating access.";
  }

  if (label === "Mostly Accurate") {
    return "Community truth ratings lean positive so far, but the full post still holds the deeper context and evidence.";
  }

  if (label === "Misleading") {
    return "Community truth ratings currently lean skeptical. Open the post detail page for the fuller truth discussion.";
  }

  return "Community truth ratings are mixed right now. Open the post detail page for fuller context and structured truth discussion.";
}

function getCompactSummary(label?: string | null, ratingCount = 0) {
  if (!label && !ratingCount) {
    return "Truth: Pending";
  }

  if (!label) {
    return `Truth: Pending · ${ratingCount} rating${ratingCount === 1 ? "" : "s"}`;
  }

  if (!ratingCount) {
    return `Truth: ${label}`;
  }

  return `Truth: ${label} · ${ratingCount} rating${ratingCount === 1 ? "" : "s"}`;
}

export function FeedPostTruthPanel({
  postId,
  truthEligible,
  truthPreviewLabel,
  truthRatingCount = 0,
  truthDistribution = [],
}: FeedPostTruthPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!truthEligible) {
    return null;
  }

  const summaryLabel = getCompactSummary(truthPreviewLabel, truthRatingCount);

  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsExpanded((current) => !current);
  };

  return (
    <section className={`rounded-xl border px-3 py-2 ${getTruthTone(truthPreviewLabel)}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold">{summaryLabel}</p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className="inline-flex rounded-full border border-current/20 bg-white/70 px-2.5 py-1 text-[11px] font-semibold transition hover:bg-white"
          aria-expanded={isExpanded}
          aria-controls={`feed-post-truth-${postId}`}
        >
          {isExpanded ? "Hide details" : "Details"}
        </button>
      </div>

      {isExpanded ? (
        <div id={`feed-post-truth-${postId}`} className="mt-3 space-y-2 border-t border-current/10 pt-2.5">
          <p className="text-xs leading-5 opacity-85">{getTruthSnippet(truthPreviewLabel, truthRatingCount)}</p>
          {truthDistribution.length ? (
            <div className="space-y-1.5">
              {DETAIL_LABELS.map((label) => {
                const entry = truthDistribution.find((item) => item.label === label);
                const percentage = entry?.percentage ?? 0;
                const count = entry?.count ?? 0;

                return (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-[11px] font-medium">
                      <span>{label}</span>
                      <span>
                        {count} · {percentage}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/80">
                      <div className="h-full rounded-full bg-current/70" style={{ width: `${Math.max(percentage, count > 0 ? 6 : 0)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs opacity-80">Detailed truth breakdown is not available yet for this post.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
