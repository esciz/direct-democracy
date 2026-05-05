import { getFeedPosts } from "@/lib/feed/posts";
import { getTopIssuesForUser } from "@/lib/community/issues";
import { getCurrentUser } from "@/lib/server/auth-session";
import { canonicalizeIssueTags } from "@/lib/issues/utils";
import type { BallotInitiativeSummary } from "@/types/domain";

const seededBallotInitiatives: BallotInitiativeSummary[] = [
  {
    id: "initiative_carson_livestream_2026",
    slug: "carson-city-public-meeting-livestreaming",
    title: "Require Carson City public meetings to be livestreamed and archived",
    summary: "Would require regular Carson City public meetings to be livestreamed live and archived online within a set timeframe.",
    jurisdictionName: "Carson City, Nevada",
    scope: "local",
    electionId: "election_carson_mayor_2026",
    officialLanguage:
      "Shall Carson City be required to provide livestream access and archive recordings of regular public meetings on a publicly accessible website within seven calendar days?",
    communitySentiment: { support: 61, oppose: 22, unclear: 17 },
    relatedIssues: ["Government transparency", "Public meeting access", "Budget clarity"],
    relatedDiscussionPostIds: ["post_5", "post_8"],
    createdAt: "2026-03-18T09:00:00.000Z",
  },
  {
    id: "initiative_nevada_finance_2026",
    slug: "nevada-campaign-finance-transparency",
    title: "Increase transparency in Nevada campaign finance reporting",
    summary: "Would require more frequent public reporting windows and a simpler statewide disclosure interface for campaign finance activity.",
    jurisdictionName: "Nevada",
    scope: "state",
    electionId: "election_nevada_governor_2026",
    officialLanguage:
      "Shall Nevada require campaign committees to report contributions and major expenditures on an expanded schedule and publish those records in a standardized, searchable public format?",
    communitySentiment: { support: 58, oppose: 25, unclear: 17 },
    relatedIssues: ["Government transparency", "Campaign finance", "Public trust"],
    relatedDiscussionPostIds: ["post_8", "post_12"],
    createdAt: "2026-03-20T11:00:00.000Z",
  },
];

export function getBallotInitiativesForElection(electionId: string) {
  return seededBallotInitiatives
    .filter((initiative) => initiative.electionId === electionId)
    .map((initiative) => ({ ...initiative, relatedIssues: canonicalizeIssueTags(initiative.relatedIssues) }));
}

export function getBallotInitiativeById(initiativeId: string) {
  const initiative = seededBallotInitiatives.find((entry) => entry.id === initiativeId || entry.slug === initiativeId) ?? null;
  return initiative ? { ...initiative, relatedIssues: canonicalizeIssueTags(initiative.relatedIssues) } : null;
}

export async function getBallotInitiativeRelatedPosts(initiativeId: string) {
  const initiative = getBallotInitiativeById(initiativeId);

  if (!initiative) {
    return [];
  }

  try {
    const viewer = await getCurrentUser();
    const posts = await getFeedPosts("forYou", viewer.id);
    return posts.filter((post) => initiative.relatedDiscussionPostIds.includes(post.id));
  } catch {
    return [];
  }
}

export async function getBallotInitiativeRelatedIssues(initiativeId: string) {
  const initiative = getBallotInitiativeById(initiativeId);

  if (!initiative) {
    return [];
  }

  try {
    const viewer = await getCurrentUser();
    return (
      await getTopIssuesForUser(viewer, initiative.scope, initiative.scope === "local" ? "carson-city" : "nevada")
    )
      .filter((issue) => initiative.relatedIssues.some((label) => issue.issueText.toLowerCase().includes(label.toLowerCase()) || label.toLowerCase().includes(issue.issueText.toLowerCase())))
      .slice(0, 3);
  } catch {
    return [];
  }
}
