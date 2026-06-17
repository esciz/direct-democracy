import Link from "next/link";

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
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_40px_-28px_rgba(2,8,23,0.8)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge label="Source-backed" />
            {card.badges.filter((badge) => badge !== "Source-backed").map((badge) => <Badge key={badge} label={badge} />)}
            <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
              {Math.round(card.confidenceScore * 100)}% confidence
            </span>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
            {card.bodyName} · {card.jurisdiction} · {formatDate(card.meetingDate)}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-50">
            {card.itemNumber ? `Item ${card.itemNumber}: ` : null}{card.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{card.plainEnglishSummary}</p>
          {card.explanation && card.explanation !== card.plainEnglishSummary ? <p className="mt-2 text-sm leading-6 text-slate-400">{card.explanation}</p> : null}
        </div>
        {admin ? (
          <div className="shrink-0 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">
            P{card.priority} · {card.priorityReason}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {card.recommendedAction ? (
          <div className="rounded-xl border border-white/10 bg-black/15 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Recommended Action</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{card.recommendedAction}</p>
          </div>
        ) : null}
        {card.finalOutcome ? (
          <div className="rounded-xl border border-white/10 bg-black/15 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Final Action / Outcome</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{card.finalOutcome}</p>
          </div>
        ) : null}
        {card.fiscalImpact ? (
          <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">Fiscal Impact</p>
            <p className="mt-2 text-sm leading-6 text-amber-50">{card.fiscalImpact}</p>
          </div>
        ) : null}
        {card.departments.length ? (
          <div className="rounded-xl border border-white/10 bg-black/15 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Department / Source Agency</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{card.departments.join(", ")}</p>
          </div>
        ) : null}
        {card.affectedGroups.length ? (
          <div className="rounded-xl border border-white/10 bg-black/15 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Affected Groups</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{card.affectedGroups.join(", ")}</p>
          </div>
        ) : null}
        {card.namedRollCallPending ? (
          <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">Voting Record</p>
            <p className="mt-2 text-sm leading-6 text-amber-50">
              {card.finalOutcome ? "Outcome recorded; individual official votes pending review." : "Named roll call pending review."}
            </p>
          </div>
        ) : null}
      </div>

      <details className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-100">Source-backed snippet</summary>
        <p className="mt-2 text-sm leading-6 text-slate-400">{card.sourceSnippet}</p>
      </details>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>{card.policyArea}</span>
        <span>·</span>
        <span>{card.itemType.replace(/_/g, " ")}</span>
        {card.sourceLocalPath ? (
          <>
            <span>·</span>
            <span className="break-all">{card.sourceLocalPath}</span>
          </>
        ) : null}
        {card.sourceUrl ? (
          <Link href={card.sourceUrl} target="_blank" rel="noreferrer" className="ml-auto rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 font-semibold text-cyan-100">
            Source
          </Link>
        ) : null}
      </div>
    </article>
  );
}
