import Link from "next/link";

import { ExploreResultCard } from "@/components/domain/explore-result-card";
import { PageIntro } from "@/components/ui/page-intro";
import { PreserveScrollQueryForm } from "@/components/ui/preserve-scroll-query-form";
import { SectionHeading } from "@/components/ui/section-heading";
import { getBrowsePreviewCategory, type BrowsePreviewBadgeTone, type BrowsePreviewCategory, type BrowsePreviewItem } from "@/lib/browse/preview-adapter";
import { getCommunityById, getDefaultCommunityForUser } from "@/lib/community/communities";
import type { FavoriteTargetType } from "@/lib/favorites/types";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getFavoritesForUser } from "@/lib/server/favorites";

type ExploreCategory = BrowsePreviewCategory;

type ExplorePageProps = {
  searchParams?: Promise<{
    communityId?: string;
    q?: string;
    category?: string;
    browseCategory?: string;
    favorites?: string;
  }>;
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
  browseCategory,
  q,
  favorites,
}: {
  communityId: string;
  category: ExploreCategory;
  browseCategory?: ExploreCategory;
  q?: string;
  favorites?: boolean;
}) {
  const params = new URLSearchParams({
    communityId,
    category,
  });

  if (browseCategory) {
    params.set("browseCategory", browseCategory);
  }

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
  const activeBrowseCategory = normalizeCategory(params?.browseCategory ?? params?.category);
  const favoritesOnly = params?.favorites === "1";
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

  const activePreview = getBrowsePreviewCategory({
    category: activeCategory,
    communityId: selectedCommunityId,
    query: favoritesOnly ? "" : query,
    limit: favoritesOnly ? 24 : 12,
    favoriteIds: favoritesOnly ? (activeFavoriteTargetType ? favoriteIdsByType[activeFavoriteTargetType] : []) : undefined,
  });
  const browsePreview = getBrowsePreviewCategory({
    category: activeBrowseCategory,
    communityId: selectedCommunityId,
    query: "",
    limit: 8,
  });
  const activeItems = activePreview.items;
  const browseItems = browsePreview.items;
  const eventPreviewTimingStatus = activeBrowseCategory === "events" ? getEventPreviewTimingStatus(browseItems) : null;

  const activeCategoryLabel = getCategoryLabel(activeCategory);
  const activeBrowseCategoryLabel = getCategoryLabel(activeBrowseCategory);
  const resultsTitle = favoritesOnly
    ? `${activeCategoryLabel} you favorited`
    : query
      ? `${activeCategoryLabel} matching “${query}”`
      : `${activeCategoryLabel} to browse`;
  const resultsDescription = favoritesOnly
    ? `A reusable favorites view for ${activeCategoryLabel.toLowerCase()}.`
    : query
      ? `Search is currently scoped to ${activeCategoryLabel.toLowerCase()} only.`
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
        <SectionHeading
          eyebrow="Browse"
          title="Browse by category"
          description="Switch categories to see the best available Nevada records, plus honest limited-data messages when a category is not populated yet."
        />

        <div className="mt-5 flex flex-wrap gap-2">
          {EXPLORE_CATEGORIES.map((category) => {
            const href = buildExploreHref({
              communityId: selectedCommunityId,
              category: activeCategory,
              browseCategory: category.key,
              q: query,
              favorites: favoritesOnly,
            });

            return (
              <Link
                key={`browse-${category.key}`}
                href={href}
                scroll={false}
                className={
                  category.key === activeBrowseCategory
                    ? "rounded-full bg-[linear-gradient(135deg,#34d399,#22d3ee)] px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_14px_28px_-18px_rgba(45,212,191,0.75)]"
                    : "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-300/20 hover:text-cyan-100"
                }
              >
                {category.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{activeBrowseCategoryLabel}</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{activeBrowseCategoryLabel} to browse</h3>
              <p className="mt-2 text-sm text-slate-400">{getCategoryDescription(activeBrowseCategory)}</p>
              {eventPreviewTimingStatus ? (
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                  {eventPreviewTimingStatus.label} · {eventPreviewTimingStatus.note}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {renderBadge(browsePreview.statusLabel, browsePreview.isSourceBacked ? "emerald" : "orange")}
              {eventPreviewTimingStatus ? renderBadge(eventPreviewTimingStatus.label, eventPreviewTimingStatus.tone) : null}
              {browsePreview.lastGeneratedAt ? renderBadge(`Updated ${new Date(browsePreview.lastGeneratedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`) : null}
              {browsePreview.fullHref && browseItems.length ? (
                <Link
                  href={browsePreview.fullHref}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100"
                >
                  View all
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
            {browseItems.length ? (
              browseItems.map((item) => (
                <div
                  key={`browse-card-${activeBrowseCategory}-${item.id}`}
                  className="min-w-[20rem] max-w-[28rem] flex-none md:min-w-[calc(50%-0.5rem)]"
                >
                  <ExploreResultCard
                    title={item.title}
                    subtitle={item.subtitle}
                    description={item.description}
                    href={item.href}
                    ctaLabel={item.ctaLabel}
                    badges={renderPreviewBadges(item)}
                    favorite={item.favorite}
                    avatar={item.avatar}
                  />
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">
                {browsePreview.emptyReason ?? `No ${activeBrowseCategoryLabel.toLowerCase()} are available for this browse preview yet.`}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Unified search</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Search one civic category at a time</h2>
            <p className="mt-2 text-sm text-slate-400">
              Choose a category, search within it, and keep the page focused on the type of civic item you are trying to find.
            </p>
          </div>
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
              browseCategory: activeBrowseCategory,
              q: query,
              favorites: favoritesOnly,
            });

            return (
              <Link
                key={category.key}
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

        <PreserveScrollQueryForm action="/explore" className="mt-5 flex flex-wrap gap-3">
          <input type="hidden" name="communityId" value={selectedCommunityId} />
          <input type="hidden" name="category" value={activeCategory} />
          <input type="hidden" name="browseCategory" value={activeBrowseCategory} />
          {favoritesOnly ? <input type="hidden" name="favorites" value="1" /> : null}
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={getCategoryPlaceholder(activeCategory)}
            className="dd-input min-w-[18rem] flex-1 rounded-full px-4 py-3 text-sm outline-none focus:border-cyan-300/30"
          />
          <button type="submit" className="dd-button-primary rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5">
            Search
          </button>
        </PreserveScrollQueryForm>
      </section>

      {query || favoritesOnly ? (
        <section className="dd-panel rounded-[1.75rem] p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow={favoritesOnly ? "Favorites view" : "Search results"}
              title={resultsTitle}
              description={resultsDescription}
            />
            <div className="flex flex-wrap gap-3">
              {!favoritesOnly && activePreview.fullHref && activeItems.length ? (
                <Link
                  href={activePreview.fullHref}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100"
                >
                  View all
                </Link>
              ) : null}
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200">
                {activeItems.length} item{activeItems.length === 1 ? "" : "s"}
              </span>
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
                  badges={renderPreviewBadges(item)}
                  favorite={item.favorite}
                  avatar={item.avatar}
                />
              ))
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400 xl:col-span-2">
                {favoritesOnly
                  ? `No saved ${activeCategoryLabel.toLowerCase()} yet.`
                  : activePreview.emptyReason ?? `No ${activeCategoryLabel.toLowerCase()} match “${query}” yet.`}
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
