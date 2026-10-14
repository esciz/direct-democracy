import Link from "next/link";

import { RevealIconChip } from "@/components/domain/reveal-icon-chip";
import { getIssueVisualToken } from "@/lib/ui/visual-tokens";
import type { CandidateMatchSummary } from "@/types/domain";

type CandidateMatchCardProps = {
  candidateId: string;
  match: CandidateMatchSummary;
};

export function CandidateMatchCard({ candidateId, match }: CandidateMatchCardProps) {
  return (
    <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-ink">{match.candidateName}</h3>
          <p className="mt-2 text-sm text-slate-600">Based on your activity and selected issues.</p>
        </div>
        <div className="rounded-3xl bg-slate-950 px-4 py-3 text-white">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Match</p>
          <p className="mt-1 text-2xl font-semibold">{match.matchPercentage}%</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-civic-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Aligned issues</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {match.alignedIssues.length ? (
              match.alignedIssues.map((issue) => (
                <RevealIconChip key={issue} {...getIssueVisualToken(issue)} tone="civic" />
              ))
            ) : (
              <span className="text-sm text-civic-900/80">No clear alignment signals yet.</span>
            )}
          </div>
        </div>
        <div className="rounded-3xl bg-orange-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">Differing issues</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {match.differingIssues.length ? (
              match.differingIssues.map((issue) => (
                <RevealIconChip key={issue} {...getIssueVisualToken(issue)} tone="orange" />
              ))
            ) : (
              <span className="text-sm text-orange-900/80">No major differences surfaced from your recent activity.</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/candidates/${candidateId}`}
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          View Profile
        </Link>
        <Link
          href={`#match-${candidateId}`}
          className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Compare
        </Link>
      </div>
    </article>
  );
}
