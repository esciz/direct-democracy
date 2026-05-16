import Link from "next/link";

import { TruthRatingBadge } from "@/components/domain/truth-rating-badge";
import {
  formatPoliticalAdDateRange,
  formatPoliticalAdMoney,
  getPrimaryAdRelation,
  POLITICAL_AD_RELATION_LABELS,
  POLITICAL_AD_SOURCE_LABELS,
  POLITICAL_AD_SPONSOR_LABELS,
} from "@/lib/political-ads/store";
import type { PoliticalAd } from "@/types/domain";

type PoliticalAdCardProps = {
  ad: PoliticalAd;
  compact?: boolean;
};

function AdThumbnail({ ad }: { ad: PoliticalAd }) {
  const thumbnail = ad.media.find((media) => media.mediaType === "thumbnail" && media.url);
  const primaryRelation = getPrimaryAdRelation(ad);

  if (thumbnail?.url) {
    return (
      <img
        src={thumbnail.url}
        alt={thumbnail.altText ?? `${ad.title} preview`}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-full min-h-[8.5rem] flex-col justify-between bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.28),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.22),transparent_34%),linear-gradient(135deg,#0f172a,#020617)] p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
          {POLITICAL_AD_SOURCE_LABELS[ad.sourceType]}
        </span>
        <span className="rounded-full border border-white/15 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-200">
          {ad.electionCycle}
        </span>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
          {primaryRelation ? `${POLITICAL_AD_RELATION_LABELS[primaryRelation.relationType]} ${primaryRelation.entityLabel}` : "Political ad"}
        </p>
        <p className="mt-2 line-clamp-2 text-lg font-semibold leading-tight text-white">{ad.title}</p>
      </div>
    </div>
  );
}

export function PoliticalAdCard({ ad, compact = false }: PoliticalAdCardProps) {
  const primaryRelation = getPrimaryAdRelation(ad);

  return (
    <article className="group overflow-hidden rounded-[1.45rem] border border-white/10 bg-white/[0.04] shadow-[0_20px_50px_-38px_rgba(2,8,23,0.9)] transition hover:-translate-y-0.5 hover:border-cyan-300/24 hover:bg-white/[0.06]">
      <div className={compact ? "grid gap-0 sm:grid-cols-[12rem_minmax(0,1fr)]" : "grid gap-0 lg:grid-cols-[14rem_minmax(0,1fr)]"}>
        <div className="min-h-[8.5rem] overflow-hidden border-b border-white/10 sm:border-b-0 sm:border-r">
          <AdThumbnail ad={ad} />
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                {POLITICAL_AD_SOURCE_LABELS[ad.sourceType]}
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-50">{ad.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{ad.description}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-200">
              {ad.claims.length} claim{ad.claims.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <TruthRatingBadge label="System rating" rating={ad.overallSystemRating} confidence={ad.overallSystemConfidence} />
            <TruthRatingBadge label="Citizen rating" rating={ad.overallCitizenRating} tone="citizen" />
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            {primaryRelation ? (
              <span className="rounded-full border border-emerald-300/18 bg-emerald-500/10 px-3 py-1 text-emerald-100">
                {POLITICAL_AD_RELATION_LABELS[primaryRelation.relationType]} {primaryRelation.entityLabel}
              </span>
            ) : null}
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-300">
              {POLITICAL_AD_SPONSOR_LABELS[ad.sponsorType]}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-300">
              {ad.geographySummary}
            </span>
          </div>

          <dl className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Paid for by</dt>
              <dd className="mt-1 line-clamp-1">{ad.paidForBy}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Spend</dt>
              <dd className="mt-1">{formatPoliticalAdMoney(ad.totalSpend, ad.currency)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Active</dt>
              <dd className="mt-1">{formatPoliticalAdDateRange(ad)}</dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/ads/${ad.id}`} className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
              View Ad
            </Link>
            <Link href={`/ads/${ad.id}#claims`} className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              View Claims
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
