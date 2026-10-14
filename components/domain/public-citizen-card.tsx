import Link from "next/link";

import { FollowButton } from "@/components/domain/follow-button";
import { ProfileImagePlaceholder } from "@/components/domain/profile-image-placeholder";
import { ReputationBadges } from "@/components/domain/reputation-badges";
import { RevealIconChip } from "@/components/domain/reveal-icon-chip";
import { RoleBadge } from "@/components/domain/role-badge";
import { getDefaultCommunityForJurisdiction } from "@/lib/community/communities";
import { getIssueVisualToken, getTagVisualToken } from "@/lib/ui/visual-tokens";
import type { PublicCitizenProfileSummary } from "@/types/domain";

type PublicCitizenCardProps = {
  citizen: PublicCitizenProfileSummary;
  returnPath?: string;
  compact?: boolean;
};

export function PublicCitizenCard({ citizen, returnPath = "/my-community", compact = false }: PublicCitizenCardProps) {
  const communityId = getDefaultCommunityForJurisdiction(citizen.jurisdictionName)?.id ?? "carson-city";

  return (
    <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      {!compact ? (
        <div
          className="mb-4 h-24 rounded-[1.5rem] bg-cover bg-center"
          style={{ backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.12), rgba(15,23,42,0.45)), url(${citizen.bannerImageUrl || "/community/cc.webp"})` }}
        />
      ) : null}
      <div className="flex items-start gap-4">
        <ProfileImagePlaceholder name={citizen.name} size={compact ? "sm" : "lg"} imageUrl={citizen.profileImageUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`${compact ? "text-base" : "text-lg"} font-semibold text-ink`}>{citizen.name}</h3>
            <RoleBadge role={citizen.role} />
          </div>
          <p className="mt-1 text-sm text-slate-500">@{citizen.username} · {citizen.jurisdictionName}</p>
          <div className="mt-3">
            <ReputationBadges trustLevel={citizen.trustLevel} influenceLevel={citizen.influenceLevel} compact />
          </div>
          <p className={`mt-3 ${compact ? "line-clamp-2" : "line-clamp-3"} text-sm leading-6 text-slate-600`}>{citizen.bio}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          {citizen.followerCount.toLocaleString()} followers
        </span>
        {!compact ? (
          <>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              {citizen.publicOpinionSummary.totalVotes} public votes
            </span>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-civic-700">
              Civic {citizen.publicOpinionSummary.categoryCounts.civic}
            </span>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-civic-700">
              Lifestyle {citizen.publicOpinionSummary.categoryCounts.lifestyle}
            </span>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-700">
              Identity {citizen.publicOpinionSummary.categoryCounts.identity}
            </span>
          </>
        ) : null}
      </div>
      {!compact && citizen.topIssuesPreview.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {citizen.topIssuesPreview.map((issue) => (
            <RevealIconChip
              key={issue}
              {...getIssueVisualToken(issue)}
              href={`/voting?search=${encodeURIComponent(issue)}`}
              tone="civic"
            />
          ))}
        </div>
      ) : null}
      {!compact && citizen.groupTags.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {citizen.groupTags.slice(0, 3).map((tag) => (
            <RevealIconChip
              key={tag}
              {...getTagVisualToken(tag)}
              href={`/my-community?communityId=${communityId}&groupTag=${encodeURIComponent(tag)}`}
              tone="orange"
            />
          ))}
        </div>
      ) : null}
      {!compact && citizen.groupAffiliations.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {citizen.groupAffiliations.slice(0, 2).map((group) => (
            <Link
              key={group.id}
              href={`/my-community?communityId=${communityId}&groupTag=${encodeURIComponent(group.name)}`}
              className="rounded-full border border-civic-200 bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700"
            >
              {group.name}
            </Link>
          ))}
        </div>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/citizens/${citizen.id}`}
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          Open profile
        </Link>
        {citizen.viewerCanFollow ? (
          <FollowButton targetUserId={citizen.id} returnPath={returnPath} isFollowing={citizen.viewerIsFollowing} />
        ) : null}
      </div>
    </article>
  );
}
