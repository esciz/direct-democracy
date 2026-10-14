import { seedUsers } from "@/lib/auth/mock-users";
import { getCommunityById, getDefaultCommunityForJurisdiction } from "@/lib/community/communities";
import { getIssueRelatedEventCount } from "@/lib/community/events";
import { getIssueRelatedGroups } from "@/lib/community/groups";
import { getStructuredValueText, getTopVoices, getUserProfileContent } from "@/lib/profile/details";
import { getFavoriteSpotCategoryLabel } from "@/lib/profile/options";
import { getVotingLibrary } from "@/lib/feed/quick-votes";
import { getAllPetitions } from "@/lib/petitions/store";
import { getPollsForCommunity } from "@/lib/polls/store";
import { withBoundedFallback } from "@/lib/server/async-fallback";
import type {
  AuthUser,
  CommunityFavoritePlaceSummary,
  CommunitySummary,
  FavoriteSpotType,
  IssueComparisonRow,
  IssuePrioritySummary,
  VoteQuestionScope,
} from "@/types/domain";

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function titleFromNormalized(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3);
}

function getComparisonCommunityId(scope: VoteQuestionScope) {
  if (scope === "national") {
    return "united-states";
  }

  if (scope === "state") {
    return "nevada";
  }

  return "carson-city";
}

function matchesCommunity(jurisdictionName: string, community: CommunitySummary) {
  return community.jurisdictionMatches.includes(jurisdictionName);
}

async function getRelevantUsers(communityId: string) {
  const community = getCommunityById(communityId);

  if (!community) {
    return [];
  }

  return seedUsers.filter((user) => user.role !== "admin" && matchesCommunity(user.jurisdictionName, community));
}

async function aggregateIssuesForCommunity(
  communityId: string,
  scope: VoteQuestionScope,
): Promise<{
  totals: Map<string, { label: string; count: number }>;
  userCount: number;
}> {
  const users = await getRelevantUsers(communityId);
  const totals = new Map<string, { label: string; count: number }>();

  for (const user of users) {
    const content = await getUserProfileContent(user.id);
    const issues =
      scope === "local"
        ? content.localIssues
        : scope === "state"
          ? content.stateIssues
          : content.nationalIssues;

    for (const issue of issues) {
      const label = getStructuredValueText(issue);
      const key = normalizeText(label);
      const existing = totals.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        totals.set(key, {
          label,
          count: 1,
        });
      }
    }
  }

  return {
    totals,
    userCount: users.length,
  };
}

export async function getCommunityIssuePriorities(viewer: AuthUser, communityId: string, scope: VoteQuestionScope) {
  const community = getCommunityById(communityId) ?? getDefaultCommunityForJurisdiction(viewer.jurisdictionName);
  const { totals, userCount } = await aggregateIssuesForCommunity(community.id, scope);
  const rankedEntries = [...totals.entries()].sort((a, b) => {
    if (b[1].count !== a[1].count) {
      return b[1].count - a[1].count;
    }

    return a[1].label.localeCompare(b[1].label);
  });

  const [petitions, polls, questions, topVoices] = await Promise.all([
    withBoundedFallback(getAllPetitions(), [], { label: "community petitions", timeoutMs: 900 }),
    withBoundedFallback(getPollsForCommunity(viewer.id, community.id, 20), [], {
      label: "community polls",
      timeoutMs: 900,
    }),
    withBoundedFallback(getVotingLibrary(viewer, { scope: "all", category: "all", objectType: "all" }), [], {
      label: "community voting questions",
      timeoutMs: 900,
    }),
    withBoundedFallback(getTopVoices(viewer, community.id, scope), [], {
      label: "community top voices",
      timeoutMs: 900,
    }),
  ]);

  const priorities: IssuePrioritySummary[] = await Promise.all(
    rankedEntries.map(async ([normalizedKey, value], index) => {
      const issueTokens = tokenize(value.label);
      const relatedPetition =
        petitions
          .filter((petition) => matchesCommunity(petition.jurisdictionName, community))
          .find((petition) => {
            const petitionTokens = new Set(tokenize(`${petition.title} ${petition.summary}`));
            return issueTokens.some((token) => petitionTokens.has(token));
          }) ?? null;
      const relatedPollCount = polls.filter((poll) => {
        const pollTokens = new Set(tokenize(poll.question));
        return issueTokens.some((token) => pollTokens.has(token));
      }).length;
      const relatedQuestionCount = questions.filter((question) => {
        if (!community.jurisdictionMatches.includes(question.jurisdictionName)) {
          return false;
        }

        const questionTokens = new Set(tokenize(question.questionText));
        return issueTokens.some((token) => questionTokens.has(token));
      }).length;
      const topVoiceMatches = topVoices
        .filter((voice) => voice.topIssuesPreview.some((issue) => normalizeText(issue) === normalizedKey))
        .slice(0, 2)
        .map((voice) => ({ id: voice.id, name: voice.name }));
      const relatedEventCount = await withBoundedFallback(getIssueRelatedEventCount(community.id, value.label), 0, {
        label: `community event count for ${value.label}`,
        timeoutMs: 700,
      });

      return {
      label: value.label,
      normalizedKey,
      rank: index + 1,
      count: value.count,
      percentage: userCount ? Math.round((value.count / userCount) * 100) : 0,
      relatedPetitionId: relatedPetition?.id ?? null,
      relatedPetitionTitle: relatedPetition?.title ?? null,
      relatedQuestionCount,
      relatedPollCount,
      relatedEventCount,
      relatedGroups: getIssueRelatedGroups(community.id, value.label),
      topVoiceMatches,
      };
    }),
  );

  return {
    community,
    scope,
    userCount,
    priorities,
  };
}

export async function getCommunityIssueComparison(
  viewer: AuthUser,
  communityId: string,
  scope: VoteQuestionScope,
  selectedData?: Awaited<ReturnType<typeof getCommunityIssuePriorities>>,
) {
  const selected = selectedData ?? (await getCommunityIssuePriorities(viewer, communityId, scope));
  const [stateData, nationalData] = await Promise.all([
    aggregateIssuesForCommunity("nevada", "state"),
    aggregateIssuesForCommunity("united-states", "national"),
  ]);

  const rows: IssueComparisonRow[] = selected.priorities.slice(0, 5).map((issue) => {
    const stateCount = stateData.totals.get(issue.normalizedKey)?.count ?? 0;
    const nationalCount = nationalData.totals.get(issue.normalizedKey)?.count ?? 0;

    return {
      label: issue.label,
      selectedCommunityPercentage: issue.percentage,
      statePercentage: stateData.userCount ? Math.round((stateCount / stateData.userCount) * 100) : 0,
      nationalPercentage: nationalData.userCount ? Math.round((nationalCount / nationalData.userCount) * 100) : 0,
    };
  });

  return rows;
}

export async function getCommunityPopularPlaces(
  communityId: string,
  category: FavoriteSpotType | "all" = "all",
): Promise<CommunityFavoritePlaceSummary[]> {
  const users = await getRelevantUsers(communityId);
  const placeMap = new Map<string, CommunityFavoritePlaceSummary>();

  for (const user of users) {
    const content = await getUserProfileContent(user.id);

    for (const spot of content.favoriteSpots) {
      if (category !== "all" && spot.category !== category) {
        continue;
      }

      const key = `${normalizeText(spot.name)}:${spot.category}`;
      const existing = placeMap.get(key);

      if (existing) {
        existing.popularityCount += 1;
        if (!existing.contributorNames.includes(user.name)) {
          existing.contributorNames.push(user.name);
        }
      } else {
        placeMap.set(key, {
          name: spot.name,
          type: spot.category,
          popularityCount: 1,
          contributorNames: [user.name],
        });
      }
    }
  }

  return [...placeMap.values()].sort((a, b) => {
    if (b.popularityCount !== a.popularityCount) {
      return b.popularityCount - a.popularityCount;
    }

    return a.name.localeCompare(b.name);
  });
}

export function getPlaceCategoryTabs(communityId: string, selectedCategory: FavoriteSpotType | "all") {
  const categories: Array<{ value: FavoriteSpotType | "all"; label: string }> = [
    { value: "all", label: "All places" },
    { value: "restaurant", label: getFavoriteSpotCategoryLabel("restaurant") },
    { value: "bar", label: getFavoriteSpotCategoryLabel("bar") },
    { value: "coffeeShop", label: getFavoriteSpotCategoryLabel("coffeeShop") },
    { value: "park", label: getFavoriteSpotCategoryLabel("park") },
    { value: "hikeOutdoor", label: getFavoriteSpotCategoryLabel("hikeOutdoor") },
    { value: "museumCulture", label: getFavoriteSpotCategoryLabel("museumCulture") },
    { value: "activityEntertainment", label: getFavoriteSpotCategoryLabel("activityEntertainment") },
  ];

  return categories.map((category) => ({
    label: category.label,
    href: `/community-priorities?communityId=${communityId}&placeCategory=${category.value}`,
    active: selectedCategory === category.value,
  }));
}
