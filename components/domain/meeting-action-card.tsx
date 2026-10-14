import Link from "next/link";

import { CivicDetails } from "@/components/ui/civic-details";
import { IssueTag } from "@/components/domain/issue-tag";
import { highLevelSummary, plainLanguageTitle } from "@/lib/civic/plain-language";
import type { MeetingActionCard } from "@/lib/public-meetings/action-cards";

type MeetingActionCardProps = {
  card: MeetingActionCard;
  admin?: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "Date pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date pending";
  return date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

function Badge({ label }: { label: string }) {
  const tone =
    label === "Source-backed"
      ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
      : label.includes("pending") || label.includes("Needs") || label.includes("Low-confidence")
        ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
        : "border-white/10 bg-white/5 text-slate-300";

  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{label}</span>;
}

export function MeetingActionCardView({ card, admin = false }: MeetingActionCardProps) {
  const title = plainLanguageTitle(card.title);
  const summary = highLevelSummary(card.plainEnglishSummary, "A plain-language summary is being reviewed.");
  const keyOutcome = card.finalOutcome ?? card.recommendedAction ?? null;

  return (
    <article className="dd-simple-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-cyan-200">{formatDate(card.meetingDate)}</p>
        {card.badges.some((badge) => badge.includes("pending") || badge.includes("Needs")) ? <Badge label="Review in progress" /> : null}
      </div>
      {card.policyArea !== "Other" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <IssueTag label={card.policyArea} tone="dark" />
        </div>
      ) : null}
      <h2 className="mt-3 text-lg font-semibold leading-7 text-slate-50">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">{summary}</p>
      {keyOutcome ? (
        <p className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-500/[0.07] px-3 py-2 text-sm leading-6 text-slate-200">
          <span className="font-semibold text-cyan-100">Bottom line: </span>{highLevelSummary(keyOutcome, keyOutcome, 150)}
        </p>
      ) : null}
      <div className="mt-4 flex items-center gap-3">
        {card.sourceUrl ? (
          <Link href={card.sourceUrl} target="_blank" rel="noreferrer" className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">
            View agenda
          </Link>
        ) : null}
      </div>
      <CivicDetails>
        <div className="space-y-2">
          <p>{card.bodyName} · {card.jurisdiction}{card.itemNumber ? ` · Item ${card.itemNumber}` : ""}</p>
          {title !== card.title ? <p><span className="font-semibold text-slate-300">Official title:</span> {card.title}</p> : null}
          {card.explanation && card.explanation !== card.plainEnglishSummary ? <p>{card.explanation}</p> : null}
          {card.fiscalImpact ? <p><span className="font-semibold text-amber-200">Cost:</span> {card.fiscalImpact}</p> : null}
          {card.departments.length ? <p><span className="font-semibold text-slate-300">Department:</span> {card.departments.join(", ")}</p> : null}
          {card.affectedGroups.length ? <p><span className="font-semibold text-slate-300">Affected groups:</span> {card.affectedGroups.join(", ")}</p> : null}
          {card.namedRollCallPending ? <p>Individual official votes are still being reviewed.</p> : null}
          <p>{card.policyArea} · {card.itemType.replace(/_/g, " ")} · {Math.round(card.confidenceScore * 100)}% confidence</p>
          {card.sourceSnippet ? <p><span className="font-semibold text-slate-300">Source excerpt:</span> {card.sourceSnippet}</p> : null}
          {card.sourceLocalPath ? <p className="break-all">{card.sourceLocalPath}</p> : null}
          {admin ? <p className="text-amber-200">Admin priority P{card.priority}: {card.priorityReason}</p> : null}
        </div>
      </CivicDetails>
    </article>
  );
}
