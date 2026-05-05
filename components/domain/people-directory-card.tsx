import Link from "next/link";

import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { FollowButton } from "@/components/domain/follow-button";
import { ProfileImagePlaceholder } from "@/components/domain/profile-image-placeholder";
import { RoleBadge } from "@/components/domain/role-badge";
import type { PublicCitizenDirectorySummary } from "@/types/domain";

type PeopleDirectoryCardProps = {
  citizen: PublicCitizenDirectorySummary;
  returnPath?: string;
};

export function PeopleDirectoryCard({ citizen, returnPath = "/people" }: PeopleDirectoryCardProps) {
  return (
    <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-3.5 shadow-card backdrop-blur">
      <div className="flex items-start gap-2.5">
        <ProfileImagePlaceholder name={citizen.name} size="sm" imageUrl={citizen.profileImageUrl} />
        <div className="min-w-0 flex-1">
          {citizen.studentProfile?.studentVerified && citizen.studentProfile.campusName ? (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-civic-700">
              {citizen.studentProfile.campusName}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-semibold text-ink">{citizen.name}</h3>
            <RoleBadge role={citizen.role} />
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">@{citizen.username}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-civic-50 px-2.5 py-1 text-[11px] font-semibold text-civic-700">
              Civic Credibility · {citizen.civicCredibility.label}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              Trust · {citizen.trustSignal.label}
            </span>
            {citizen.topIssuesPreview.length
              ? citizen.topIssuesPreview.slice(0, 2).map((issue) => (
                  <span key={`${citizen.id}-${issue}`} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                    {issue}
                  </span>
                ))
              : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              {citizen.followerCount.toLocaleString()} followers
            </span>
          </div>
        </div>
        <FavoriteToggleControl
          targetType="person"
          targetId={citizen.id}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-civic-500 hover:text-civic-700"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {citizen.viewerCanFollow ? (
          <FollowButton
            targetUserId={citizen.id}
            returnPath={returnPath}
            isFollowing={citizen.viewerIsFollowing}
            className={
              citizen.viewerIsFollowing
                ? "rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                : "rounded-full bg-civic-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            }
          />
        ) : null}
        <Link
          href={`/citizens/${citizen.id}`}
          className="inline-flex rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          Open profile
        </Link>
      </div>
    </article>
  );
}
