import Link from "next/link";

import type { DraftLegislationSummary } from "@/types/domain";

type DraftLegislationCardProps = {
  legislation: DraftLegislationSummary;
};

export function DraftLegislationCard({ legislation }: DraftLegislationCardProps) {
  return (
    <div className="rounded-[1.75rem] border border-violet-200 bg-violet-50/80 p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-violet-700 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
          {legislation.status}
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">
          Sponsored by {legislation.sponsorName}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-semibold tracking-tight text-ink">{legislation.title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-700">{legislation.summary}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={`/legislation/${legislation.id}`}
          className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          View draft legislation
        </Link>
        <Link
          href={`/petitions/${legislation.petitionId}`}
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-violet-400 hover:text-violet-700"
        >
          View originating petition
        </Link>
      </div>
    </div>
  );
}
