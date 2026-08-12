import Link from "next/link";
import type { ReactNode } from "react";

import { CivicAvatar } from "@/components/domain/civic-avatar";
import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { FollowButton } from "@/components/domain/follow-button";
import { CivicDetails } from "@/components/ui/civic-details";
import { highLevelSummary } from "@/lib/civic/plain-language";
import type { FavoriteTargetType } from "@/lib/favorites/types";

type ExploreResultCardProps = {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  href: string;
  ctaLabel?: string;
  sourceUrl?: string | null;
  badges?: ReactNode;
  chart?: ReactNode;
  avatar?: {
    name?: string | null;
    imageUrl?: string | null;
    entityType?:
      | "citizen"
      | "trustedCitizen"
      | "candidate"
      | "official"
      | "organization"
      | "media"
      | "community"
      | "agency"
      | "case"
      | "publicAccountability"
      | "petition"
      | "issue";
    verified?: boolean;
  };
  favorite?: {
    targetType: FavoriteTargetType;
    targetId: string;
  };
  follow?: {
    targetUserId: string;
    returnPath: string;
    isFollowing: boolean;
    canFollow: boolean;
  };
};

export function ExploreResultCard({
  title,
  subtitle,
  description,
  href,
  ctaLabel = "Open",
  sourceUrl,
  badges,
  chart,
  avatar,
  favorite,
  follow,
}: ExploreResultCardProps) {
  return (
    <article className="group dd-simple-card transition hover:border-cyan-300/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {avatar ? (
            <CivicAvatar
              name={avatar.name ?? title}
              imageUrl={avatar.imageUrl}
              entityType={avatar.entityType}
              verified={avatar.verified}
              size="sm"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold tracking-tight text-slate-50">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
          </div>
        </div>
        {favorite ? <FavoriteToggleControl targetType={favorite.targetType} targetId={favorite.targetId} /> : null}
      </div>
      {description ? <p className="mt-3 text-sm leading-6 text-slate-400">{highLevelSummary(description, description)}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {follow?.canFollow ? (
          <FollowButton
            targetUserId={follow.targetUserId}
            returnPath={follow.returnPath}
            isFollowing={follow.isFollowing}
            className={
              follow.isFollowing
                ? "inline-flex rounded-full border border-cyan-300/15 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-55"
                : "inline-flex rounded-full bg-[linear-gradient(135deg,#34d399,#22d3ee)] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
            }
          />
        ) : null}
        <Link
          href={href}
            className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition group-hover:border-cyan-300/20 group-hover:text-cyan-100 hover:bg-white/8"
        >
          {ctaLabel}
        </Link>
      </div>
      {badges || chart || (sourceUrl && sourceUrl !== href) ? (
        <CivicDetails>
          {badges ? <div className="flex flex-wrap gap-2">{badges}</div> : null}
          {chart ? <div className="mt-3">{chart}</div> : null}
          {sourceUrl && sourceUrl !== href ? <Link href={sourceUrl} className="mt-3 inline-flex font-semibold text-cyan-200">Open source</Link> : null}
        </CivicDetails>
      ) : null}
    </article>
  );
}
