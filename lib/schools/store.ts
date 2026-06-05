import { getCommunityById } from "@/lib/community/communities";
import { getCommunityEvents } from "@/lib/community/events";
import { getIssueTrendData } from "@/lib/community/trends";
import { getOfficials } from "@/lib/officials/store";
import { getFeedPosts } from "@/lib/feed/posts";
import { getVotingLibrary } from "@/lib/feed/quick-votes";
import { getTopIssuesForUser } from "@/lib/community/issues";
import { mockVoteQuestions } from "@/lib/mock-data";
import { getAllPetitions } from "@/lib/petitions/store";
import { getPollsForCommunity } from "@/lib/polls/store";
import type { AuthUser, SchoolDetail, SchoolSummary } from "@/types/domain";

const seededSchools: SchoolSummary[] = [
  {
    id: "school_carson_high",
    name: "Carson High School",
    district: "Carson City School District",
    gradeLevels: ["9", "10", "11", "12"],
    jurisdictionId: "jurisdiction_carson_city",
    jurisdictionName: "Carson City, Nevada",
    communityId: "carson-city",
    enrollment: 2280,
    studentTeacherRatio: 20.4,
    createdAt: "2026-02-12T12:00:00.000Z",
    relatedOfficialIds: ["profile_helen_cho", "profile_elena_ramirez", "profile_naomi_bishop"],
  },
  {
    id: "school_eagle_valley_middle",
    name: "Eagle Valley Middle School",
    district: "Carson City School District",
    gradeLevels: ["6", "7", "8"],
    jurisdictionId: "jurisdiction_carson_city",
    jurisdictionName: "Carson City, Nevada",
    communityId: "carson-city",
    enrollment: 910,
    studentTeacherRatio: 18.1,
    createdAt: "2026-02-12T12:10:00.000Z",
    relatedOfficialIds: ["profile_helen_cho", "profile_elena_ramirez"],
  },
  {
    id: "school_bordewich_bray",
    name: "Bordewich Bray Elementary School",
    district: "Carson City School District",
    gradeLevels: ["K", "1", "2", "3", "4", "5"],
    jurisdictionId: "jurisdiction_carson_city",
    jurisdictionName: "Carson City, Nevada",
    communityId: "carson-city",
    enrollment: 420,
    studentTeacherRatio: 16.3,
    createdAt: "2026-02-12T12:20:00.000Z",
    relatedOfficialIds: ["profile_helen_cho", "profile_elena_ramirez"],
  },
  {
    id: "school_reno_high",
    name: "Reno High School",
    district: "Washoe County School District",
    gradeLevels: ["9", "10", "11", "12"],
    jurisdictionId: "jurisdiction_washoe",
    jurisdictionName: "Washoe County, Nevada",
    communityId: "reno",
    enrollment: 1710,
    studentTeacherRatio: 21.7,
    createdAt: "2026-02-12T12:30:00.000Z",
    relatedOfficialIds: ["profile_david_park", "profile_aaron_hale", "profile_naomi_bishop"],
  },
];

const SCHOOL_KEYWORDS = [
  "school",
  "schools",
  "teacher",
  "teachers",
  "classroom",
  "education",
  "student",
  "students",
  "staffing",
  "parent",
  "mental health",
];

function normalize(value: string) {
  return value.toLowerCase();
}

function includesSchoolSignal(value: string) {
  const haystack = normalize(value);
  return SCHOOL_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function matchesCommunity(jurisdictionName: string, communityId: string) {
  const community = getCommunityById(communityId);

  if (!community) {
    return false;
  }

  return community.jurisdictionMatches.includes(jurisdictionName);
}

export function getAllSchools() {
  return seededSchools;
}

export function getSchoolsForCommunity(communityId: string) {
  return seededSchools.filter((school) => matchesCommunity(school.jurisdictionName, communityId));
}

export function getTopSchoolsForCommunity(communityId: string, limit = 3) {
  return getSchoolsForCommunity(communityId).slice(0, limit);
}

export async function getSchoolById(user: AuthUser, schoolId: string): Promise<SchoolDetail | null> {
  const school = seededSchools.find((entry) => entry.id === schoolId);

  if (!school) {
    return null;
  }

  const [questions, topIssues, petitions, posts, polls, officials, events] = await Promise.all([
    getVotingLibrary(user, { scope: "all" }),
    getTopIssuesForUser(user, "all", school.communityId),
    getAllPetitions(),
    getFeedPosts(),
    getPollsForCommunity(user.id, school.communityId),
    getOfficials(),
    getCommunityEvents(school.communityId),
  ]);

  const relatedOfficials = officials.filter(
    (official) => school.relatedOfficialIds.includes(official.id) || official.officeTitle.toLowerCase().includes("school"),
  );
  const schoolQuestions = questions
    .filter(
      (question) =>
        question.jurisdictionName === school.jurisdictionName &&
        includesSchoolSignal(`${question.questionText} ${question.jurisdictionName}`),
    )
    .slice(0, 3);
  const relatedPolls = polls
    .filter((poll) => includesSchoolSignal(`${poll.question} ${poll.jurisdictionName}`))
    .slice(0, 2);
  const relatedPetitions = petitions
    .filter(
      (petition) =>
        petition.jurisdictionName === school.jurisdictionName &&
        includesSchoolSignal(`${petition.title} ${petition.summary}`),
    )
    .slice(0, 3);
  const relatedPosts = posts
    .filter(
      (post) =>
        post.jurisdictionName === school.jurisdictionName &&
        includesSchoolSignal(`${post.title ?? ""} ${post.content}`),
    )
    .slice(0, 3);
  const relatedEvents = events
    .filter((event) => includesSchoolSignal(`${event.title} ${event.description} ${event.issueLabel ?? ""}`))
    .slice(0, 3);
  const schoolIssues = topIssues
    .filter((issue) => includesSchoolSignal(issue.issueText))
    .slice(0, 3);
  const issueTrends = getIssueTrendData(school.communityId, "local").filter((trend) => includesSchoolSignal(trend.issue)).slice(0, 3);

  return {
    ...school,
    schoolQuestions,
    relatedPolls,
    topIssues: schoolIssues,
    issueTrends,
    relatedPetitions,
    relatedPosts,
    relatedEvents,
    relatedOfficials,
  };
}
