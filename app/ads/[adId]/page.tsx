import Link from "next/link";
import { notFound } from "next/navigation";

import { AdClaimCard } from "@/components/domain/ad-claim-card";
import { AdMediaViewer } from "@/components/domain/ad-media-viewer";
import { RatingChallengeButton } from "@/components/domain/rating-challenge-button";
import { TruthRatingBadge } from "@/components/domain/truth-rating-badge";
import {
  formatPoliticalAdDateRange,
  formatPoliticalAdMoney,
  getPoliticalAdById,
  POLITICAL_AD_RELATION_LABELS,
  POLITICAL_AD_SOURCE_LABELS,
  POLITICAL_AD_SPONSOR_LABELS,
} from "@/lib/political-ads/store";

type PoliticalAdDetailPageProps = {
  params: Promise<{
    adId: string;
  }>;
};

export default async function PoliticalAdDetailPage({ params }: PoliticalAdDetailPageProps) {
  const { adId } = await params;
  const ad = getPoliticalAdById(adId);

  if (!ad) {
    notFound();
  }

  return (
    <div className="space-y-6 py-8">
      <section className="dd-panel relative overflow-hidden rounded-[1.75rem] p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#34d399,#22d3ee,#818cf8)]" />
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Political Ad</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">{ad.title}</h1>
            <p className="mt-3 text-sm leading-7 text-slate-300">{ad.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {ad.entityRelations.map((relation) => (
                <Link
                  key={relation.id}
                  href={`/ads?${relation.entityType}Id=${encodeURIComponent(relation.entityId)}`}
                  className="rounded-full border border-emerald-300/18 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100"
                >
                  {POLITICAL_AD_RELATION_LABELS[relation.relationType]} {relation.entityLabel}
                </Link>
              ))}
            </div>
          </div>
          <div className="grid min-w-[16rem] gap-2">
            <TruthRatingBadge label="System rating" rating={ad.overallSystemRating} confidence={ad.overallSystemConfidence} />
            <TruthRatingBadge label="Trusted citizen rating" rating={ad.overallCitizenRating} tone="citizen" />
          </div>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Source", POLITICAL_AD_SOURCE_LABELS[ad.sourceType]],
            ["Sponsor", ad.sponsorName],
            ["Sponsor type", POLITICAL_AD_SPONSOR_LABELS[ad.sponsorType]],
            ["Paid for by", ad.paidForBy],
            ["Produced by", ad.producedBy ?? "Not reported"],
            ["Active", formatPoliticalAdDateRange(ad)],
            ["Spend", formatPoliticalAdMoney(ad.totalSpend, ad.currency)],
            ["Geography", ad.geographySummary],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</dt>
              <dd className="mt-2 text-sm font-semibold text-slate-100">{value}</dd>
            </div>
          ))}
        </dl>

        {ad.authorizationText ? (
          <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-400">
            {ad.authorizationText}
          </p>
        ) : null}
      </section>

      <AdMediaViewer ad={ad} />

      <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Truth rating</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">System and trusted citizen ratings</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">{ad.overallSystemExplanation}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <TruthRatingBadge label="Overall system rating" rating={ad.overallSystemRating} confidence={ad.overallSystemConfidence} />
            <TruthRatingBadge label="Overall citizen rating" rating={ad.overallCitizenRating} tone="citizen" />
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Citizen agreement</p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">{ad.citizenAgreementPercent ?? 0}%</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Citizen ratings</p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">{ad.citizenRatingCount ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Challenges</p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">{ad.challenges.length}</p>
          </div>
        </div>
        <div className="mt-5">
          <RatingChallengeButton targetType="ad" targetId={ad.id} />
        </div>
      </section>

      <section id="claims" className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Claim breakdown</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Claims reviewed</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Factual claims, opinion claims, predictions, and not-checkable slogans are separated so the overall ad rating does not flatten the context.
          </p>
        </div>
        <div className="mt-5 grid gap-4">
          {ad.claims.map((claim) => (
            <AdClaimCard key={claim.id} claim={claim} />
          ))}
        </div>
      </section>

      <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Source metadata</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Archive and geography</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm font-semibold text-slate-100">Where this ad ran</p>
            <div className="mt-3 space-y-2 text-sm text-slate-400">
              {ad.geographies.map((geo) => (
                <p key={geo.id}>
                  {[geo.city, geo.county, geo.state, geo.districtName].filter(Boolean).join(" · ") || geo.country}
                </p>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm font-semibold text-slate-100">Source links</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {ad.platformUrl ? (
                <a href={ad.platformUrl} className="dd-button-secondary rounded-full px-4 py-2 text-sm font-semibold">
                  Platform source
                </a>
              ) : null}
              {ad.archiveUrl ? (
                <a href={ad.archiveUrl} className="dd-button-secondary rounded-full px-4 py-2 text-sm font-semibold">
                  Archive source
                </a>
              ) : null}
              {!ad.platformUrl && !ad.archiveUrl ? <p className="text-sm text-slate-400">No public source URL is attached yet.</p> : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
