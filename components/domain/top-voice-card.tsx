import Link from "next/link";

import { CivicAvatar } from "@/components/domain/civic-avatar";
import { FollowButton } from "@/components/domain/follow-button";
import { ReputationBadges } from "@/components/domain/reputation-badges";
import { RevealIconChip } from "@/components/domain/reveal-icon-chip";
import { RoleBadge } from "@/components/domain/role-badge";
import { getDefaultCommunityForJurisdiction } from "@/lib/community/communities";
import { getIssueVisualToken, getTagVisualToken } from "@/lib/ui/visual-tokens";
import type { TopVoiceSummary } from "@/types/domain";

type TopVoiceCardProps = {
  voice: TopVoiceSummary;
  returnPath: string;
};

export function TopVoiceCard({ voice, returnPath }: TopVoiceCardProps) {
  const communityId = getDefaultCommunityForJurisdiction(voice.jurisdictionName)?.id ?? "carson-city";

  return (
    <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div
        className="mb-4 h-24 rounded-[1.5rem] bg-cover bg-center"
        style={{ backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.12), rgba(15,23,42,0.45)), url(/community/cc.webp)` }}
      />
      <div className="flex items-start gap-4">
        <CivicAvatar
          name={voice.name}
          imageUrl={voice.profileImageUrl}
          entityType={voice.role === "trustedCitizen" ? "trustedCitizen" : "citizen"}
          size="lg"
          verified={voice.role === "trustedCitizen"}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-ink">{voice.name}</h3>
            <RoleBadge role={voice.role} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            @{voice.username} · {voice.jurisdictionName}
          </p>
          <div className="mt-3">
            <ReputationBadges trustLevel={voice.trustLevel} influenceLevel={voice.influenceLevel} compact />
          </div>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{voice.bio}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-civic-50 px-3 py-1 text-civic-700">{voice.badgeLabel}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{voice.followerCount.toLocaleString()} followers</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{voice.recentVoteCount} recent votes</span>
      </div>

      <p className="mt-3 text-sm leading-6 text-civic-800">{voice.featuredReason}</p>

      {voice.topIssuesPreview.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {voice.topIssuesPreview.map((issue) => (
            <RevealIconChip
              key={issue}
              {...getIssueVisualToken(issue)}
              href={`/voting?search=${encodeURIComponent(issue)}`}
              tone="civic"
            />
          ))}
        </div>
      ) : null}

      {voice.groupTags.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {voice.groupTags.slice(0, 3).map((tag) => (
            <RevealIconChip
              key={tag}
              {...getTagVisualToken(tag)}
              href={`/my-community?communityId=${communityId}&groupTag=${encodeURIComponent(tag)}`}
              tone="orange"
            />
          ))}
        </div>
      ) : null}

      {voice.groupAffiliations.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {voice.groupAffiliations.slice(0, 2).map((group) => (
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
          href={`/citizens/${voice.id}`}
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          Open profile
        </Link>
        {voice.viewerCanFollow ? (
          <FollowButton targetUserId={voice.id} returnPath={returnPath} isFollowing={voice.viewerIsFollowing} />
        ) : null}
      </div>
    </article>
  );
}
