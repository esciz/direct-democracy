"use client";

import { useState, useTransition, type MouseEvent } from "react";

import { ActionLabel, FlagIcon } from "@/components/ui/action-icons";
import { submitContentReportAction } from "@/lib/moderation/actions";
import type { ModerationReportReason, ModerationReportTargetType } from "@/types/domain";

const REPORT_REASONS: Array<{ value: ModerationReportReason; label: string }> = [
  { value: "harassment", label: "Harassment / abuse" },
  { value: "hate", label: "Hate / discriminatory content" },
  { value: "threat", label: "Threat / violence" },
  { value: "sexual", label: "Sexual / explicit content" },
  { value: "spam", label: "Spam / scam" },
  { value: "misinformation", label: "Misinformation / deceptive content" },
  { value: "other", label: "Other" },
];

type ContentReportControlProps = {
  targetType: ModerationReportTargetType;
  targetId: string;
  initialReported?: boolean;
  compact?: boolean;
};

export function ContentReportControl({
  targetType,
  targetId,
  initialReported = false,
  compact = false,
}: ContentReportControlProps) {
  const [reported, setReported] = useState(initialReported);
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState<ModerationReportReason>("harassment");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(initialReported ? "Reported" : null);
  const [isPending, startTransition] = useTransition();

  function handleToggle(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (reported) {
      return;
    }

    setExpanded((current) => !current);
    setMessage(null);
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-label={reported ? "Content already reported" : "Report inappropriate content"}
        className={
          reported
            ? compact
              ? "inline-flex min-h-10 items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700"
              : "rounded-full border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
            : compact
              ? "inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-700"
              : "rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-700"
        }
      >
        <ActionLabel icon={<FlagIcon className="h-4 w-4" />}>{reported ? "Reported" : "Flag"}</ActionLabel>
      </button>

      {expanded && !reported ? (
        <div
          className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-card ${compact ? "max-w-sm" : "w-full max-w-md"}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <p className="text-sm font-semibold text-ink">Report inappropriate content</p>
          <p className="mt-1 text-xs text-slate-500">This report is separate from truth rating and factual-claim flagging.</p>
          <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Reason
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as ModerationReportReason)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-civic-500"
            >
              {REPORT_REASONS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Optional note
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Add a brief note for moderators."
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-civic-500"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                startTransition(async () => {
                  const result = await submitContentReportAction({
                    targetType,
                    targetId,
                    reason,
                    note,
                  });

                  if (!result.ok) {
                    setMessage(result.message ?? "That report could not be submitted.");
                    return;
                  }

                  setReported(true);
                  setExpanded(false);
                  setMessage(result.message ?? "Thanks for your report.");
                });
              }}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isPending}
            >
              {isPending ? "Submitting..." : "Submit report"}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setExpanded(false);
              }}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="text-xs text-slate-500">{message}</p> : null}
    </div>
  );
}
