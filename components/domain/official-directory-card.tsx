import Link from "next/link";

import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { FollowButton } from "@/components/domain/follow-button";
import { ProfileImagePlaceholder } from "@/components/domain/profile-image-placeholder";
import type { OfficialProfileSummary } from "@/types/domain";

type OfficialDirectoryCardProps = {
  official: OfficialProfileSummary;
  returnPath?: string;
};

export function OfficialDirectoryCard({ official, returnPath = "/officials" }: OfficialDirectoryCardProps) {
  return (
    <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-3.5 shadow-card backdrop-blur">
      <div className="flex items-start gap-2.5">
        <ProfileImagePlaceholder name={official.name} size="sm" imageUrl={official.profileImageUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-semibold text-ink">{official.name}</h3>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 ring-1 ring-slate-200">
              Official
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              {official.party}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {official.truthScore?.media ? (
              <span className="rounded-full bg-civic-50 px-2.5 py-1 text-[11px] font-semibold text-civic-700">
                Truth {official.truthScore.media}
              </span>
            ) : null}
            {official.followThroughScore ? (
              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                Follow-through {official.followThroughScore}
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              {official.followerCount.toLocaleString()} followers
            </span>
          </div>
        </div>
        <FavoriteToggleControl
          targetType="official"
          targetId={official.id}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-civic-500 hover:text-civic-700"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {official.viewerCanFollow && official.claimedByUserId ? (
          <FollowButton
            targetUserId={official.claimedByUserId}
            returnPath={returnPath}
            isFollowing={Boolean(official.viewerIsFollowing)}
            className={
              official.viewerIsFollowing
                ? "rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                : "rounded-full bg-civic-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            }
          />
        ) : null}
        <Link
          href={`/officials/${official.id}`}
          className="inline-flex rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          Open official profile
        </Link>
      </div>
    </article>
  );
}
