import { RatingChallengeButton } from "@/components/domain/rating-challenge-button";
import { TruthRatingBadge } from "@/components/domain/truth-rating-badge";
import type { AdClaim } from "@/types/domain";

export function AdClaimCard({ claim }: { claim: AdClaim }) {
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-cyan-300/18 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
              {claim.importance} importance
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
              {claim.claimType === "notCheckable" ? "Not checkable" : claim.claimType}
            </span>
            {claim.mediaTimestampStart ? (
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold text-slate-300">
                {claim.mediaTimestampStart}
                {claim.mediaTimestampEnd ? `-${claim.mediaTimestampEnd}` : ""}
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold leading-7 text-slate-50">{claim.claimText}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-400">{claim.systemExplanation}</p>
        </div>
        <div className="grid min-w-[14rem] gap-2">
          <TruthRatingBadge label="System claim rating" rating={claim.systemRating} confidence={claim.systemConfidence} />
          <TruthRatingBadge label="Citizen claim rating" rating={claim.citizenRating} tone="citizen" />
        </div>
      </div>

      {claim.evidence.length ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Evidence</p>
          <div className="mt-3 space-y-3">
            {claim.evidence.map((evidence) => (
              <a
                key={evidence.id}
                href={evidence.url}
                className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/25"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                    {evidence.supportsOrRefutes}
                  </span>
                  <span className="text-xs text-slate-500">{evidence.publisher}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-100">{evidence.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">{evidence.excerpt}</p>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <RatingChallengeButton targetType="claim" targetId={claim.id} />
      </div>
    </article>
  );
}
