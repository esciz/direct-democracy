import Link from "next/link";

import type { BallotInitiativeSummary } from "@/types/domain";

type BallotInitiativeCardProps = {
  initiative: BallotInitiativeSummary;
};

export function BallotInitiativeCard({ initiative }: BallotInitiativeCardProps) {
  return (
    <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
          {initiative.scope === "local" ? "Local initiative" : "State initiative"}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {initiative.jurisdictionName}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-semibold text-ink">{initiative.title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{initiative.summary}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-emerald-50 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">Support</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-900">{initiative.communitySentiment.support}%</p>
        </div>
        <div className="rounded-2xl bg-rose-50 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-rose-700">Oppose</p>
          <p className="mt-2 text-2xl font-semibold text-rose-900">{initiative.communitySentiment.oppose}%</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Unclear</p>
          <p className="mt-2 text-2xl font-semibold text-slate-800">{initiative.communitySentiment.unclear}%</p>
        </div>
      </div>
      {initiative.relatedIssues.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {initiative.relatedIssues.map((issue) => (
            <span key={issue} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              {issue}
            </span>
          ))}
        </div>
      ) : null}
      <Link
        href={`/initiatives/${initiative.id}`}
        className="mt-5 inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
      >
        View initiative
      </Link>
    </article>
  );
}
