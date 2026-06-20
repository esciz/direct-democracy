import Link from "next/link";

import { PoliticalAdCard } from "@/components/domain/political-ad-card";
import { PoliticalAdFilters } from "@/components/domain/political-ad-filters";
import { PageIntro } from "@/components/ui/page-intro";
import {
  getFilteredPoliticalAds,
  getPoliticalAdRepositoryFilterLabel,
  paginatePoliticalAds,
  POLITICAL_AD_RELATION_LABELS,
  POLITICAL_AD_SOURCE_LABELS,
  POLITICAL_AD_SPONSOR_LABELS,
} from "@/lib/political-ads/store";
import type {
  PoliticalAdFilters as PoliticalAdFiltersType,
  PoliticalAdRelationType,
  PoliticalAdSourceType,
  PoliticalAdSponsorType,
  PoliticalAdTruthRating,
} from "@/types/domain";

type AdsRepositoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const TRUTH_RATINGS: PoliticalAdTruthRating[] = ["True", "Mostly True", "Mostly False", "False", "Not Checkable", "Needs Review"];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toNumber(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeFilters(params: Record<string, string | string[] | undefined> | undefined): PoliticalAdFiltersType {
  const sourceType = firstParam(params?.sourceType);
  const sponsorType = firstParam(params?.sponsorType);
  const relationType = firstParam(params?.relationType);
  const systemRating = firstParam(params?.systemRating);
  const citizenRating = firstParam(params?.citizenRating);
  return {
    q: firstParam(params?.q),
    candidateId: firstParam(params?.candidateId),
    officialId: firstParam(params?.officialId),
    issueId: firstParam(params?.issueId),
    ballotMeasureId: firstParam(params?.ballotMeasureId),
    electionId: firstParam(params?.electionId),
    sponsor: firstParam(params?.sponsor),
    sponsorType: sponsorType && sponsorType in POLITICAL_AD_SPONSOR_LABELS ? (sponsorType as PoliticalAdSponsorType) : "all",
    sourceType: sourceType && sourceType in POLITICAL_AD_SOURCE_LABELS ? (sourceType as PoliticalAdSourceType) : "all",
    relationType: relationType && relationType in POLITICAL_AD_RELATION_LABELS ? (relationType as PoliticalAdRelationType) : "all",
    systemRating: systemRating && TRUTH_RATINGS.includes(systemRating as PoliticalAdTruthRating) ? (systemRating as PoliticalAdTruthRating) : "all",
    citizenRating: citizenRating && TRUTH_RATINGS.includes(citizenRating as PoliticalAdTruthRating) ? (citizenRating as PoliticalAdTruthRating) : "all",
    geography: firstParam(params?.geography),
    minSpend: toNumber(firstParam(params?.minSpend)),
    maxSpend: toNumber(firstParam(params?.maxSpend)),
    dateFrom: firstParam(params?.dateFrom),
    dateTo: firstParam(params?.dateTo),
    sort: (firstParam(params?.sort) as PoliticalAdFiltersType["sort"]) ?? "newest",
    page: toNumber(firstParam(params?.page)) ?? 1,
  };
}

function buildPageHref(filters: PoliticalAdFiltersType, page: number) {
  const params = new URLSearchParams();
  Object.entries({ ...filters, page }).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") return;
    params.set(key, String(value));
  });
  return `/ads?${params.toString()}`;
}

export default async function AdsRepositoryPage({ searchParams }: AdsRepositoryPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const filters = normalizeFilters(params);
  const allowDemoData = process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true";

  if (!allowDemoData) {
    return (
      <div className="space-y-6 py-8">
        <PageIntro
          eyebrow="Ads Transparency"
          title="Ad Repository"
          description="No reviewed political ad repository records are available for production browse previews yet."
          meta={
            <span className="rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-100">
              Limited data
            </span>
          }
        />

        <section className="dd-panel-muted rounded-[1.75rem] p-6 text-sm leading-6 text-slate-400">
          Direct Democracy is not showing seeded ad examples outside demo mode. Once a reviewed public ad repository import exists, this page will show source-backed ads with sponsor, source, geography, and rating context.
        </section>
      </div>
    );
  }

  const allAds = getFilteredPoliticalAds(filters);
  const page = paginatePoliticalAds(allAds, filters.page, 8);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Ads Transparency"
        title="Ad Repository"
        description="Search political ads by sponsor, source, geography, public issue, election, and truth rating. System ratings and trusted citizen ratings are shown separately."
        meta={
          <>
            <span className="rounded-full border border-cyan-300/18 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
              {getPoliticalAdRepositoryFilterLabel(filters)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-200">
              {allAds.length} ad{allAds.length === 1 ? "" : "s"}
            </span>
          </>
        }
      />

      <PoliticalAdFilters filters={filters} />

      <section className="dd-panel-muted rounded-[1.75rem] p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Research archive</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Political ads</h2>
            <p className="mt-2 text-sm text-slate-400">
              List results load thumbnail previews only. Open a detail page for full media, transcripts, claims, evidence, and rating challenges.
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">
            Page {page.page} of {page.totalPages}
          </span>
        </div>

        <div className="mt-5 grid gap-4">
          {page.items.length ? (
            page.items.map((ad) => <PoliticalAdCard key={ad.id} ad={ad} />)
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">
              No ads match those filters yet. Try broadening the sponsor, rating, geography, or date filters.
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-between gap-3">
          {page.page > 1 ? (
            <Link href={buildPageHref(filters, page.page - 1)} className="dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold">
              Previous
            </Link>
          ) : (
            <span />
          )}
          {page.page < page.totalPages ? (
            <Link href={buildPageHref(filters, page.page + 1)} className="dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold">
              Next
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
