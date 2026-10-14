"use client";

import { useState } from "react";

type RatingChallengeButtonProps = {
  targetType: "ad" | "claim";
  targetId: string;
};

const CHALLENGE_REASONS = [
  "Incorrect",
  "Missing context",
  "Outdated",
  "Source problem",
  "Misleading claim extraction",
  "New evidence",
  "Other",
];

export function RatingChallengeButton({ targetType, targetId }: RatingChallengeButtonProps) {
  const [submitted, setSubmitted] = useState(false);

  return (
    <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <summary className="cursor-pointer text-sm font-semibold text-cyan-200">
        Challenge {targetType === "ad" ? "ad rating" : "claim rating"}
      </summary>
      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
        }}
      >
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400" htmlFor={`challenge-reason-${targetId}`}>
          Reason
        </label>
        <select
          id={`challenge-reason-${targetId}`}
          name="reason"
          className="dd-input w-full rounded-2xl px-3 py-2 text-sm outline-none focus:border-cyan-300/40"
        >
          {CHALLENGE_REASONS.map((reason) => (
            <option key={reason}>{reason}</option>
          ))}
        </select>
        <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400" htmlFor={`challenge-explanation-${targetId}`}>
          Explanation
        </label>
        <textarea
          id={`challenge-explanation-${targetId}`}
          name="explanation"
          rows={3}
          className="dd-input w-full rounded-2xl px-3 py-2 text-sm outline-none focus:border-cyan-300/40"
          placeholder="Add context or evidence for reviewers."
        />
        <input
          name="evidenceUrl"
          type="url"
          className="dd-input w-full rounded-2xl px-3 py-2 text-sm outline-none focus:border-cyan-300/40"
          placeholder="Optional evidence URL"
        />
        <button type="submit" className="dd-button-secondary rounded-full px-4 py-2 text-sm font-semibold">
          Submit challenge
        </button>
        {submitted ? <p className="text-xs text-emerald-200">Challenge captured for this demo. Review workflow can be connected later.</p> : null}
      </form>
    </details>
  );
}
