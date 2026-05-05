import "server-only";

import { seedUsers } from "@/lib/auth/mock-users";
import type { FeedViewerContext } from "@/lib/auth/session";
import { getCommunityById } from "@/lib/community/communities";
import type { FeedEventPreview } from "@/lib/community/events";
import type { DebateFeedPreview } from "@/lib/debates/store";
import type { MediaFeedPreview } from "@/lib/media/store";
import { getContentDetailHref, getNewsStoryHref } from "@/lib/news/links";
import type { FeedPetitionPreview } from "@/lib/petitions/store";
import { getUserProfileContent } from "@/lib/profile/details";
import { getFollowedUserIds } from "@/lib/social/follows";
import { getFollowedCommunityIds } from "@/lib/server/community-context";
import type { PostSummary } from "@/types/domain";

export type CivicBriefCadence = "daily" | "weekly" | "monthly";

export type CivicBriefItem = {
  id: string;
  href: string;
  title: string;
  detail: string;
  label: string;
  reason: string;
};

export type CivicBriefSummary = {
  cadence: CivicBriefCadence;
  headline: string;
  intro: string;
  keyDevelopments: CivicBriefItem[];
  responses: CivicBriefItem[];
  momentum: CivicBriefItem[];
  attention: CivicBriefItem | null;
  stakesLine: string | null;
  personalization: {
    topIssues: string[];
    followedPeopleCount: number;
    followedCommunityNames: string[];
  };
};

type BriefSource = CivicBriefItem & {
  createdAt: string;
  kind: "post" | "news" | "petition" | "debate" | "event";
  score: number;
};

type CivicBriefInput = {
  viewer: FeedViewerContext;
  posts: PostSummary[];
  petitions: FeedPetitionPreview[];
  debates: DebateFeedPreview[];
  media: MediaFeedPreview[];
  events: FeedEventPreview[];
  cadence: CivicBriefCadence;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function matchesIssues(haystack: string, issues: string[]) {
  if (!issues.length) {
    return false;
  }

  const tokens = new Set(normalizeText(haystack));
  return issues.some((issue) => normalizeText(issue).some((token) => tokens.has(token)));
}

function cadenceWindowDays(cadence: CivicBriefCadence) {
  if (cadence === "daily") return 1;
  if (cadence === "monthly") return 30;
  return 7;
}

function cadencePhrase(cadence: CivicBriefCadence) {
  if (cadence === "daily") return "today";
  if (cadence === "monthly") return "this month";
  return "this week";
}

function isPublicActorRole(role: PostSummary["authorRole"] | undefined) {
  return role === "candidate" || role === "official" || role === "trustedCitizen";
}

function getPrimaryFocus(topIssues: string[]) {
  return topIssues[0] ?? "your civic world";
}

function isRelevantDate(value: string, cadence: CivicBriefCadence) {
  const ageMs = Math.abs(Date.now() - Date.parse(value));
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays <= cadenceWindowDays(cadence) * 3;
}

function relativeScore(value: string, cadence: CivicBriefCadence) {
  const ageMs = Math.abs(Date.now() - Date.parse(value));
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const windowDays = cadenceWindowDays(cadence);

  if (ageDays > windowDays * 3) {
    return 0;
  }

  return Math.max(0, Math.round(14 - (ageDays / Math.max(windowDays, 1)) * 10));
}

function pickHeadline(items: BriefSource[], topIssues: string[], cadence: CivicBriefCadence) {
  const focusLabel = getPrimaryFocus(topIssues);

  if (!items.length) {
    return `A quieter read across ${focusLabel} ${cadencePhrase(cadence)}.`;
  }

  if (items.some((item) => item.kind === "news") && items.some((item) => item.kind === "event")) {
    return `${focusLabel} is being shaped by new reporting and public developments ${cadencePhrase(cadence)}.`;
  }

  if (items.some((item) => item.kind === "petition") && items.some((item) => item.kind === "debate")) {
    return `${focusLabel} is moving through both public momentum and debate ${cadencePhrase(cadence)}.`;
  }

  if (items.some((item) => item.kind === "event")) {
    return `${focusLabel} has visible public movement ${cadencePhrase(cadence)}.`;
  }

  if (items.some((item) => item.kind === "news")) {
    return `${focusLabel} picked up fresh civic context ${cadencePhrase(cadence)}.`;
  }

  return `${focusLabel} is the clearest civic signal in your world ${cadencePhrase(cadence)}.`;
}

function buildIntro(items: BriefSource[], topIssues: string[], cadence: CivicBriefCadence) {
  if (!items.length) {
    return `A lighter civic window ${cadencePhrase(cadence)}. The feed below still has the latest activity, but fewer high-signal developments match your current focus.`;
  }

  const focusLabel = getPrimaryFocus(topIssues);
  const hasNews = items.some((item) => item.kind === "news");
  const hasEvents = items.some((item) => item.kind === "event");
  const hasPetitions = items.some((item) => item.kind === "petition");
  const hasDebates = items.some((item) => item.kind === "debate");
  const hasPublicResponses = items.some((item) => item.kind === "post" && item.label === "Response");

  if (hasNews && hasEvents && hasPublicResponses) {
    return `${focusLabel} is being shaped by fresh reporting, public developments, and visible responses from civic actors ${cadencePhrase(cadence)}.`;
  }

  if (hasNews && hasEvents) {
    return `A quick read on the stories, meetings, and public developments shaping ${focusLabel} ${cadencePhrase(cadence)}.`;
  }

  if (hasPetitions || hasDebates) {
    return `A quick read on where momentum is building around ${focusLabel}, how public discussion is shifting, and what may matter next ${cadencePhrase(cadence)}.`;
  }

  return `A quick read on what is shaping discussion around your issues, jurisdictions, and followed public figures ${cadencePhrase(cadence)}.`;
}

function buildStakesLine(items: BriefSource[], topIssues: string[]) {
  const focusLabel = getPrimaryFocus(topIssues);
  const hasPetition = items.some((item) => item.kind === "petition");
  const hasDebate = items.some((item) => item.kind === "debate");
  const hasEvent = items.some((item) => item.kind === "event");
  const hasResponse = items.some((item) => item.kind === "post" && item.label === "Response");

  if (hasPetition && hasResponse) {
    return `${focusLabel} is no longer just being discussed. People are organizing around it and public figures are having to answer.`;
  }

  if (hasDebate && hasEvent) {
    return `${focusLabel} has both public argument and live civic follow-through right now.`;
  }

  if (hasDebate) {
    return `${focusLabel} is actively contested right now, not just passively tracked.`;
  }

  if (hasEvent || hasResponse) {
    return `${focusLabel} has visible public movement and response right now.`;
  }

  return null;
}

export async function getCivicBrief(input: CivicBriefInput): Promise<CivicBriefSummary> {
  const [profileContent, followedUserIds, followedCommunityIds] = await Promise.all([
    getUserProfileContent(input.viewer.id).catch(() => null),
    getFollowedUserIds(input.viewer.id).catch((): string[] => []),
    getFollowedCommunityIds().catch((): string[] => []),
  ]);

  const topIssues = profileContent
    ? [...profileContent.localIssues, ...profileContent.stateIssues, ...profileContent.nationalIssues]
        .map((issue) => issue.value)
        .filter(Boolean)
        .slice(0, 4)
    : [];
  const followedSourceNames = new Set(seedUsers.filter((user) => followedUserIds.includes(user.id)).map((user) => user.name));
  const followedCommunityNames = followedCommunityIds
    .map((communityId) => getCommunityById(communityId)?.name)
    .filter((value): value is string => Boolean(value))
    .slice(0, 3);
  const followedJurisdictions = new Set(
    followedCommunityIds
      .map((communityId) => getCommunityById(communityId))
      .flatMap((community) => (community ? community.jurisdictionMatches : [])),
  );

  const sources: BriefSource[] = [];

  for (const post of input.posts) {
    if (!isRelevantDate(post.createdAt, input.cadence)) continue;

    const issueMatch = matchesIssues(`${post.title ?? ""} ${post.content} ${(post.issueTags ?? []).join(" ")}`, topIssues);
    const followedAuthor = Boolean(post.authorId && followedUserIds.includes(post.authorId));
    const jurisdictionMatch = post.jurisdictionName === input.viewer.jurisdictionName || followedJurisdictions.has(post.jurisdictionName);
    const publicActor = isPublicActorRole(post.authorRole);
    const looksLikeResponse = publicActor || post.contentType === "statementClaim" || post.contentType === "announcementUpdate";

    sources.push({
      id: `post-${post.id}`,
      href: getContentDetailHref(post),
      title: post.title?.trim() || post.content.slice(0, 72),
      detail: publicActor
        ? `${post.authorName} responded publicly as discussion moved.`
        : followedAuthor
          ? `${post.authorName} added a reaction that reflects where discussion is moving.`
          : `${post.authorName} added a supporting public reaction.`,
      label: post.contentType === "newsStory" ? "News" : looksLikeResponse ? "Response" : "Post",
      reason: issueMatch
        ? publicActor
          ? "Public response on one of your issues"
          : "Supporting signal on one of your issues"
        : followedAuthor
          ? "Reaction from someone you follow"
          : jurisdictionMatch
            ? "Response in your jurisdictions"
            : "Supporting civic response",
      createdAt: post.createdAt,
      kind: post.contentType === "newsStory" ? "news" : "post",
      score:
        (looksLikeResponse ? 12 : 4) +
        relativeScore(post.createdAt, input.cadence) +
        (issueMatch ? 14 : 0) +
        (followedAuthor ? 8 : 0) +
        (jurisdictionMatch ? 8 : 0) +
        (publicActor ? 12 : 0) +
        Math.min(post.commentCount ?? 0, 4) +
        Math.min(post.boostCount ?? 0, 3),
    });
  }

  for (const petition of input.petitions) {
    if (!isRelevantDate(petition.createdAt, input.cadence)) continue;

    const issueMatch = matchesIssues(`${petition.title} ${petition.summary} ${(petition.issueTags ?? []).join(" ")}`, topIssues);
    const jurisdictionMatch = petition.jurisdictionName === input.viewer.jurisdictionName || followedJurisdictions.has(petition.jurisdictionName);

    sources.push({
      id: `petition-${petition.id}`,
      href: `/petitions/${petition.id}`,
      title: petition.title,
      detail: `${petition.signatureCount} supporters are pushing this issue forward.`,
      label: "Petition",
      reason: issueMatch ? "Issue momentum is building" : jurisdictionMatch ? "Building in your jurisdictions" : "Public momentum is building",
      createdAt: petition.createdAt,
      kind: "petition",
      score:
        30 +
        relativeScore(petition.createdAt, input.cadence) +
        (issueMatch ? 24 : 0) +
        (jurisdictionMatch ? 14 : 0) +
        Math.min(Math.round(petition.signatureCount / 10), 14),
    });
  }

  for (const debate of input.debates) {
    if (!isRelevantDate(debate.createdAt, input.cadence)) continue;

    const issueMatch = matchesIssues(`${debate.title} ${debate.issueText} ${debate.description}`, topIssues);
    const jurisdictionMatch = debate.jurisdictionName === input.viewer.jurisdictionName || followedJurisdictions.has(debate.jurisdictionName);

    sources.push({
      id: `debate-${debate.id}`,
      href: `/debates/${debate.id}`,
      title: debate.title,
      detail: `${debate.participantCount} public voices are shaping the argument here.`,
      label: "Debate",
      reason: issueMatch ? "Debate on an issue you track" : jurisdictionMatch ? "Active in your jurisdictions" : "Worth watching now",
      createdAt: debate.createdAt,
      kind: "debate",
      score:
        24 +
        relativeScore(debate.createdAt, input.cadence) +
        (issueMatch ? 22 : 0) +
        (jurisdictionMatch ? 12 : 0) +
        Math.min(debate.participantCount * 4, 16),
    });
  }

  for (const mediaItem of input.media) {
    if (!isRelevantDate(mediaItem.createdAt, input.cadence)) continue;

    const issueMatch = matchesIssues(mediaItem.title, topIssues);
    const followedSource = followedSourceNames.has(mediaItem.sourceName);
    const jurisdictionMatch = mediaItem.jurisdictionName === input.viewer.jurisdictionName || followedJurisdictions.has(mediaItem.jurisdictionName);

    sources.push({
      id: `media-${mediaItem.id}`,
      href: getNewsStoryHref(mediaItem.id),
      title: mediaItem.title,
      detail: mediaItem.biasLabel
        ? `${mediaItem.sourceName} published a story that is shaping discussion, with perceived ${mediaItem.biasLabel} framing.`
        : `${mediaItem.sourceName} published a story shaping the current discussion.`,
      label: "News",
      reason: issueMatch
        ? "Matches one of your issues"
        : followedSource
          ? "From a source you follow"
          : jurisdictionMatch
            ? "Relevant in your jurisdictions"
            : "Useful context",
      createdAt: mediaItem.createdAt,
      kind: "news",
      score:
        34 +
        relativeScore(mediaItem.createdAt, input.cadence) +
        (issueMatch ? 24 : 0) +
        (followedSource ? 10 : 0) +
        (jurisdictionMatch ? 18 : 0),
    });
  }

  for (const event of input.events) {
    if (!isRelevantDate(event.startsAt, input.cadence)) continue;

    const issueMatch = matchesIssues(`${event.title} ${event.eventType}`, topIssues);
    const jurisdictionMatch = event.jurisdictionName === input.viewer.jurisdictionName || followedJurisdictions.has(event.jurisdictionName);

    sources.push({
      id: `event-${event.id}`,
      href: `/events/${event.id}`,
      title: event.title,
      detail: `${event.attendingCount} people are already planning to attend, making this a live public development.`,
      label: "Event",
      reason: issueMatch ? "Connects to one of your issues" : jurisdictionMatch ? "Happening in your jurisdictions" : "Worth watching now",
      createdAt: event.startsAt,
      kind: "event",
      score:
        32 +
        relativeScore(event.startsAt, input.cadence) +
        (issueMatch ? 22 : 0) +
        (jurisdictionMatch ? 18 : 0) +
        Math.min(event.attendingCount * 2, 14),
    });
  }

  const ranked = sources.sort((a, b) => b.score - a.score || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const primaryDevelopments = ranked.filter((item) => item.kind !== "post");
  const supportingResponses = ranked.filter((item) => item.kind === "post" && item.label === "Response");
  const keyDevelopments = [...primaryDevelopments.slice(0, 3), ...supportingResponses.slice(0, 1)]
    .slice(0, 3)
    .map(({ score: _score, kind: _kind, createdAt: _createdAt, ...item }) => item);
  const responses = supportingResponses
    .slice(0, 2)
    .map(({ score: _score, kind: _kind, createdAt: _createdAt, ...item }) => item);
  const momentum = ranked
    .filter((item) => item.kind === "petition" || item.kind === "debate" || item.kind === "event" || item.kind === "news")
    .slice(0, 2)
    .map(({ score: _score, kind: _kind, createdAt: _createdAt, ...item }) => item);
  const attentionSource =
    ranked.find((item) => item.kind === "event" || item.kind === "petition" || item.kind === "debate" || item.kind === "news") ??
    ranked[0] ??
    null;

  return {
    cadence: input.cadence,
    headline: pickHeadline(ranked, topIssues, input.cadence),
    intro: buildIntro(ranked, topIssues, input.cadence),
    keyDevelopments,
    responses,
    momentum,
    attention: attentionSource
      ? (({ score: _score, kind: _kind, createdAt: _createdAt, ...item }) => item)(attentionSource)
      : null,
    stakesLine: buildStakesLine(ranked, topIssues),
    personalization: {
      topIssues: topIssues.slice(0, 3),
      followedPeopleCount: followedUserIds.length,
      followedCommunityNames,
    },
  };
}
