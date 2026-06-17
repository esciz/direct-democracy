import { getFeedPosts } from "@/lib/feed/posts";
import { getDailyVoteExperience, getStoredVoteResponses, getVotingLibrary } from "@/lib/feed/quick-votes";
import { getAllCases } from "@/lib/cases/store";
import { getCommunityById } from "@/lib/community/communities";
import { getDiscoverableEventsForUser } from "@/lib/community/event-discovery";
import { getAvailableCommunityGroupFilters } from "@/lib/community/groups";
import { getOfficials } from "@/lib/officials/store";
import { getElectionSummaries } from "@/lib/server/elections-context";
import { getTopIssuesForUser } from "@/lib/community/issues";
import { getCommunityFavoritePlaces, getCommunityHero } from "@/lib/community/place-data";
import { communityMatchesMembership } from "@/lib/community/membership";
import { getCreditBalance } from "@/lib/engagement/credits";
import { getOfficialActionsForCommunity } from "@/lib/officials/action-store";
import { getOrganizationsForCommunity } from "@/lib/organizations/store";
import { getAllPetitions } from "@/lib/petitions/store";
import { getPollsForCommunity } from "@/lib/polls/store";
import { getTopVoices, getUserProfileContent } from "@/lib/profile/details";
import { getPublicCitizenProfiles } from "@/lib/profile/visibility";
import { getTopSchoolsForCommunity } from "@/lib/schools/store";
import { getTopServicesForCommunity } from "@/lib/services/store";
import type { AuthUser, PublicCitizenProfileSummary, VoteQuestionCategory, VoteQuestionScope, VoteResponseSummary } from "@/types/domain";

function isRelevantJurisdiction(target: string, communityId: string) {
  const community = getCommunityById(communityId);

  if (!community) {
    return false;
  }

  return community.jurisdictionMatches.includes(target);
}

function mergeResponses(storedResponses: VoteResponseSummary[]) {
  return storedResponses;
}

function getPublicOpinionSnapshot(userId: string, responses: VoteResponseSummary[]) {
  const categoryCounts: Record<VoteQuestionCategory, number> = {
    civic: 0,
    lifestyle: 0,
    identity: 0,
  };

  responses
    .filter((response) => response.userId === userId)
    .forEach((response) => {
      categoryCounts.civic += 1;
    });

  return categoryCounts;
}

function getUserRelevantOfficials(officials: Awaited<ReturnType<typeof getOfficials>>, communityId: string) {
  return officials.filter((official) => isRelevantJurisdiction(official.jurisdictionName, communityId)).slice(0, 4);
}

async function getCommunityPulseQuestions(user: AuthUser, scope: "local" | "state" | "national" | "all") {
  const questions = await getVotingLibrary(user, {
    scope,
  });

  return questions
    .filter((question) => question.totalResponses > 0)
    .sort((a, b) => b.totalResponses - a.totalResponses)
    .slice(0, 3);
}

export async function getMyCommunityData(
  user: AuthUser,
  options: { communityId: string; groupTag?: string } ,
) {
  const community = getCommunityById(options.communityId);
  const communityScope = community?.scope ?? "local";
  const jurisdictionMatches = community?.jurisdictionMatches ?? [];
  const [posts, petitions, elections, officials, publicCitizens, storedVoteResponses, polls, cases] = await Promise.all([
    getFeedPosts("forYou", user.id, { jurisdictionNames: jurisdictionMatches, limit: 4 }),
    getAllPetitions(),
    getElectionSummaries(),
    getOfficials(),
    getPublicCitizenProfiles(user),
    getStoredVoteResponses(),
    getPollsForCommunity(user.id, options.communityId),
    getAllCases(user),
  ]);

  const mergedResponses = mergeResponses(storedVoteResponses);
  const myOfficials = getUserRelevantOfficials(officials, options.communityId);
  const relevantPetitions = petitions
    .filter((petition) => isRelevantJurisdiction(petition.jurisdictionName, options.communityId))
    .slice(0, 3);
  const upcomingElections = elections
    .filter((election) => isRelevantJurisdiction(election.jurisdictionName, options.communityId))
    .slice(0, 3);
  const [topIssues, communityDailyVotes, topVoices, currentProfileContent, creditBalance] = await Promise.all([
    getTopIssuesForUser(user, communityScope, options.communityId),
    getDailyVoteExperience(user, options.communityId),
    getTopVoices(user, options.communityId, communityScope, options.groupTag),
    getUserProfileContent(user.id),
    getCreditBalance(user.id),
  ]);
  const [officialActions, organizations] = await Promise.all([
    getOfficialActionsForCommunity(options.communityId, user.id, 3),
    getOrganizationsForCommunity(user, options.communityId, options.groupTag),
  ]);
  const relevantCases = cases
    .filter((caseItem) => isRelevantJurisdiction(caseItem.jurisdictionName, options.communityId))
    .slice(0, 2);
  const favoritePlaces = await getCommunityFavoritePlaces(options.communityId);
  const schools = getTopSchoolsForCommunity(options.communityId, 3);
  const services = getTopServicesForCommunity(options.communityId, 5);
  const publicCitizenCards: PublicCitizenProfileSummary[] = publicCitizens
    .filter((citizen) => communityMatchesMembership(options.communityId, citizen))
    .filter((citizen) =>
      options.groupTag
        ? citizen.groupTags.includes(options.groupTag) ||
          citizen.groupAffiliations.some((group) => group.name === options.groupTag)
        : true,
    )
    .slice(0, 4)
    .map((citizen) => ({
      ...citizen,
      publicOpinionSummary: {
        totalVotes: citizen.publicOpinionSummary.totalVotes,
        categoryCounts: getPublicOpinionSnapshot(citizen.id, mergedResponses),
      },
    }));
  const scopedPosts = posts.slice(0, 4);
  const [scopedEvents, availableGroups] = await Promise.all([
    getDiscoverableEventsForUser(user, { communityId: options.communityId, scope: communityScope, limit: 4 }),
    Promise.resolve(getAvailableCommunityGroupFilters(options.communityId)),
  ]);
  const selectedGroupTag = options.groupTag;
  const filteredTopVoices = selectedGroupTag
    ? topVoices.filter(
        (voice) =>
          voice.groupTags.includes(selectedGroupTag) ||
          voice.groupAffiliations.some((group) => group.name === selectedGroupTag),
      )
    : topVoices;

  return {
    voting: {
      ...communityDailyVotes,
    },
    posts: scopedPosts,
    petitions: relevantPetitions,
    polls,
    events: scopedEvents.slice(0, 4),
    officials: myOfficials,
    citizens: publicCitizenCards,
    elections: upcomingElections,
    topIssues: topIssues.slice(0, 4),
    topVoices: filteredTopVoices.slice(0, 6),
    availableGroupTags: availableGroups.map((group) => group.name),
    availableGroups,
    creditBalance,
    bookmarkedScopes: currentProfileContent.bookmarkedScopes,
    communityHero: getCommunityHero(options.communityId),
    favoritePlaces,
    schools,
    services,
    officialActions,
    organizations,
    cases: relevantCases,
    community,
  };
}

export async function getCommunityPulsePageData(user: AuthUser, scope: VoteQuestionScope | "all" = "all") {
  const dailyVotes = await getDailyVoteExperience(user);
  const filteredQuestions = await getVotingLibrary(user, { scope });

  return {
    questions: filteredQuestions
      .filter((question) => question.totalResponses > 0)
      .sort((a, b) => b.totalResponses - a.totalResponses),
    progress: dailyVotes.progress,
  };
}
