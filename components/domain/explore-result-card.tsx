import Link from "next/link";
import type { ReactNode } from "react";

import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import type { FavoriteTargetType } from "@/lib/favorites/types";

type ExploreResultCardProps = {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  href: string;
  ctaLabel?: string;
  badges?: ReactNode;
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
  favorite,
}: ExploreResultCardProps) {
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold tracking-tight text-ink">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {favorite ? <FavoriteToggleControl targetType={favorite.targetType} targetId={favorite.targetId} /> : null}
      </div>
      {description ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{description}</p> : null}
      {badges ? <div className="mt-4 flex flex-wrap gap-2">{badges}</div> : null}
      <div className="mt-5">
        <Link
          href={href}
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          {ctaLabel}
        </Link>
      </div>
    </article>
  );
}
