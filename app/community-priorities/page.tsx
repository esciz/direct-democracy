import Link from "next/link";

import { CommunityBudgetSection } from "@/components/domain/community-budget-section";
import { CommunityCostOfLivingSection } from "@/components/domain/community-cost-of-living-section";
import { CommunityComparisonSection } from "@/components/domain/community-comparison-section";
import { CommunitySnapshot } from "@/components/domain/community-snapshot";
import { CommunityTrendingSection } from "@/components/domain/community-trending-section";
import { CommunityIssuePriorityList } from "@/components/domain/community-issue-priority-list";
import { CommunityPopularPlaces } from "@/components/domain/community-popular-places";
import { CommunitySelector } from "@/components/domain/community-selector";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageIntro } from "@/components/ui/page-intro";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getCommunityById, getDefaultCommunityForUser } from "@/lib/community/communities";
import { getCommunityEconomics, getCommunityEconomicsLevelOptions } from "@/lib/community/economics";
import { getCommunityIssueComparison, getCommunityIssuePriorities, getCommunityPopularPlaces } from "@/lib/community/priorities";
import { getCommunitySnapshot } from "@/lib/community/snapshot";
import { getIssueTrendData } from "@/lib/community/trends";
import { FAVORITE_SPOT_CATEGORY_OPTIONS } from "@/lib/profile/options";
import type { CommunityDataLevel, FavoriteSpotType, VoteQuestionScope } from "@/types/domain";

type CommunityPrioritiesPageProps = {
  searchParams?: Promise<{
    communityId?: string;
    scope?: string;
    placeCategory?: string;
    compare?: string;
    trend?: string;
    econLevel?: string;
  }>;
};

function normalizeScope(scope: string | undefined): VoteQuestionScope {
  if (scope === "state" || scope === "national") {
    return scope;
  }

  return "local";
}

function normalizeCategory(category: string | undefined): FavoriteSpotType | "all" {
  if (FAVORITE_SPOT_CATEGORY_OPTIONS.some((option) => option.value === category)) {
    return category as FavoriteSpotType;
  }

  return "all";
}

function normalizeCompareMode(compare: string | undefined): "issues" | "demographics" {
  return compare === "demographics" ? "demographics" : "issues";
}

function normalizeTrendWindow(trend: string | undefined): "7d" | "30d" {
  return trend === "30d" ? "30d" : "7d";
}

function normalizeEconomicLevel(level: string | undefined): CommunityDataLevel | undefined {
  if (level === "city" || level === "county" || level === "state" || level === "federal") {
    return level;
  }

  return undefined;
}

export default async function CommunityPrioritiesPage({ searchParams }: CommunityPrioritiesPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const defaultCommunity = getDefaultCommunityForUser(user);
  const selectedCommunity = params?.communityId ?? defaultCommunity.id;
  const currentCommunity = getCommunityById(selectedCommunity) ?? defaultCommunity;
  const scope = normalizeScope(params?.scope);
  const placeCategory = normalizeCategory(params?.placeCategory);
  const compareMode = normalizeCompareMode(params?.compare);
  const trendWindow = normalizeTrendWindow(params?.trend);
  const economicLevel = normalizeEconomicLevel(params?.econLevel);
  const [issueData, comparisonRows, places, trends] = await Promise.all([
    getCommunityIssuePriorities(user, selectedCommunity, scope),
    getCommunityIssueComparison(user, selectedCommunity, scope),
    getCommunityPopularPlaces(selectedCommunity, placeCategory),
    getIssueTrendData(selectedCommunity, scope, trendWindow),
  ]);
  const snapshot = getCommunitySnapshot(selectedCommunity);
  const stateSnapshot = getCommunitySnapshot("nevada");
  const nationalSnapshot = getCommunitySnapshot("united-states");
  const economics = getCommunityEconomics(selectedCommunity, economicLevel);
  const economicsTabs = getCommunityEconomicsLevelOptions(selectedCommunity).map((option) => ({
    label: option.label,
    href: `/community-priorities?communityId=${selectedCommunity}&scope=${scope}&placeCategory=${placeCategory}&compare=${compareMode}&trend=${trendWindow}&econLevel=${option.level}`,
    active: economics.selectedLevel === option.level,
  }));

  const scopeTabs = [
    {
      label: "Local",
      href: `/community-priorities?communityId=${selectedCommunity}&scope=local&placeCategory=${placeCategory}&compare=${compareMode}&trend=${trendWindow}&econLevel=${economics.selectedLevel}`,
      active: scope === "local",
    },
    {
      label: "State",
      href: `/community-priorities?communityId=${selectedCommunity}&scope=state&placeCategory=${placeCategory}&compare=${compareMode}&trend=${trendWindow}&econLevel=${economics.selectedLevel}`,
      active: scope === "state",
    },
    {
      label: "National",
      href: `/community-priorities?communityId=${selectedCommunity}&scope=national&placeCategory=${placeCategory}&compare=${compareMode}&trend=${trendWindow}&econLevel=${economics.selectedLevel}`,
      active: scope === "national",
    },
  ];
  const placeCategoryLinks = [
    {
      label: "All places",
      href: `/community-priorities?communityId=${selectedCommunity}&scope=${scope}&placeCategory=all&compare=${compareMode}&trend=${trendWindow}&econLevel=${economics.selectedLevel}`,
      active: placeCategory === "all",
    },
    ...FAVORITE_SPOT_CATEGORY_OPTIONS.map((option) => ({
      label: option.label,
      href: `/community-priorities?communityId=${selectedCommunity}&scope=${scope}&placeCategory=${option.value}&compare=${compareMode}&trend=${trendWindow}&econLevel=${economics.selectedLevel}`,
      active: placeCategory === option.value,
    })),
  ];
  const comparisonTabs = [
    {
      label: "Issues",
      href: `/community-priorities?communityId=${selectedCommunity}&scope=${scope}&placeCategory=${placeCategory}&compare=issues&trend=${trendWindow}&econLevel=${economics.selectedLevel}`,
      active: compareMode === "issues",
    },
    {
      label: "Demographics",
      href: `/community-priorities?communityId=${selectedCommunity}&scope=${scope}&placeCategory=${placeCategory}&compare=demographics&trend=${trendWindow}&econLevel=${economics.selectedLevel}`,
      active: compareMode === "demographics",
    },
  ];
  const trendTabs = [
    {
      label: "Last 7 days",
      href: `/community-priorities?communityId=${selectedCommunity}&scope=${scope}&placeCategory=${placeCategory}&compare=${compareMode}&trend=7d`,
      active: trendWindow === "7d",
    },
    {
      label: "Last 30 days",
      href: `/community-priorities?communityId=${selectedCommunity}&scope=${scope}&placeCategory=${placeCategory}&compare=${compareMode}&trend=30d`,
      active: trendWindow === "30d",
    },
  ];

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Community Priorities"
        title={`What matters most in ${issueData.community.name}`}
        description="A comparison-friendly view of the issues people care about most and the places they associate with community life."
        meta={
          <>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{issueData.community.name}</span>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">{scope} issue view</span>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
              {economics.selected.levelLabel} data
            </span>
          </>
        }
        actions={
          <Link
            href={`/my-community?communityId=${selectedCommunity}`}
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Back to My Community
          </Link>
        }
      />

      <CommunitySelector
        currentCommunity={currentCommunity}
        followedCommunities={[]}
        suggestedCommunities={[]}
        followedIds={[]}
        returnPath="/community-priorities"
        destinationBase="/community-priorities"
      />

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Scope</p>
            <p className="mt-2 text-sm text-slate-600">Switch between local, state, and national issue perspectives while keeping the same community in view.</p>
          </div>
          <FilterTabs tabs={scopeTabs} />
        </div>
      </section>

      <CommunityIssuePriorityList issues={issueData.priorities.slice(0, 8)} communityId={selectedCommunity} />

      <CommunityTrendingSection trends={trends} window={trendWindow} windowTabs={trendTabs} />

      <CommunitySnapshot snapshot={snapshot} />

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Community economics</p>
            <p className="mt-2 text-sm text-slate-600">
              Switch between city, county, state, and federal views to compare everyday costs with where public money comes from and where it goes.
            </p>
          </div>
          <FilterTabs tabs={economicsTabs} />
        </div>
      </section>

      <CommunityCostOfLivingSection summary={economics.selected} comparison={economics.comparison} communityId={selectedCommunity} />

      <CommunityBudgetSection summary={economics.selected} communityId={selectedCommunity} />

      <CommunityComparisonSection
        mode={compareMode}
        tabs={comparisonTabs}
        selectedCommunityName={issueData.community.name}
        issueRows={comparisonRows}
        selectedSnapshot={snapshot}
        stateSnapshot={stateSnapshot}
        nationalSnapshot={nationalSnapshot}
      />

      <CommunityPopularPlaces places={places} selectedCategory={placeCategory} categoryLinks={placeCategoryLinks} />
    </div>
  );
}
