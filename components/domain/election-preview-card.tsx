import Link from "next/link";

import type { ElectionSummary } from "@/types/domain";

type ElectionPreviewCardProps = {
  election: ElectionSummary;
};

export function ElectionPreviewCard({ election }: ElectionPreviewCardProps) {
  return (
    <article className="rounded-3xl bg-slate-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">{election.jurisdictionName}</p>
      <h3 className="mt-2 text-lg font-semibold text-ink">{election.title}</h3>
      <p className="mt-2 text-sm text-slate-600">
        {new Date(election.electionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ·{" "}
        {election.candidates.length} candidates
      </p>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
        {election.officeTitle} race in {election.jurisdictionName}, with candidates already visible for side-by-side exploration.
      </p>
      <Link
        href={`/elections/${election.id}`}
        className="mt-4 inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
      >
        View race
      </Link>
    </article>
  );
}
