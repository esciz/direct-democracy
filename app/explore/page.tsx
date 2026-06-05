import Link from "next/link";
import type { ReactNode } from "react";

import { ExploreResultCard } from "@/components/domain/explore-result-card";
import { PageIntro } from "@/components/ui/page-intro";
import { PreserveScrollQueryForm } from "@/components/ui/preserve-scroll-query-form";
import { SectionHeading } from "@/components/ui/section-heading";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getAllCases } from "@/lib/cases/store";
import { getDiscoverableEventsForUser } from "@/lib/community/event-discovery";
import { getCommunityEventTypeLabel } from "@/lib/community/events";
import { getCommunityById, getDefaultCommunityForUser, seededCommunities } from "@/lib/community/communities";
import { communityMatchesJurisdiction, communityMatchesMembership } from "@/lib/community/membership";
import type { FavoriteTargetType } from "@/lib/favorites/types";
import { slugifyIssueText } from "@/lib/issues/utils";
import { getAllOrganizations } from "@/lib/organizations/store";
import { getOrganizationTypeLabel } from "@/lib/organizations/presentation";
import { getAllPetitions } from "@/lib/petitions/store";
import { POLITICAL_AD_SOURCE_LABELS, POLITICAL_AD_SPONSOR_LABELS, seededPoliticalAds } from "@/lib/political-ads/store";
import { getPublicPeopleDirectory } from "@/lib/profile/discovery";
import { getOfficials } from "@/lib/officials/store";
import { getCandidateProfiles, getElectionSummaries } from "@/lib/server/elections-context";
import { getFavoritesForUser } from "@/lib/server/favorites";
import { getIssueDirectoryForUser } from "@/lib/server/issues";

type ExploreCategory =
  | "communities"
  | "issues"
  | "people"
  | "candidates"
  | "officials"
  | "petitions"
  | "cases"
  | "events"
  | "elections"
  | "ads"
  | "organizations";

type ExplorePageProps = {
  searchParams?: Promise<{
    communityId?: string;
    q?: string;
    category?: string;
    browseCategory?: string;
    favorites?: string;
  }>;
};

type ExplorePreviewItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  href: string;
  ctaLabel: string;
  badges?: ReactNode;
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

function matchesQuery(query: string, ...values: Array<string | null | undefined>) {
  if (!query) {
    return true;
  }

  const normalized = query.toLowerCase();
  return values.some((value) => value?.toLowerCase().includes(normalized));
}

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
      return "Browse local, state, national, and campus communities with lightweight previews.";
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
      return "Preview upcoming civic events, meetings, and rallies near your community.";
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

function getBrowseHref(category: ExploreCategory, communityId: string, query: string) {
  switch (category) {
    case "communities":
      return "/communities";
    case "issues":
      return query ? `/issues?q=${encodeURIComponent(query)}` : "/issues";
    case "people":
      return query ? `/people?communityId=${communityId}&q=${encodeURIComponent(query)}` : `/people?communityId=${communityId}`;
    case "candidates":
      return query ? `/candidates?communityId=${communityId}&q=${encodeURIComponent(query)}` : `/candidates?communityId=${communityId}`;
    case "officials":
      return query ? `/officials?communityId=${communityId}&q=${encodeURIComponent(query)}` : `/officials?communityId=${communityId}`;
    case "petitions":
      return "/petitions";
    case "cases":
      return "/cases";
    case "events":
      return `/events?communityId=${communityId}`;
    case "elections":
      return "/elections";
    case "ads":
      return query ? `/ads?q=${encodeURIComponent(query)}` : "/ads";
    case "organizations":
      return query
        ? `/organizations?communityId=${communityId}&q=${encodeURIComponent(query)}`
        : `/organizations?communityId=${communityId}`;
  }
}

function orderByFavoriteIds<T extends { id: string }>(items: T[], favoriteIds: string[]) {
  const order = new Map(favoriteIds.map((id, index) => [id, index]));
  return [...items].sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}

function renderBadge(label: string, tone: "slate" | "civic" | "orange" | "emerald" = "slate") {
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

function formatAdMetric(ad: (typeof seededPoliticalAds)[number]) {
  if (typeof ad.totalSpend === "number" && ad.totalSpend > 0) {
    return `$${ad.totalSpend.toLocaleString()}`;
  }

  if (typeof ad.impressions === "number" && ad.impressions > 0) {
    return `${ad.impressions.toLocaleString()} impressions`;
  }

  return null;
}

function getElectionCategory(title: string, officeTitle: string, isCommunityVoteOnly: boolean) {
  const office = `${officeTitle} ${title}`.toLowerCase();

  if (isCommunityVoteOnly || office.includes("student")) return "Student";
  if (office.includes("school")) return "School";
  if (office.includes("judge") || office.includes("justice") || office.includes("court")) return "Judicial";
  if (
    office.includes("governor") ||
    office.includes("president") ||
    office.includes("mayor") ||
    office.includes("sheriff") ||
    office.includes("leader")
  ) {
    return "Leadership";
  }

  return "Legislative";
}

async function getCategoryPreviewItems({
  category,
  user,
  communityId,
  query,
  favoriteIds,
}: {
  category: ExploreCategory;
  user: Awaited<ReturnType<typeof getCurrentUser>>;
  communityId: string;
  query: string;
  favoriteIds?: string[];
}): Promise<ExplorePreviewItem[]> {
  const limit = favoriteIds ? Math.max(favoriteIds.length, 6) : 8;

  switch (category) {
    case "communities": {
      const baseItems = seededCommunities.filter((community) => {
        if (favoriteIds) {
          return favoriteIds.includes(community.id);
        }

        if (query) {
          return matchesQuery(query, community.name, community.shortName, community.descriptor, community.locationLabel ?? "");
        }

        return community.id === communityId || community.scope !== "local";
      });

      const ordered = favoriteIds
        ? orderByFavoriteIds(baseItems, favoriteIds)
        : [
            ...baseItems.filter((community) => community.id === communityId),
            ...baseItems.filter((community) => community.id !== communityId),
          ];

      return ordered.slice(0, limit).map(
        (community) =>
          ({
            id: community.id,
            title: community.name,
            subtitle:
              community.communityType === "campus"
                ? `${community.institutionType} institution${community.locationLabel ? ` · ${community.locationLabel}` : ""}`
                : community.descriptor,
            description:
              community.communityType === "campus"
                ? `Campus community with student-mode visibility and civic discovery support.`
                : community.locationLabel ?? community.descriptor,
            href: community.communityType === "campus" ? `/campuses/${community.id}` : `/my-community?communityId=${community.id}`,
            ctaLabel: community.communityType === "campus" ? "Open campus" : "Open community",
            avatar: {
              name: community.shortName ?? community.name,
              imageUrl: community.imagePath,
              entityType: "community",
            },
            badges: (
              <>
                {renderBadge(community.communityType === "campus" ? "Campus" : community.scope, "civic")}
                {community.shortName ? renderBadge(community.shortName) : null}
              </>
            ),
            favorite: {
              targetType: "community" as const,
              targetId: community.id,
            },
          }) satisfies ExplorePreviewItem,
      );
    }
    case "people": {
      const people = await getPublicPeopleDirectory(user);
      const filtered = favoriteIds
        ? orderByFavoriteIds(people.filter((person) => favoriteIds.includes(person.id)), favoriteIds)
        : query
          ? people.filter((person) => matchesQuery(query, person.name, person.username, person.bio ?? "", person.jurisdictionName))
          : people.filter((person) => communityMatchesMembership(communityId, person));

      return filtered.slice(0, limit).map(
        (person) =>
          ({
            id: person.id,
            title: person.name,
            subtitle: `@${person.username} · ${person.jurisdictionName}`,
            description: person.bio,
            href: `/citizens/${person.id}`,
            ctaLabel: "Open profile",
            avatar: {
              name: person.name,
              imageUrl: person.profileImageUrl,
              entityType: person.role === "trustedCitizen" ? "trustedCitizen" : "citizen",
              verified: person.role === "trustedCitizen",
            },
            badges: (
              <>
                {renderBadge(person.role === "trustedCitizen" ? "Trusted Citizen" : "Citizen", "civic")}
                {person.studentProfile?.studentVerified && person.studentProfile.campusName
                  ? renderBadge(person.studentProfile.campusName, "orange")
                  : null}
              </>
            ),
            favorite: {
              targetType: "person" as const,
              targetId: person.id,
            },
          }) satisfies ExplorePreviewItem,
      );
    }
    case "issues": {
      const issues = await getIssueDirectoryForUser(user, { communityId, query });
      const filtered = favoriteIds
        ? orderByFavoriteIds(issues.filter((issue) => favoriteIds.includes(issue.id)), favoriteIds)
        : issues;

      return filtered.slice(0, limit).map(
        (issue) =>
          ({
            id: issue.id,
            title: issue.issueText,
            subtitle: `${issue.jurisdictionName} · ${issue.scope}`,
            description:
              issue.source === "curated"
                ? "Community-priority issue hub with linked civic content previews."
                : "Community-written issue hub connected to related civic content.",
            href: `/issues/${slugifyIssueText(issue.issueText)}`,
            ctaLabel: "Open issue",
            avatar: {
              name: issue.issueText,
              entityType: "issue",
            },
            badges: (
              <>
                {renderBadge(issue.scope, "civic")}
                {renderBadge(issue.source === "curated" ? "Curated" : "Write-in")}
                {renderBadge(`${issue.upvoteCount} supporters`, "orange")}
              </>
            ),
            favorite: {
              targetType: "issue" as const,
              targetId: issue.id,
            },
          }) satisfies ExplorePreviewItem,
      );
    }
    case "candidates": {
      const candidates = await getCandidateProfiles();
      const filtered = favoriteIds
        ? orderByFavoriteIds(candidates.filter((candidate) => favoriteIds.includes(candidate.id)), favoriteIds)
        : query
          ? candidates.filter((candidate) =>
              matchesQuery(query, candidate.name, candidate.bio ?? "", candidate.jurisdictionName, candidate.partyText ?? ""),
            )
          : candidates.filter((candidate) => communityMatchesJurisdiction(communityId, candidate.jurisdictionName));

      return filtered.slice(0, limit).map(
        (candidate) =>
          ({
            id: candidate.id,
            title: candidate.name,
            subtitle: `${candidate.partyText ?? "Nonpartisan"} · ${candidate.jurisdictionName}`,
            description: candidate.bio,
            href: `/candidates/${candidate.id}`,
            ctaLabel: "Open candidate",
            avatar: {
              name: candidate.name,
              imageUrl: candidate.profileImageUrl,
              entityType: "candidate",
              verified: Boolean(candidate.isClaimed),
            },
            badges: <>{renderBadge("Candidate", "civic")}</>,
            favorite: {
              targetType: "candidate" as const,
              targetId: candidate.id,
            },
          }) satisfies ExplorePreviewItem,
      );
    }
    case "officials": {
      const officials = await getOfficials();
      const filtered = favoriteIds
        ? orderByFavoriteIds(officials.filter((official) => favoriteIds.includes(official.id)), favoriteIds)
        : query
          ? officials.filter((official) =>
              matchesQuery(query, official.name, official.officeTitle, official.bio ?? "", official.jurisdictionName, official.party),
            )
          : officials.filter((official) => communityMatchesJurisdiction(communityId, official.jurisdictionName));

      return filtered.slice(0, limit).map(
        (official) =>
          ({
            id: official.id,
            title: official.name,
            subtitle: `${official.officeTitle} · ${official.jurisdictionName}`,
            description: official.bio,
            href: `/officials/${official.id}`,
            ctaLabel: "Open official",
            avatar: {
              name: official.name,
              imageUrl: official.profileImageUrl,
              entityType: "official",
              verified: true,
            },
            badges: (
              <>
                {renderBadge(official.party)}
                {official.sourceLabel ? renderBadge("Imported Nevada beta data", "emerald") : null}
                {official.followThroughScore ? renderBadge(`Follow-through ${official.followThroughScore}`, "orange") : null}
              </>
            ),
            favorite: {
              targetType: "official" as const,
              targetId: official.id,
            },
          }) satisfies ExplorePreviewItem,
      );
    }
    case "petitions": {
      const petitions = await getAllPetitions();
      const filtered = favoriteIds
        ? orderByFavoriteIds(petitions.filter((petition) => favoriteIds.includes(petition.id)), favoriteIds)
        : query
          ? petitions.filter((petition) =>
              matchesQuery(query, petition.title, petition.summary, petition.jurisdictionName, petition.creatorName),
            )
          : petitions.filter((petition) => communityMatchesJurisdiction(communityId, petition.jurisdictionName));

      return filtered.slice(0, limit).map(
        (petition) =>
          ({
            id: petition.id,
            title: petition.title,
            subtitle: petition.jurisdictionName,
            description: petition.summary,
            href: `/petitions/${petition.id}`,
            ctaLabel: "View petition",
            avatar: {
              name: petition.creatorName,
              entityType: petition.organizationId ? "organization" : "petition",
              verified: Boolean(petition.organizationId),
            },
            badges: (
              <>
                {renderBadge(`${petition.signatureCount.toLocaleString()} signatures`, "civic")}
                {renderBadge(petition.status)}
              </>
            ),
            favorite: {
              targetType: "petition" as const,
              targetId: petition.id,
            },
          }) satisfies ExplorePreviewItem,
      );
    }
    case "cases": {
      const cases = await getAllCases(user);
      const filtered = favoriteIds
        ? orderByFavoriteIds(cases.filter((caseItem) => favoriteIds.includes(caseItem.id)), favoriteIds)
        : query
          ? cases.filter((caseItem) =>
              matchesQuery(query, caseItem.title, caseItem.summary, caseItem.jurisdictionName, ...caseItem.issueTags),
            )
          : cases.filter((caseItem) => communityMatchesJurisdiction(communityId, caseItem.jurisdictionName));

      return filtered.slice(0, limit).map(
        (caseItem) =>
          ({
            id: caseItem.id,
            title: caseItem.title,
            subtitle: `${caseItem.jurisdictionName} · ${caseItem.stage}`,
            description: caseItem.summary,
            href: `/cases/${caseItem.id}`,
            ctaLabel: "View case",
            avatar: {
              name: caseItem.title,
              entityType: caseItem.supportCount > 0 ? "publicAccountability" : "case",
              verified: caseItem.status === "active",
            },
            badges: (
              <>
                {renderBadge(caseItem.status, "orange")}
                {renderBadge(`${caseItem.supportCount} supporting`)}
              </>
            ),
            favorite: {
              targetType: "case" as const,
              targetId: caseItem.id,
            },
          }) satisfies ExplorePreviewItem,
      );
    }
    case "events": {
      const events = await getDiscoverableEventsForUser(user, {
        communityId: favoriteIds ? undefined : query ? undefined : communityId,
        limit,
      });
      const filtered = favoriteIds
        ? orderByFavoriteIds(events.filter((event) => favoriteIds.includes(event.id)), favoriteIds)
        : query
          ? events.filter((event) =>
              matchesQuery(query, event.title, event.description, event.locationLabel ?? "", event.issueLabel ?? "", event.jurisdictionName),
            )
          : events;

      return filtered.slice(0, limit).map(
        (event) =>
          ({
            id: event.id,
            title: event.title,
            subtitle: `${new Date(event.startsAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })} · ${event.jurisdictionName}`,
            description: event.description,
            href: `/events/${event.id}`,
            ctaLabel: "View event",
            avatar: {
              name: event.sponsorName,
              entityType:
                event.sponsorType === "official"
                  ? "official"
                  : event.sponsorType === "candidate"
                    ? "candidate"
                    : event.sponsorType === "trustedCitizen"
                      ? "trustedCitizen"
                      : "community",
              verified: event.sponsorType !== "community",
            },
            badges: (
              <>
                {renderBadge(getCommunityEventTypeLabel(event.eventType), "civic")}
                {renderBadge(`${event.attendanceCount} attending`)}
              </>
            ),
            favorite: {
              targetType: "event" as const,
              targetId: event.id,
            },
          }) satisfies ExplorePreviewItem,
      );
    }
    case "elections": {
      const elections = await getElectionSummaries(user.id);
      const filtered = favoriteIds
        ? orderByFavoriteIds(elections.filter((election) => favoriteIds.includes(election.id)), favoriteIds)
        : query
          ? elections.filter((election) =>
              matchesQuery(query, election.title, election.officeTitle, election.jurisdictionName, election.authorityLabel ?? ""),
            )
          : elections.filter((election) => communityMatchesJurisdiction(communityId, election.jurisdictionName));

      return filtered.slice(0, limit).map(
        (election) =>
          ({
            id: election.id,
            title: election.title,
            subtitle: `${new Date(election.electionDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })} · ${election.jurisdictionName}`,
            description: `${election.officeTitle} · ${election.electionStatus}`,
            href: `/elections/${election.id}`,
            ctaLabel: "View election",
            avatar: {
              name: election.title,
              entityType: "community",
            },
            badges: (
              <>
                {renderBadge(getElectionCategory(election.title, election.officeTitle, Boolean(election.isCommunityVoteOnly)), "civic")}
                {renderBadge(`${election.candidates.length} candidates`)}
              </>
            ),
            favorite: {
              targetType: "election" as const,
              targetId: election.id,
            },
          }) satisfies ExplorePreviewItem,
      );
    }
    case "ads": {
      if (favoriteIds) {
        return [];
      }

      const filtered = query
        ? seededPoliticalAds.filter((ad) =>
            matchesQuery(
              query,
              ad.title,
              ad.description,
              ad.sponsorName,
              ad.paidForBy,
              ad.producedBy,
              ad.geographySummary,
              ad.electionCycle,
              ...ad.entityRelations.map((relation) => relation.entityLabel),
            ),
          )
        : seededPoliticalAds;

      return filtered.slice(0, limit).map((ad) => {
        const metricLabel = formatAdMetric(ad);

        return {
          id: ad.id,
          title: ad.title,
          subtitle: `${ad.sponsorName} · ${POLITICAL_AD_SOURCE_LABELS[ad.sourceType]}`,
          description: ad.description,
          href: `/ads/${ad.id}`,
          ctaLabel: "View ad",
          badges: (
            <>
              {renderBadge(POLITICAL_AD_SOURCE_LABELS[ad.sourceType], "civic")}
              {renderBadge(POLITICAL_AD_SPONSOR_LABELS[ad.sponsorType])}
              {renderBadge(ad.overallSystemRating, ad.overallSystemRating.includes("False") ? "orange" : "emerald")}
              {metricLabel ? renderBadge(metricLabel) : null}
            </>
          ),
        } satisfies ExplorePreviewItem;
      });
    }
    case "organizations": {
      const organizations = await getAllOrganizations(user);
      const filtered = favoriteIds
        ? orderByFavoriteIds(organizations.filter((organization) => favoriteIds.includes(organization.id)), favoriteIds)
        : query
          ? organizations.filter((organization) =>
              matchesQuery(query, organization.name, organization.description, ...organization.issueTags),
            )
          : organizations.filter(
              (organization) => organization.communityId === communityId || organization.campusCommunityId === communityId,
            );

      return filtered.slice(0, limit).map(
        (organization) =>
          ({
            id: organization.id,
            title: organization.name,
            subtitle: organization.jurisdictionName,
            description: organization.description,
            href: `/organizations/${organization.id}`,
            ctaLabel: "View organization",
            avatar: {
              name: organization.name,
              entityType: "organization",
              verified: organization.viewerMembershipState === "approved" || organization.canManage,
            },
            badges: (
              <>
                {renderBadge(getOrganizationTypeLabel(organization.organizationType), "civic")}
                {renderBadge(`${organization.memberCount} members`)}
              </>
            ),
            favorite: {
              targetType: "organization" as const,
              targetId: organization.id,
            },
          }) satisfies ExplorePreviewItem,
      );
    }
  }
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

  const [activeItemsResult, browseItemsResult] = await Promise.allSettled([
    getCategoryPreviewItems({
      category: activeCategory,
      user,
      communityId: selectedCommunityId,
      query: favoritesOnly ? "" : query,
      favoriteIds: favoritesOnly ? (activeFavoriteTargetType ? favoriteIdsByType[activeFavoriteTargetType] : []) : undefined,
    }),
    getCategoryPreviewItems({
      category: activeBrowseCategory,
      user,
      communityId: selectedCommunityId,
      query: "",
    }),
  ]);

  if (activeItemsResult.status === "rejected") {
    console.error("[explore] active category preview failed", {
      category: activeCategory,
      communityId: selectedCommunityId,
      query,
      error: activeItemsResult.reason,
    });
  }

  if (browseItemsResult.status === "rejected") {
    console.error("[explore] browse category preview failed", {
      browseCategory: activeBrowseCategory,
      communityId: selectedCommunityId,
      error: browseItemsResult.reason,
    });
  }

  const activeItems = activeItemsResult.status === "fulfilled" ? activeItemsResult.value : [];
  const browseItems = browseItemsResult.status === "fulfilled" ? browseItemsResult.value : [];

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
      : `Preview-first browsing for ${activeCategoryLabel.toLowerCase()} in and around ${currentCommunity.name}.`;

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Explore"
        title="Find your way in without getting overwhelmed"
        description="Start with one category at a time, browse lightweight previews, and quickly spot what you can vote on before opening the deeper civic layers."
        meta={
          <>
            <span className="rounded-full border border-cyan-300/18 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">{currentCommunity.name}</span>
          </>
        }
      />

      <section className="dd-panel rounded-[1.75rem] p-6">
        <SectionHeading
          eyebrow="Browse"
          title="Preview-first category browsing"
          description="Switch categories to browse lightweight cards without loading full lists across the whole page."
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
            </div>
            <Link
              href={getBrowseHref(activeBrowseCategory, selectedCommunityId, "")}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100"
            >
              View all
            </Link>
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
                    badges={item.badges}
                    favorite={item.favorite}
                    avatar={item.avatar}
                  />
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">
                No {activeBrowseCategoryLabel.toLowerCase()} are available for this browse preview yet.
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
              Switch categories without changing the page structure. Results stay lightweight and preview-first.
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
            const href =
              category.key === "ads"
                ? getBrowseHref("ads", selectedCommunityId, query)
                : buildExploreHref({
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

        <PreserveScrollQueryForm action={activeCategory === "ads" ? "/ads" : "/explore"} className="mt-5 flex flex-wrap gap-3">
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
              {!favoritesOnly ? (
                <Link
                  href={getBrowseHref(activeCategory, selectedCommunityId, query)}
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
                  badges={item.badges}
                  favorite={item.favorite}
                  avatar={item.avatar}
                />
              ))
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400 xl:col-span-2">
                {favoritesOnly
                  ? `No saved ${activeCategoryLabel.toLowerCase()} yet.`
                  : `No ${activeCategoryLabel.toLowerCase()} match “${query}” yet.`}
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
