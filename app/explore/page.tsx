import Link from "next/link";

import { ExploreResultCard } from "@/components/domain/explore-result-card";
import { PageIntro } from "@/components/ui/page-intro";
import { PreserveScrollQueryForm } from "@/components/ui/preserve-scroll-query-form";
import { SectionHeading } from "@/components/ui/section-heading";
import { getBrowsePreviewCategory, type BrowsePreviewBadgeTone, type BrowsePreviewCategory, type BrowsePreviewItem } from "@/lib/browse/preview-adapter";
import { getCommunityById, getDefaultCommunityForUser, getGeographicCommunities } from "@/lib/community/communities";
import type { FavoriteTargetType } from "@/lib/favorites/types";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getFavoritesForUser } from "@/lib/server/favorites";

type ExploreCategory = BrowsePreviewCategory;

type ExploreSearchParams = {
  communityId?: string;
  q?: string;
  category?: string;
  favorites?: string;
  filterParty?: string;
  filterOffice?: string;
  filterLevel?: string;
  filterStatus?: string;
  filterRole?: string;
  filterCredibility?: string;
  filterScope?: string;
  filterSource?: string;
};

type ExplorePageProps = {
  searchParams?: Promise<ExploreSearchParams>;
};

const EXPLORE_CATEGORIES: Array<{ key: ExploreCategory; label: string }> = [
  { key: "communities", label: "Communities" },
  { key: "issues", label: "Issues" },
  { key: "people", label: "People" },
  { key: "candidates", label: "Candidates" },
  { key: "officials", label: "Officials" },
  { key: "petitions", label: "Petitions" },
  { key: "cases", label: "Cases" },
  { key: "events", label: "Events" },
  { key: "elections", label: "Elections" },
  { key: "ads", label: "Ads" },
  { key: "organizations", label: "Organizations" },
];

type ExploreFilterKey =
  | "party"
  | "office"
  | "level"
  | "status"
  | "role"
  | "credibility"
  | "scope"
  | "source";

type ExploreFilterControl = {
  key: ExploreFilterKey;
  name: keyof ExploreSearchParams;
  label: string;
  options: string[];
};

const FILTER_PARAM_BY_KEY: Record<ExploreFilterKey, keyof ExploreSearchParams> = {
  party: "filterParty",
  office: "filterOffice",
  level: "filterLevel",
  status: "filterStatus",
  role: "filterRole",
  credibility: "filterCredibility",
  scope: "filterScope",
  source: "filterSource",
};

const FILTERS_BY_CATEGORY: Partial<Record<ExploreCategory, ExploreFilterControl[]>> = {
  communities: [
    { key: "scope", name: "filterScope", label: "Community type", options: ["County", "City", "Community", "State", "Federal"] },
  ],
  issues: [
    { key: "scope", name: "filterScope", label: "Issue scope", options: ["local", "state", "national"] },
  ],
  people: [
    { key: "role", name: "filterRole", label: "Profile type", options: ["Registered citizen", "Trusted citizen"] },
    { key: "credibility", name: "filterCredibility", label: "Credibility", options: ["Verified", "High", "Still forming"] },
  ],
  candidates: [
    { key: "party", name: "filterParty", label: "Affiliation", options: ["Democratic Party", "Republican Party", "Nonpartisan", "Independent", "Party pending"] },
    { key: "level", name: "filterLevel", label: "Office level", options: ["Federal", "State", "County", "City", "School", "Court", "Other"] },
  ],
  officials: [
    { key: "level", name: "filterLevel", label: "Government level", options: ["Federal", "State", "County", "City", "School", "Court", "Other"] },
  ],
  cases: [
    { key: "status", name: "filterStatus", label: "Review status", options: ["approved", "needs review", "open", "closed"] },
    { key: "source", name: "filterSource", label: "Source type", options: ["Reviewed public case", "Agenda-derived case"] },
  ],
  events: [
    { key: "status", name: "filterStatus", label: "Timing", options: ["upcoming", "completed", "cancelled", "unknown"] },
    { key: "level", name: "filterLevel", label: "Body level", options: ["State", "County", "City", "School", "Court", "Other"] },
  ],
  elections: [
    { key: "scope", name: "filterScope", label: "Election scope", options: ["direct", "inferred", "county", "statewide overlay"] },
  ],
  organizations: [
    { key: "level", name: "filterLevel", label: "Organization level", options: ["Federal", "State", "County", "City", "School", "Court", "Other"] },
  ],
};

function normalizeCategory(value: string | undefined): ExploreCategory {
  return EXPLORE_CATEGORIES.some((entry) => entry.key === value) ? (value as ExploreCategory) : "communities";
}

function resolveCommunityId(communityId: string | undefined, fallbackCommunityId: string) {
  return getCommunityById(communityId)?.id ?? fallbackCommunityId;
}

function getCategoryLabel(category: ExploreCategory) {
  return EXPLORE_CATEGORIES.find((entry) => entry.key === category)?.label ?? "Communities";
}

function getCategoryPlaceholder(category: ExploreCategory) {
  switch (category) {
    case "communities":
      return "Search communities";
    case "people":
      return "Search people";
    case "issues":
      return "Search issues";
    case "candidates":
      return "Search candidates";
    case "officials":
      return "Search officials";
    case "petitions":
      return "Search petitions";
    case "cases":
      return "Search cases";
    case "events":
      return "Search events";
    case "elections":
      return "Search elections";
    case "ads":
      return "Search ads";
    case "organizations":
      return "Search organizations";
  }
}

function getCategoryDescription(category: ExploreCategory) {
  switch (category) {
    case "communities":
      return "Browse local, state, and national communities with lightweight previews.";
    case "people":
      return "Preview public citizen profiles tied to your civic context.";
    case "issues":
      return "Browse issue hubs that connect posts, petitions, events, debates, cases, and ballot measures.";
    case "candidates":
      return "Preview campaigns and candidate profiles without loading full election detail.";
    case "officials":
      return "Browse officials by office, jurisdiction, and lightweight accountability signals.";
    case "petitions":
      return "Preview signature momentum and open petition activity.";
    case "cases":
      return "Browse legal, civic, ethics, complaint, enforcement, and public accountability cases tied to what is happening.";
    case "events":
      return "Preview upcoming and completed civic meetings, election dates, deadlines, forums, hearings, and rallies.";
    case "elections":
      return "Browse active and upcoming races with lightweight election previews.";
    case "ads":
      return "Browse political ads by sponsor, source, geography, election, issue, candidate, and truth rating.";
    case "organizations":
      return "Preview civic organizations organizing members, debates, endorsements, petitions, events, and public action.";
  }
}

function buildExploreHref({
  communityId,
  category,
  q,
  favorites,
}: {
  communityId: string;
  category: ExploreCategory;
  q?: string;
  favorites?: boolean;
}) {
  const params = new URLSearchParams({
    communityId,
    category,
  });

  if (q?.trim()) {
    params.set("q", q.trim());
  }

  if (favorites) {
    params.set("favorites", "1");
  }

  return `/explore?${params.toString()}`;
}

function renderBadge(label: string, tone: BrowsePreviewBadgeTone = "slate") {
  const styles =
    tone === "civic"
      ? "border-cyan-300/18 bg-cyan-500/10 text-cyan-200"
      : tone === "orange"
        ? "border-orange-300/18 bg-orange-500/10 text-orange-200"
        : tone === "emerald"
          ? "border-emerald-300/18 bg-emerald-500/10 text-emerald-200"
          : "border-white/10 bg-white/6 text-slate-300";

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${styles}`}>{label}</span>;
}

function renderPreviewBadges(item: BrowsePreviewItem) {
  return (
    <>
      {item.badges?.map((badge) => (
        <span key={`${item.id}-${badge.label}`}>{renderBadge(badge.label, badge.tone)}</span>
      ))}
    </>
  );
}

function getActiveFilterValues(params: ExploreSearchParams | undefined, controls: ExploreFilterControl[]) {
  return Object.fromEntries(
    controls.flatMap((control) => {
      const value = params?.[control.name]?.trim();
      return value ? [[control.key, value]] : [];
    }),
  ) as Record<string, string>;
}

function getFilterSummary(controls: ExploreFilterControl[], filters: Record<string, string>) {
  return controls
    .map((control) => filters[control.key])
    .filter(Boolean)
    .join(" · ");
}

function getEventPreviewTimingStatus(items: BrowsePreviewItem[]) {
  if (!items.length) return null;

  const hasUpcoming = items.some((item) =>
    item.badges?.some((badge) => ["upcoming", "scheduled"].includes(badge.label.toLowerCase())),
  );
  const hasCompleted = items.some((item) => item.badges?.some((badge) => badge.label.toLowerCase() === "completed"));

  if (hasUpcoming) {
    return {
      label: "Upcoming imported events shown first",
      tone: "emerald" as BrowsePreviewBadgeTone,
      note: "Event status is refreshed from generated source-backed records.",
    };
  }

  if (hasCompleted) {
    return {
      label: "No upcoming imported events yet",
      tone: "orange" as BrowsePreviewBadgeTone,
      note: "Showing recent completed source-backed events until new upcoming records are imported.",
    };
  }

  return {
    label: "Imported events shown by latest available date",
    tone: "slate" as BrowsePreviewBadgeTone,
    note: "Event status is refreshed from generated source-backed records.",
  };
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const defaultCommunity = getDefaultCommunityForUser(user);
  const selectedCommunityId = resolveCommunityId(params?.communityId, defaultCommunity.id);
  const currentCommunity = getCommunityById(selectedCommunityId) ?? defaultCommunity;
  const query = params?.q?.trim() ?? "";
  const activeCategory = normalizeCategory(params?.category);
  const filterControls = FILTERS_BY_CATEGORY[activeCategory] ?? [];
  const activeFilters = getActiveFilterValues(params, filterControls);
  const activeFilterSummary = getFilterSummary(filterControls, activeFilters);
  const favoritesOnly = params?.favorites === "1";
  const locationChoices = getGeographicCommunities()
    .filter((community) =>
      [
        "nevada",
        "carson-city-county",
        "carson-city",
        "washoe-county",
        "reno",
        "sparks",
        "clark-county",
        "las-vegas",
        "henderson",
        "north-las-vegas",
      ].includes(community.id),
    )
    .sort((a, b) => {
      if (a.id === selectedCommunityId) return -1;
      if (b.id === selectedCommunityId) return 1;
      return a.name.localeCompare(b.name);
    });
  const favoriteRecords = await getFavoritesForUser(user.id);
  const favoriteIdsByType = favoriteRecords.reduce<Record<FavoriteTargetType, string[]>>(
    (groups, record) => {
      groups[record.targetType] = [...(groups[record.targetType] ?? []), record.targetId];
      return groups;
    },
    {
      community: [],
      issue: [],
      person: [],
      candidate: [],
      official: [],
      petition: [],
      case: [],
      event: [],
      election: [],
      organization: [],
      decision: [],
      project: [],
    },
  );

  const targetTypeForCategory: Partial<Record<ExploreCategory, FavoriteTargetType>> = {
    communities: "community",
    issues: "issue",
    people: "person",
    candidates: "candidate",
    officials: "official",
    petitions: "petition",
    cases: "case",
    events: "event",
    elections: "election",
    organizations: "organization",
  };
  const activeFavoriteTargetType = targetTypeForCategory[activeCategory];

  const activePreview = await getBrowsePreviewCategory({
    category: activeCategory,
    communityId: selectedCommunityId,
    query: favoritesOnly ? "" : query,
    limit: favoritesOnly ? 24 : query ? 12 : 8,
    favoriteIds: favoritesOnly ? (activeFavoriteTargetType ? favoriteIdsByType[activeFavoriteTargetType] : []) : undefined,
    viewerUser: user,
    filters: activeFilters,
  });
  const activeItems = activePreview.items;
  const eventPreviewTimingStatus = activeCategory === "events" ? getEventPreviewTimingStatus(activeItems) : null;

  const activeCategoryLabel = getCategoryLabel(activeCategory);
  const resultsTitle = favoritesOnly
    ? `${activeCategoryLabel} you favorited`
    : query
      ? `${activeCategoryLabel} matching “${query}”`
      : `${activeCategoryLabel} to browse`;
  const resultsDescription = favoritesOnly
    ? `A reusable favorites view for ${activeCategoryLabel.toLowerCase()}.`
    : query
      ? `Search is currently scoped to ${activeCategoryLabel.toLowerCase()} only.`
      : activeFilterSummary
        ? `Filtered to ${activeFilterSummary} in and around ${currentCommunity.name}.`
      : `Browse ${activeCategoryLabel.toLowerCase()} in and around ${currentCommunity.name}.`;

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Explore"
        title="Find your way in without getting overwhelmed"
        description="Start with one category at a time, skim real source-backed previews, and open the items you want to understand more deeply."
        meta={
          <>
            <span className="rounded-full border border-cyan-300/18 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">{currentCommunity.name}</span>
          </>
        }
      />

      <section className="dd-panel rounded-[1.75rem] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionHeading
            eyebrow="Browse"
            title="Browse and search by category"
            description="Choose one civic category, search within it, and preview the best available source-backed records below."
          />
          {favoritesOnly ? (
            <Link
              href={buildExploreHref({ communityId: selectedCommunityId, category: activeCategory, q: query })}
              scroll={false}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100"
            >
              Back to search
            </Link>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {EXPLORE_CATEGORIES.map((category) => {
            const href = buildExploreHref({
              communityId: selectedCommunityId,
              category: category.key,
              q: query,
              favorites: favoritesOnly,
            });

            return (
              <Link
                key={`browse-${category.key}`}
                href={href}
                scroll={false}
                className={
                  category.key === activeCategory
                    ? "rounded-full bg-[linear-gradient(135deg,#34d399,#22d3ee)] px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_14px_28px_-18px_rgba(45,212,191,0.75)]"
                    : "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-300/20 hover:text-cyan-100"
                }
              >
                {category.label}
              </Link>
            );
          })}
        </div>

        <PreserveScrollQueryForm action="/explore" className="mt-5 grid gap-3">
          <input type="hidden" name="category" value={activeCategory} />
          {favoritesOnly ? <input type="hidden" name="favorites" value="1" /> : null}
          <div className="flex flex-wrap gap-3">
            <label className="min-w-[13rem] flex-1">
              <span className="sr-only">Location</span>
              <select
                name="communityId"
                defaultValue={selectedCommunityId}
                className="dd-input w-full rounded-full px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-300/30"
              >
                {locationChoices.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder={getCategoryPlaceholder(activeCategory)}
              className="dd-input min-w-[18rem] flex-[2] rounded-full px-4 py-3 text-sm outline-none focus:border-cyan-300/30"
            />
            <button type="submit" className="dd-button-primary rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5">
              Search
            </button>
          </div>
          {filterControls.length ? (
            <div className="flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-3">
              <span className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Refine {activeCategoryLabel}</span>
              {filterControls.map((control) => (
                <label key={control.key} className="min-w-[11rem] flex-1">
                  <span className="sr-only">{control.label}</span>
                  <select
                    name={control.name}
                    defaultValue={params?.[control.name] ?? ""}
                    className="dd-input w-full rounded-full px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-300/30"
                  >
                    <option value="">{control.label}: All</option>
                    {control.options.map((option) => (
                      <option key={`${control.key}-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {activeFilterSummary ? (
                <Link
                  href={buildExploreHref({ communityId: selectedCommunityId, category: activeCategory, q: query, favorites: favoritesOnly })}
                  scroll={false}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100"
                >
                  Clear filters
                </Link>
              ) : null}
            </div>
          ) : null}
        </PreserveScrollQueryForm>

          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{activeCategoryLabel}</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{resultsTitle}</h3>
              <p className="mt-2 text-sm text-slate-400">{query || favoritesOnly ? resultsDescription : getCategoryDescription(activeCategory)}</p>
              {eventPreviewTimingStatus ? (
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                  {eventPreviewTimingStatus.label} · {eventPreviewTimingStatus.note}
                </p>
              ) : null}
              {activeCategory === "people" ? (
                <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
                  <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-3">
                    <p className="font-semibold text-cyan-100">1. Follow useful voices</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">Follow citizens whose local issue work helps you understand what is happening.</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/10 p-3">
                    <p className="font-semibold text-emerald-100">2. Support trusted people</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">Consistent local support can help credible contributors become trusted civic voices.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="font-semibold text-slate-100">3. Build a public record</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">Over time, visible issue work can support candidate and officeholder accountability.</p>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {renderBadge(activePreview.statusLabel, activePreview.isSourceBacked ? "emerald" : "orange")}
              {eventPreviewTimingStatus ? renderBadge(eventPreviewTimingStatus.label, eventPreviewTimingStatus.tone) : null}
              {activePreview.lastGeneratedAt ? renderBadge(`Updated ${new Date(activePreview.lastGeneratedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`) : null}
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200">
                {activeItems.length} item{activeItems.length === 1 ? "" : "s"}
              </span>
              {!favoritesOnly && activePreview.fullHref && activeItems.length ? (
                <Link
                  href={activePreview.fullHref}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100"
                >
                  View all
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {activeItems.length ? (
              activeItems.map((item) => (
                <ExploreResultCard
                  key={`${activeCategory}-${item.id}`}
                  title={item.title}
                  subtitle={item.subtitle}
                  description={item.description}
                  href={item.href}
                  ctaLabel={item.ctaLabel}
                  sourceUrl={item.sourceUrl}
                  badges={renderPreviewBadges(item)}
                  favorite={item.favorite}
                  follow={item.follow}
                  avatar={item.avatar}
                />
              ))
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400 xl:col-span-2">
                {favoritesOnly
                  ? `No saved ${activeCategoryLabel.toLowerCase()} yet.`
                  : query
                    ? activePreview.emptyReason ?? `No ${activeCategoryLabel.toLowerCase()} match “${query}” yet.`
                    : activePreview.emptyReason ?? `No ${activeCategoryLabel.toLowerCase()} are available for this browse preview yet.`}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
