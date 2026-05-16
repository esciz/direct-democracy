import Link from "next/link";

import { PoliticalAdCard } from "@/components/domain/political-ad-card";
import type { PoliticalAd } from "@/types/domain";

type PoliticalAdsSectionProps = {
  title: string;
  description: string;
  ads: PoliticalAd[];
  repositoryHref: string;
  emptyText?: string;
};

export function PoliticalAdsSection({
  title,
  description,
  ads,
  repositoryHref,
  emptyText = "No political ads are attached to this page yet.",
}: PoliticalAdsSectionProps) {
  return (
    <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Ads Transparency</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
        </div>
        <Link href={repositoryHref} className="dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold">
          View all ads
        </Link>
      </div>

      <div className="mt-5 grid gap-4">
        {ads.length ? (
          ads.map((ad) => <PoliticalAdCard key={ad.id} ad={ad} compact />)
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-400">{emptyText}</div>
        )}
      </div>
    </section>
  );
}
