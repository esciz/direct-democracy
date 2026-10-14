import { RevealIconChip } from "@/components/domain/reveal-icon-chip";
import { getIssueVisualToken, getMatchStatusVisual } from "@/lib/ui/visual-tokens";
import type { CandidateMatchSummary } from "@/types/domain";

type CandidateMatchBreakdownProps = {
  match: CandidateMatchSummary;
};

function getUserStanceLabel(value: CandidateMatchSummary["breakdown"][number]["userStance"]) {
  switch (value) {
    case "prioritized":
      return "Prioritized by you";
    case "aligned":
      return "Supported in your votes";
    case "disagreed":
      return "You voted against";
    default:
      return "No clear signal";
  }
}

export function CandidateMatchBreakdown({ match }: CandidateMatchBreakdownProps) {
  return (
    <section
      id={`match-${match.candidateId}`}
      className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Match breakdown</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{match.candidateName}</h3>
          <p className="mt-2 text-sm text-slate-600">Issue-by-issue comparison using your saved priorities and recent yes/no activity.</p>
        </div>
        <div className="rounded-3xl bg-slate-950 px-4 py-3 text-white">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Match</p>
          <p className="mt-1 text-2xl font-semibold">{match.matchPercentage}%</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {match.breakdown.length ? (
          match.breakdown.map((item) => (
            <div key={item.issue} className="grid gap-4 rounded-3xl bg-slate-50 p-5 lg:grid-cols-[1.2fr_1fr_1fr]">
              <div>
                <RevealIconChip {...getIssueVisualToken(item.issue)} />
                {item.candidateEvidence ? <p className="mt-2 text-xs text-slate-500">Candidate signal: {item.candidateEvidence}</p> : null}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Your stance</p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                      item.score === 1
                        ? "bg-civic-50 text-civic-700"
                        : item.score === -1
                          ? "bg-orange-50 text-orange-700"
                          : "bg-slate-200 text-slate-600"
                    }`}
                    title={getMatchStatusVisual(item.score).label}
                    aria-label={getMatchStatusVisual(item.score).label}
                  >
                    {getMatchStatusVisual(item.score).icon}
                  </span>
                  <span className="text-sm text-slate-700">{getUserStanceLabel(item.userStance)}</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Candidate stance</p>
                <p className="mt-2 text-sm text-slate-700">{item.candidateStance === "supports" ? "Featured in promises or profile" : "Not clearly stated"}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">
            There is not enough overlapping activity yet to generate a detailed comparison for this candidate.
          </div>
        )}
      </div>
    </section>
  );
}
