import Link from "next/link";

import type { RunForOfficeOpportunitySummary } from "@/types/domain";

type RunForOfficeOpportunityCardProps = {
  opportunity: RunForOfficeOpportunitySummary;
};

export function RunForOfficeOpportunityCard({ opportunity }: RunForOfficeOpportunityCardProps) {
  const dateLabel = new Date(`${opportunity.electionDate}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
          {opportunity.electionType}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {dateLabel}
        </span>
        {opportunity.hasExistingDraft ? (
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">Draft started</span>
        ) : null}
      </div>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink">{opportunity.officeTitle}</h2>
      <p className="mt-2 text-sm font-medium text-slate-600">{opportunity.jurisdictionName}</p>
      <p className="mt-4 text-sm leading-6 text-slate-700">{opportunity.basicInfo}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/run-for-office/races/${opportunity.electionId}`}
          className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Explore this race
        </Link>
        {opportunity.publishedCandidateProfileId ? (
          <Link
            href={`/candidates/${opportunity.publishedCandidateProfileId}`}
            className="inline-flex rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            View published profile
          </Link>
        ) : null}
      </div>
    </article>
  );
}
