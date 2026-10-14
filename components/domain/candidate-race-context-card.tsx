import Link from "next/link";

import { formatDateUtc } from "@/lib/dates";
import type { CandidateRaceContext } from "@/lib/candidates/race-context";

export function CandidateRaceContextCard({ context }: { context: CandidateRaceContext }) {
  return (
    <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Race context</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{context.officeTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {context.jurisdictionName}
            {context.districtName ? ` · ${context.districtName}` : ""} · {context.isContested ? "Contested race" : "Candidate list still being verified"}
          </p>
        </div>
        <Link href={`/elections/${context.electionId}`} className="dd-button-primary rounded-full px-4 py-3 text-sm font-semibold">
          View election
        </Link>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Election</p>
          <p className="mt-3 text-sm font-semibold text-slate-100">{context.electionTitle}</p>
          <p className="mt-2 text-xs text-slate-400">
            {context.electionDate ? formatDateUtc(context.electionDate, { month: "long", day: "numeric", year: "numeric" }) : "Election date pending"}
          </p>
        </div>
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Filing status</p>
          <p className="mt-3 text-sm font-semibold text-slate-100">{context.filingStatus ?? "Filing status pending"}</p>
        </div>
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Party / ballot</p>
          <p className="mt-3 text-sm font-semibold text-slate-100">{context.partyText ?? "Nonpartisan or not listed"}</p>
        </div>
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Source</p>
          {context.sourceUrl ? (
            <Link href={context.sourceUrl} className="mt-3 block text-sm font-semibold text-cyan-100 hover:text-cyan-50">
              {context.sourceName}
            </Link>
          ) : (
            <p className="mt-3 text-sm font-semibold text-slate-100">{context.sourceName}</p>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">All candidates in this race</p>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">
            {context.candidates.length} listed
          </span>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {context.candidates.length ? (
            context.candidates.map((candidate) => (
              <Link
                key={candidate.id}
                href={`/candidates/${candidate.id}`}
                className={`rounded-2xl border p-4 transition ${
                  candidate.isCurrent
                    ? "border-cyan-300/24 bg-cyan-300/10 text-cyan-50"
                    : "border-white/10 bg-black/10 text-slate-100 hover:border-cyan-300/20"
                }`}
              >
                <p className="text-sm font-semibold">{candidate.name}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {candidate.partyText ?? "Nonpartisan or not listed"} · {candidate.filingStatus ?? "Filing pending"}
                </p>
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
              Candidate list for this race is pending verification.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
