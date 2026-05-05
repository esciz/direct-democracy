import Link from "next/link";

import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { FollowButton } from "@/components/domain/follow-button";
import { ProfileImagePlaceholder } from "@/components/domain/profile-image-placeholder";
import type { PublicProfileSummary } from "@/types/domain";

type CandidateDirectoryCardProps = {
  candidate: PublicProfileSummary;
  returnPath?: string;
};

export function CandidateDirectoryCard({ candidate, returnPath = "/candidates" }: CandidateDirectoryCardProps) {
  return (
    <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-3.5 shadow-card backdrop-blur">
      <div className="flex items-start gap-2.5">
        <ProfileImagePlaceholder name={candidate.name} size="sm" imageUrl={candidate.profileImageUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-semibold text-ink">{candidate.name}</h3>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 ring-1 ring-slate-200">
              Candidate
            </span>
            {candidate.partyText ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                {candidate.partyText}
              </span>
            ) : null}
          </div>
          {typeof candidate.followerCount === "number" ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                {candidate.followerCount.toLocaleString()} followers
              </span>
            </div>
          ) : null}
        </div>
        <FavoriteToggleControl
          targetType="candidate"
          targetId={candidate.id}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-civic-500 hover:text-civic-700"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {candidate.viewerCanFollow && candidate.claimedByUserId ? (
          <FollowButton
            targetUserId={candidate.claimedByUserId}
            returnPath={returnPath}
            isFollowing={Boolean(candidate.viewerIsFollowing)}
            className={
              candidate.viewerIsFollowing
                ? "rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                : "rounded-full bg-civic-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            }
          />
        ) : null}
        <Link
          href={`/candidates/${candidate.id}`}
          className="inline-flex rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          Open candidate profile
        </Link>
      </div>
    </article>
  );
}
