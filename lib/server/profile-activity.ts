import "server-only";

import { getPublicEndorsementsForUser } from "@/lib/candidates/endorsements";
import { getPublicCaseContributionsForUser } from "@/lib/cases/store";
import { getAllCommunityEvents } from "@/lib/community/events";
import { getRecommendedDebatesForUser } from "@/lib/debates/recommendations";
import { getAllDebatesForTrust } from "@/lib/debates/store";
import { getCreatedPosts } from "@/lib/feed/posts";
import { mockPosts } from "@/lib/mock-data";
import { getContentDetailHref } from "@/lib/news/links";
import { getAllPetitions } from "@/lib/petitions/store";
import type { DebateRecommendationSummary } from "@/types/domain";

export type CivicActivityKind =
  | "post"
  | "petition"
  | "event"
  | "debate"
  | "interview"
  | "endorsement"
  | "caseContribution";

export type CivicActivityItem = {
  id: string;
  kind: CivicActivityKind;
  title: string;
  href: string;
  createdAt: string;
  meta: string;
};

export type SafeCivicActivitySummary = {
  counts: Record<CivicActivityKind, number>;
  recentItems: CivicActivityItem[];
};

export type CivicActivityCollection = SafeCivicActivitySummary & {
  allItems: CivicActivityItem[];
  recommendedDebates: DebateRecommendationSummary[];
};

function kindLabel(kind: CivicActivityKind) {
  switch (kind) {
    case "post":
      return "Post";
    case "petition":
      return "Petition";
    case "event":
      return "Event";
    case "debate":
      return "Debate";
    case "interview":
      return "Citizen Interview";
    case "endorsement":
      return "Endorsement";
    case "caseContribution":
      return "Case Contribution";
    default:
      return "Activity";
  }
}

function getPostPreviewTitle(title: string | undefined, fallbackContent: string) {
  const normalizedTitle = title?.trim();

  if (normalizedTitle) {
    return normalizedTitle;
  }

  const snippet = fallbackContent.trim();
  return snippet.length > 72 ? `${snippet.slice(0, 72).trimEnd()}...` : snippet || "Untitled post";
}

export async function getUserCivicActivityCollection(userId: string): Promise<CivicActivityCollection> {
  const [
    postsResult,
    petitionsResult,
    eventsResult,
    debatesResult,
    endorsementsResult,
    caseContributionsResult,
    recommendedDebatesResult,
  ] = await Promise.allSettled([
    getCreatedPosts(),
    getAllPetitions(),
    getAllCommunityEvents(),
    getAllDebatesForTrust(),
    getPublicEndorsementsForUser(userId),
    getPublicCaseContributionsForUser(userId),
    getRecommendedDebatesForUser(userId, { limit: 3 }),
  ]);

  const posts = [...(postsResult.status === "fulfilled" ? postsResult.value : []), ...mockPosts].filter((post) => post.authorId === userId);
  const petitions = (petitionsResult.status === "fulfilled" ? petitionsResult.value : []).filter((petition) => petition.creatorId === userId);
  const events = (eventsResult.status === "fulfilled" ? eventsResult.value : []).filter((event) => event.sponsorUserId === userId);
  const debates = (debatesResult.status === "fulfilled" ? debatesResult.value : []).filter((debate) => debate.createdByUserId === userId);
  const endorsements = endorsementsResult.status === "fulfilled" ? endorsementsResult.value : [];
  const caseContributions = caseContributionsResult.status === "fulfilled" ? caseContributionsResult.value : [];

  const interviewPosts = posts.filter((post) => post.contentType === "interview");
  const standardPosts = posts.filter((post) => post.contentType !== "interview");

  const allItems = [
    ...standardPosts.map((post) => ({
      id: post.id,
      kind: "post" as const,
      title: getPostPreviewTitle(post.title, post.content),
      href: getContentDetailHref(post),
      createdAt: post.createdAt,
      meta: `${post.contentType === "newsStory" ? "News Story" : kindLabel("post")} · ${post.jurisdictionName}`,
    })),
    ...interviewPosts.map((post) => ({
      id: post.id,
      kind: "interview" as const,
      title: getPostPreviewTitle(post.title, post.content),
      href: `/posts/${post.id}`,
      createdAt: post.createdAt,
      meta: `${kindLabel("interview")} · ${post.jurisdictionName}`,
    })),
    ...petitions.map((petition) => ({
      id: petition.id,
      kind: "petition" as const,
      title: petition.title,
      href: `/petitions/${petition.id}`,
      createdAt: petition.createdAt,
      meta: `${kindLabel("petition")} · ${petition.jurisdictionName}`,
    })),
    ...events.map((event) => ({
      id: event.id,
      kind: "event" as const,
      title: event.title,
      href: `/events/${event.id}`,
      createdAt: event.startsAt,
      meta: `${kindLabel("event")} · ${event.jurisdictionName}`,
    })),
    ...debates.map((debate) => ({
      id: debate.id,
      kind: "debate" as const,
      title: debate.title,
      href: `/debates/${debate.id}`,
      createdAt: debate.createdAt,
      meta: `${kindLabel("debate")} · ${debate.jurisdictionName}`,
    })),
    ...endorsements.map((endorsement) => ({
      id: endorsement.id,
      kind: "endorsement" as const,
      title: `${endorsement.candidateName} for ${endorsement.officeSought}`,
      href: `/candidates/${endorsement.candidateCampaignId}`,
      createdAt: endorsement.createdAt,
      meta: `${kindLabel("endorsement")} · ${endorsement.electionTitle}`,
    })),
    ...caseContributions.map((contribution) => ({
      id: contribution.id,
      kind: "caseContribution" as const,
      title: contribution.caseTitle,
      href: contribution.caseHref,
      createdAt: contribution.createdAt,
      meta: `${kindLabel("caseContribution")} · Public support statement`,
    })),
  ]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return {
    counts: {
      post: standardPosts.length,
      petition: petitions.length,
      event: events.length,
      debate: debates.length,
      interview: interviewPosts.length,
      endorsement: endorsements.length,
      caseContribution: caseContributions.length,
    },
    recentItems: allItems.slice(0, 2),
    allItems,
    recommendedDebates: recommendedDebatesResult.status === "fulfilled" ? recommendedDebatesResult.value : [],
  };
}

export async function getSafeCivicActivitySummary(userId: string): Promise<SafeCivicActivitySummary> {
  const { counts, recentItems } = await getUserCivicActivityCollection(userId);
  return {
    counts,
    recentItems,
  };
}
