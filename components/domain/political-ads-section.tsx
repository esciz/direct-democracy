import Link from "next/link";

import { PoliticalAdCard } from "@/components/domain/political-ad-card";
import { formatPoliticalAdMoney } from "@/lib/political-ads/store";
import type { PoliticalAdEntityCoverage } from "@/lib/political-ads/store";
import type { PoliticalAd } from "@/types/domain";

type PoliticalAdsSectionProps = {
  title: string;
  description: string;
  ads: PoliticalAd[];
  repositoryHref: string;
  emptyText?: string;
  coverage?: PoliticalAdEntityCoverage | null;
};

export function PoliticalAdsSection({
  title,
  description,
  ads,
  repositoryHref,
  emptyText = "No political ads are attached to this page yet.",
  coverage = null,
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

      {coverage ? (
        <div className="mt-5 grid gap-3 border-y border-white/10 py-4 sm:grid-cols-4">
          <div>
            <p className="text-xs font-semibold text-slate-500">Matched records</p>
            <p className="mt-1 text-lg font-semibold text-white">{coverage.totals.matchedRecords}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Creative attached</p>
            <p className="mt-1 text-lg font-semibold text-white">{coverage.totals.creativeRecords}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Spend filings only</p>
            <p className="mt-1 text-lg font-semibold text-white">{coverage.totals.filingOnlyRecords}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Reported spend</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {formatPoliticalAdMoney(coverage.totals.reportedSpend)}
            </p>
          </div>
          <p className="text-xs leading-5 text-slate-500 sm:col-span-4">{coverage.coverageNote}</p>
        </div>
      ) : null}

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
