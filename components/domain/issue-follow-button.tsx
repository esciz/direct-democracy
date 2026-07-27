"use client";

import { useRef, useState, useTransition } from "react";

import { setIssueFollowAction } from "@/lib/favorites/actions";
import type { IssueFollowStance } from "@/lib/favorites/types";

type IssueFollowButtonProps = {
  targetId: string;
  initialStance: IssueFollowStance | null;
};

const STANCE_OPTIONS: Array<{
  value: IssueFollowStance;
  label: string;
  detail: string;
  activeClassName: string;
}> = [
  {
    value: "tracking",
    label: "Just tracking",
    detail: "Keep up without taking a position.",
    activeClassName: "border-cyan-200 bg-cyan-50 text-cyan-900",
  },
  {
    value: "support",
    label: "Support",
    detail: "I want progress on this issue.",
    activeClassName: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  {
    value: "concerned",
    label: "Concerned",
    detail: "I have concerns and want to watch closely.",
    activeClassName: "border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    value: "oppose",
    label: "Oppose",
    detail: "I want to track and push back on this issue.",
    activeClassName: "border-rose-200 bg-rose-50 text-rose-900",
  },
];

function FollowIcon({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4.5 w-4.5"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.5 4.5h11v15L12 16l-5.5 3.5v-15Z" />
    </svg>
  );
}

export function IssueFollowButton({ targetId, initialStance }: IssueFollowButtonProps) {
  const [stance, setStance] = useState<IssueFollowStance | null>(initialStance);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const activeOption = STANCE_OPTIONS.find((option) => option.value === stance);
  const summaryLabel = isPending
    ? "Saving..."
    : stance
      ? `Following · ${activeOption?.label ?? "Just tracking"}`
      : "Follow issue";

  function saveStance(nextStance: IssueFollowStance | null) {
    setError(null);

    startTransition(async () => {
      const result = await setIssueFollowAction({ targetId, stance: nextStance });

      if (!result.ok) {
        setError(result.message ?? "Issue follow setting could not be saved.");
        return;
      }

      setStance(result.stance);
      if (detailsRef.current) detailsRef.current.open = false;
    });
  }

  return (
    <div className="relative">
      <details ref={detailsRef} className="group">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700">
          <FollowIcon active={Boolean(stance)} />
          {summaryLabel}
        </summary>
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-40 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl sm:left-auto sm:right-0">
          <div className="px-2 pb-2 pt-1">
            <p className="text-sm font-semibold">How are you following?</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Your stance helps organize your list. Following never implies support.</p>
          </div>
          <div className="grid gap-1.5">
            {STANCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={stance === option.value}
                disabled={isPending}
                onClick={() => saveStance(option.value)}
                className={`rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-wait disabled:opacity-60 ${
                  stance === option.value
                    ? option.activeClassName
                    : "border-transparent bg-slate-50 text-slate-700 hover:border-slate-200 hover:bg-white"
                }`}
              >
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="mt-0.5 block text-xs leading-5 opacity-75">{option.detail}</span>
              </button>
            ))}
          </div>
          {stance ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => saveStance(null)}
              className="mt-2 w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-rose-700 disabled:cursor-wait disabled:opacity-60"
            >
              Stop following
            </button>
          ) : null}
        </div>
      </details>
      {error ? <p className="mt-1 max-w-64 text-xs text-orange-300" aria-live="polite">{error}</p> : null}
    </div>
  );
}
