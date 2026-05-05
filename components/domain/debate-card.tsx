import Link from "next/link";

import type { DebateSummary } from "@/types/domain";

type DebateCardProps = {
  debate: DebateSummary;
};

function statusLabel(debate: DebateSummary) {
  if (debate.startState === "pendingChallenge") {
    return "Awaiting challenge response";
  }

  if (debate.startState === "seekingParticipants") {
    return "Seeking both sides";
  }

  if (debate.status === "agreed") {
    return "Resolved by agreement";
  }

  if (debate.status === "withdrawn") {
    return "Closed by withdrawal";
  }

  if (debate.status === "completed") {
    return "Completed";
  }

  return "Open";
}

export function DebateCard({ debate }: DebateCardProps) {
  return (
    <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
          {debate.mode === "group" ? "Group debate" : "1 vs 1 debate"}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
          {statusLabel(debate)}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-semibold tracking-tight text-ink">{debate.title}</h3>
      <p className="mt-3 text-sm text-slate-600">{debate.issueText}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{debate.description}</p>
      <div className="mt-4 grid gap-3 rounded-3xl bg-slate-50 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Side A</p>
          <p className="mt-2 text-sm font-semibold text-ink">{debate.sideAName}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Side B</p>
          <p className="mt-2 text-sm font-semibold text-ink">{debate.sideBName}</p>
        </div>
      </div>
      {debate.currentTurn ? (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">Current turn</p>
          <p className="mt-2 text-sm font-semibold text-ink">{debate.currentTurn.label}</p>
          <p className="mt-1 text-sm text-slate-600">
            {debate.currentTurn.phase === "awaitingStatement" && "Waiting for the scheduled participant to publish their statement."}
            {debate.currentTurn.phase === "drafting" &&
              `Draft window is open${debate.currentTurn.eligibleGroupTag ? ` for ${debate.currentTurn.eligibleGroupTag}` : ""}.`}
            {debate.currentTurn.phase === "voting" && "Draft voting is open for this turn."}
            {debate.currentTurn.phase === "readyToFinalize" && "This turn is ready to finalize into one official statement."}
          </p>
        </div>
      ) : null}
      {debate.agreedStatement ? (
        <p className="mt-4 text-sm leading-7 text-slate-700">{debate.agreedStatement}</p>
      ) : null}
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          {debate.jurisdictionName} · {debate.turnCount} official turn{debate.turnCount === 1 ? "" : "s"} · {debate.followerCount} follower
          {debate.followerCount === 1 ? "" : "s"}
        </span>
        <Link
          href={`/debates/${debate.id}`}
          className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          View debate
        </Link>
      </div>
    </article>
  );
}
