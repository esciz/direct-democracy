import Link from "next/link";
import type { ReactNode } from "react";

import { CivicAvatar } from "@/components/domain/civic-avatar";
import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import type { FavoriteTargetType } from "@/lib/favorites/types";

type ExploreResultCardProps = {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  href: string;
  ctaLabel?: string;
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
};

export function ExploreResultCard({
  title,
  subtitle,
  description,
  href,
  ctaLabel = "Open",
  badges,
  chart,
  avatar,
  favorite,
}: ExploreResultCardProps) {
  return (
    <article className="group rounded-[1.5rem] border border-white/10 bg-[linear-gradient(165deg,rgba(12,22,39,0.96),rgba(8,15,28,0.96))] p-5 shadow-[0_24px_50px_-34px_rgba(2,8,23,0.92)] transition hover:-translate-y-0.5 hover:border-cyan-300/20 hover:shadow-[0_28px_58px_-34px_rgba(34,211,238,0.18)]">
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
      {description ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">{description}</p> : null}
      {badges ? <div className="mt-4 flex flex-wrap gap-2">{badges}</div> : null}
      {chart ? <div className="mt-4">{chart}</div> : null}
      <div className="mt-5">
        <Link
          href={href}
          className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition group-hover:border-cyan-300/20 group-hover:text-cyan-100 hover:bg-white/8"
        >
          {ctaLabel}
        </Link>
      </div>
    </article>
  );
}
