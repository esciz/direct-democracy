import Link from "next/link";

import { CommunityHero } from "@/components/domain/community-hero";
import { CommunityMeetingIntelligenceCard } from "@/components/domain/community-meeting-intelligence-card";
import { CommunitySelector } from "@/components/domain/community-selector";
import { HomeUpcomingElectionsPane } from "@/components/domain/home-upcoming-elections-pane";
import { SectionHeading } from "@/components/ui/section-heading";
import type { FavoriteTargetType } from "@/lib/favorites/types";
import { slugifyIssueText } from "@/lib/issues/utils";
import { getAllOrganizations } from "@/lib/organizations/store";
import { getAllPetitions } from "@/lib/petitions/store";
import { getPublicPeopleDirectory } from "@/lib/profile/discovery";
import { getOfficials } from "@/lib/officials/store";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getAllCases } from "@/lib/cases/store";
import { getCommunityById, getDefaultCommunityForUser, seededCommunities } from "@/lib/community/communities";
import { getDiscoverableEventsForUser } from "@/lib/community/event-discovery";
import { getTopIssuesForUser } from "@/lib/community/issues";
import { getCommunityHero } from "@/lib/community/place-data";
import { emptyCommunityRelationshipBucket, getCommunityRelationships, type CommunityRelationshipBucket, type CommunityRelationshipDomain, type CommunityRelationshipRecord } from "@/lib/community/relationships";
import { getFeedDebatePreviews } from "@/lib/debates/store";
import { getContextualPostPreviews, getPerspectiveType } from "@/lib/feed/posts";
import { getFavoritesForUser } from "@/lib/server/favorites";
import { getIssueDirectoryForUser } from "@/lib/server/issues";
import { getCandidateProfiles, getElectionSummaries } from "@/lib/server/elections-context";
import { getCommunityMeetingSummary } from "@/lib/public-meetings/public";
import { formatDateUtc } from "@/lib/dates";
import type { AuthUser, CommunitySummary, ElectionSummary } from "@/types/domain";

type MyCommunityPageProps = {
  searchParams?: Promise<{
    communityId?: string;
  }>;
};

type HomeFavoriteItem = {
  id: string;
  label: string;
  title: string;
  summary: string;
  href: string;
};

type TrendingItem = {
  id: string;
  label: string;
  title: string;
  summary: string;
  href: string;
  ctaLabel: string;
};

type CommunityCoverageSection = {
  id: string;
  label: string;
  title: string;
  summary: string;
  href: string;
  statusLabel: string;
  hasData: boolean;
};

type RelationshipHighlight = {
  id: CommunityRelationshipDomain;
  label: string;
  title: string;
  totalCount: number;
  localCount: number;
  statewideOverlayCount: number;
  records: CommunityRelationshipRecord[];
};

type DashboardItem = {
  id: string;
  label: string;
  storyType: string;
  title: string;
  summary: string;
  whyItMatters: string;
  sourceLabel: string;
  sourceDetail: string | null;
  destinationHref: string | null;
  destinationKind: "internal" | "source" | "missing";
  date: string | null;
  whyLabel: string;
  sourceAuditLabel: string;
  record: CommunityRelationshipRecord;
};

type DashboardSection = {
  id: string;
  title: string;
  emptyLabel: string;
  items: DashboardItem[];
};

function formatElectionDate(value: string) {
  return formatDateUtc(value, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDaysAway(targetDate: string) {
  const target = Date.parse(targetDate);
  const today = Date.now();
  const diff = target - today;
  const dayCount = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));

  if (dayCount === 0) return "Today";
  if (dayCount === 1) return "1 day away";
  return `${dayCount} days away`;
}

function clipText(value: string | null | undefined, max = 140) {
  const text = (value ?? "").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function formatNullableDate(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return formatDateUtc(new Date(timestamp).toISOString(), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getElectionLevelLabel(election: ElectionSummary) {
  const jurisdiction = election.jurisdictionName.toLowerCase();
  const title = `${election.title} ${election.officeTitle}`.toLowerCase();

  if (election.isCommunityVoteOnly) return "Community";
  if (title.includes("school")) return "School board";
  if (jurisdiction === "united states") return "Federal";
  if (jurisdiction === "nevada") return "State";
  if (jurisdiction.includes("county")) return "County";
  return "Local";
}

function getNextElectionMilestone(election: ElectionSummary) {
  const now = Date.now();
  const milestones = [
    { label: "Registration deadline", date: election.registrationDeadline ?? null },
    { label: "Mail ballot deadline", date: election.mailBallotDeadline ?? null },
    { label: "Early voting starts", date: election.earlyVotingStartsAt ?? null },
    { label: "Election day", date: election.electionDate },
    { label: "Polls close", date: election.pollsCloseAt ?? null },
  ];

  return (
    milestones.find((milestone) => {
      const timestamp = milestone.date ? Date.parse(milestone.date) : Number.NaN;
      return Number.isFinite(timestamp) && timestamp >= now;
    }) ?? {
      label: "Election day",
      date: election.electionDate,
    }
  );
}

function getElectionRelevanceNote(
  election: ElectionSummary,
  currentCommunity: CommunitySummary,
  user: AuthUser,
) {
  if (/school board/i.test(`${election.title} ${election.officeTitle}`)) {
    return "Your school district";
  }

  if (election.jurisdictionName === "United States") {
    return "National election";
  }

  if (election.jurisdictionName === "Nevada") {
    return "Statewide election";
  }

  if (election.jurisdictionName === user.jurisdictionName || election.communityId === currentCommunity.id) {
    return /county/i.test(currentCommunity.name) ? "This applies to your county" : "This applies to your city";
  }

  if (/county/i.test(election.jurisdictionName)) {
    return "Countywide election";
  }

  return `Relevant to ${currentCommunity.name}`;
}

function getUpcomingElectionsForUser(
  elections: ElectionSummary[],
  currentCommunity: CommunitySummary,
  user: AuthUser,
) {
  const jurisdictionMatches = new Set<string>([
    "United States",
    "Nevada",
    user.jurisdictionName,
    currentCommunity.primaryJurisdictionName,
    ...currentCommunity.jurisdictionMatches,
  ]);
  const communityMatches = new Set<string>([
    currentCommunity.id,
    "nevada",
    "united-states",
  ]);

  return elections
    .filter((election) => {
      const milestone = getNextElectionMilestone(election);
      const nextDate = milestone.date ? Date.parse(milestone.date) : Number.NaN;

      if (!Number.isFinite(nextDate) || nextDate < Date.now()) {
        return false;
      }

      return jurisdictionMatches.has(election.jurisdictionName) || (election.communityId ? communityMatches.has(election.communityId) : false);
    })
    .sort((left, right) => {
      const leftDate = Date.parse(getNextElectionMilestone(left).date ?? left.electionDate);
      const rightDate = Date.parse(getNextElectionMilestone(right).date ?? right.electionDate);
      return leftDate - rightDate;
    })
    .slice(0, 5);
}

function buildUpcomingElectionItems(
  elections: ElectionSummary[],
  currentCommunity: CommunitySummary,
  user: AuthUser,
) {
  return elections.map((election) => {
    const milestone = getNextElectionMilestone(election);
    const candidates = Array.isArray(election.candidates) ? election.candidates : [];
    const importedCandidates = Array.isArray(election.importedCandidates) ? election.importedCandidates : [];
    const ballotInitiatives = Array.isArray(election.ballotInitiatives) ? election.ballotInitiatives : [];
    const candidateCount = candidates.length + importedCandidates.length;
    const keyRaceSummary = candidateCount
      ? `${candidateCount} candidate record${candidateCount === 1 ? "" : "s"} are already visible from imported Nevada beta data and profile records.`
      : `${election.officeTitle} and the items on this ballot are the key things to watch here.`;
    const ballotMeasureNames = ballotInitiatives.slice(0, 3).map((initiative) => initiative.title).filter(Boolean);

    return {
      id: election.id,
      title: election.title,
      jurisdictionLabel: election.jurisdictionName,
      levelLabel: getElectionLevelLabel(election),
      dateLabel: formatElectionDate(election.electionDate),
      countdownLabel: `${milestone.label} · ${formatDaysAway(milestone.date ?? election.electionDate)}`,
      milestoneLabel: milestone.label,
      relevanceNote: getElectionRelevanceNote(election, currentCommunity, user),
      summary:
        election.ballotSummary ??
        "Open this election to compare candidates, review ballot items, and stay ahead of the next important deadline.",
      keyRacesSummary: keyRaceSummary,
      ballotMeasuresSummary: ballotMeasureNames.length
        ? ballotMeasureNames.join(" · ")
        : "No ballot measures are highlighted for this election yet.",
      href: `/elections/${election.id}`,
      sourceLabel: election.sourceLabel ?? null,
    };
  });
}

function getFavoriteLabel(targetType: FavoriteTargetType) {
  switch (targetType) {
    case "community":
      return "Community";
    case "issue":
      return "Saved issue";
    case "candidate":
      return "Followed candidate";
    case "official":
      return "Followed official";
    case "petition":
      return "Saved petition";
    case "election":
      return "Saved election";
    case "organization":
      return "Coalition / group";
    case "event":
      return "Saved event";
    case "person":
      return "Citizen";
    case "case":
      return "Public-interest case";
  }
}

function buildCoverageSections({
  currentCommunity,
  relationships,
}: {
  currentCommunity: CommunitySummary;
  relationships: CommunityRelationshipBucket;
}): CommunityCoverageSection[] {
  const communityHref = `/my-community?communityId=${currentCommunity.id}`;
  const counts = relationships.counts;

  return [
    {
      id: "overview",
      label: "Overview",
      title: `${currentCommunity.name} overview`,
      summary: currentCommunity.descriptor,
      href: communityHref,
      statusLabel: "Generated page ready",
      hasData: true,
    },
    {
      id: "officials",
      label: "Officials",
      title: "Representatives and offices",
      summary: counts.officialActionRecords
        ? `${counts.officialActionRecords} official action record${counts.officialActionRecords === 1 ? "" : "s"} currently link to this community.`
        : "Official records are not fully ingested here yet. This section is ready for city, county, state, and federal source links.",
      href: `/officials?communityId=${currentCommunity.id}`,
      statusLabel: counts.officialActionRecords ? `${counts.officialActionRecords} linked` : "Source setup pending",
      hasData: counts.officialActionRecords > 0,
    },
    {
      id: "meetings",
      label: "Meetings",
      title: "Public meetings and votes",
      summary: counts.meetings
        ? `${counts.meetings} meeting record${counts.meetings === 1 ? "" : "s"} link to this community, including local records and statewide overlay items where relevant.`
        : "Meeting ingestion is queued for this place. When source records exist, agendas, summaries, votes, and source links will appear here.",
      href: communityHref,
      statusLabel: counts.meetings ? `${counts.meetings} linked` : "Source setup pending",
      hasData: counts.meetings > 0,
    },
    {
      id: "voting-cards",
      label: "Voting cards",
      title: "Plain-language votes",
      summary: counts.votingCards
        ? `${counts.votingCards} voting card${counts.votingCards === 1 ? "" : "s"} link to this community from meeting agenda items and generated civic questions.`
        : "Voting cards will appear when meeting actions can be turned into plain-language public questions.",
      href: `/voting/all?communityId=${currentCommunity.id}`,
      statusLabel: counts.votingCards ? `${counts.votingCards} linked` : "Source setup pending",
      hasData: counts.votingCards > 0,
    },
    {
      id: "elections",
      label: "Elections",
      title: "Elections and ballot items",
      summary: counts.elections
        ? `${counts.elections} election or candidate source record${counts.elections === 1 ? "" : "s"} link to this community.`
        : "Election records are ready to attach from Nevada source imports. Candidate, ballot question, and result links will appear as data is reviewed.",
      href: `/elections?view=all&state=nevada`,
      statusLabel: counts.elections ? `${counts.elections} linked` : "Source setup pending",
      hasData: counts.elections > 0,
    },
    {
      id: "issues",
      label: "Issues",
      title: "Civic issues",
      summary: counts.issues
        ? `${counts.issues} source-backed issue hub${counts.issues === 1 ? "" : "s"} link to this community.`
        : "Issue hubs are ready for community review requests, meeting links, cases, officials, and spending records as they are approved.",
      href: `/issues?communityId=${currentCommunity.id}`,
      statusLabel: counts.issues ? `${counts.issues} linked` : "Awaiting reviewed signals",
      hasData: counts.issues > 0,
    },
    {
      id: "court-cases",
      label: "Court cases",
      title: "Court cases",
      summary: counts.courtCases
        ? `${counts.courtCases} public case record${counts.courtCases === 1 ? "" : "s"} link through this community or statewide source coverage.`
        : "Court case coverage will show reviewed public records only, with privacy screening and original court source links.",
      href: `/cases?communityId=${currentCommunity.id}`,
      statusLabel: counts.courtCases ? `${counts.courtCases} linked` : "Review queue pending",
      hasData: counts.courtCases > 0,
    },
    {
      id: "spending",
      label: "Spending",
      title: "Budget and spending",
      summary: counts.spendingRecords
        ? `${counts.spendingRecords} spending-related record${counts.spendingRecords === 1 ? "" : "s"} link to this community from agenda or campaign-finance sources.`
        : "Spending data will appear from budgets, campaign finance, and meeting agenda items when source-backed records are available.",
      href: `/services?communityId=${currentCommunity.id}`,
      statusLabel: counts.spendingRecords ? `${counts.spendingRecords} linked` : "Source setup pending",
      hasData: counts.spendingRecords > 0,
    },
    {
      id: "projects",
      label: "Projects",
      title: "Public projects",
      summary: counts.projects
        ? `${counts.projects} project or capital-work record${counts.projects === 1 ? "" : "s"} link to this community. Inferred project records are marked for review.`
        : "Project coverage will appear from capital plans, public works pages, budget records, and agenda items when source-backed records are available.",
      href: communityHref,
      statusLabel: counts.projects ? `${counts.projects} linked` : "Source setup pending",
      hasData: counts.projects > 0,
    },
    {
      id: "news",
      label: "News",
      title: "News and source updates",
      summary: "News coverage will remain source-linked and contextual to civic records, not a generic social feed.",
      href: `/explore?communityId=${currentCommunity.id}`,
      statusLabel: "Backlog source setup",
      hasData: false,
    },
  ];
}

function getLinkTypeLabel(record: CommunityRelationshipRecord) {
  if (record.relationshipScope === "county") return "County link";
  if (record.relationshipScope === "school_special_district") return "School / district link";
  if (record.linkType === "federal_overlay" || record.relationshipScope === "federal_overlay") return "Federal overlay";
  if (record.linkType === "direct") return "Direct link";
  if (record.linkType === "statewide_overlay") return "Statewide overlay";
  return "Inferred link";
}

function getRelationshipPriority(record: CommunityRelationshipRecord) {
  if (record.relationshipScope === "direct_local" || record.linkType === "direct") return 1;
  if (record.relationshipScope === "county") return 2;
  if (record.relationshipScope === "school_special_district") return 3;
  if (record.relationshipScope === "inferred_local" || record.linkType === "inferred") return 4;
  if (record.relationshipScope === "statewide_overlay" || record.linkType === "statewide_overlay") return 5;
  if (record.relationshipScope === "federal_overlay" || record.linkType === "federal_overlay") return 6;
  return 7;
}

function getStoryTypePriority(record: CommunityRelationshipRecord) {
  const timestamp = Date.parse(record.date ?? "");
  const isUpcoming = Number.isFinite(timestamp) && timestamp > Date.now();
  if (record.storyType === "vote" && isUpcoming) return 1;
  if (record.storyType === "spending") return 2;
  if (record.storyType === "issue") return 3;
  if (record.storyType === "case") return 4;
  if (record.storyType === "meeting" && isUpcoming) return 5;
  if (record.storyType === "vote") return 6;
  if (record.storyType === "meeting") return 7;
  return 8;
}

function sortDashboardRecords(records: CommunityRelationshipRecord[]) {
  return [...records].sort((left, right) => {
    const priorityDiff = getRelationshipPriority(left) - getRelationshipPriority(right);
    if (priorityDiff !== 0) return priorityDiff;
    const reviewDiff = Number(left.needsReview) - Number(right.needsReview);
    if (reviewDiff !== 0) return reviewDiff;
    const leftConfidence = left.confidence ?? 0.65;
    const rightConfidence = right.confidence ?? 0.65;
    const confidenceDiff = rightConfidence - leftConfidence;
    if (Math.abs(confidenceDiff) > 0.001) return confidenceDiff;
    const leftDate = Date.parse(left.date ?? "");
    const rightDate = Date.parse(right.date ?? "");
    return (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
  });
}

function sortCivicStories(records: CommunityRelationshipRecord[]) {
  return [...records].sort((left, right) => {
    const relationshipDiff = getRelationshipPriority(left) - getRelationshipPriority(right);
    if (relationshipDiff !== 0) return relationshipDiff;
    const storyDiff = getStoryTypePriority(left) - getStoryTypePriority(right);
    if (storyDiff !== 0) return storyDiff;
    const reviewDiff = Number(left.needsReview) - Number(right.needsReview);
    if (reviewDiff !== 0) return reviewDiff;
    const confidenceDiff = (right.confidence ?? 0.65) - (left.confidence ?? 0.65);
    if (Math.abs(confidenceDiff) > 0.001) return confidenceDiff;
    return (Date.parse(right.date ?? "") || 0) - (Date.parse(left.date ?? "") || 0);
  });
}

function getSourceBadges(record: CommunityRelationshipRecord) {
  const badges = new Set<string>();
  if (record.sourceUrl || record.sourcePath) badges.add("source-backed");
  if (record.relationshipScope === "county") badges.add("county link");
  else if (record.relationshipScope === "school_special_district") badges.add("school / district");
  else if (record.linkType === "direct") badges.add("direct local");
  else if (record.linkType === "inferred") badges.add("local inferred");
  if (record.statewideOverlay || record.linkType === "statewide_overlay") badges.add("statewide overlay");
  if (record.federalOverlay || record.linkType === "federal_overlay") badges.add("federal overlay");
  if (record.needsReview) badges.add("needs review");
  if (record.confidence !== null && record.confidence < 0.5) badges.add("low confidence");
  return [...badges];
}

function getBadgeClassName(label: string) {
  if (label === "source-backed" || label === "direct local") return "border-emerald-300/20 bg-emerald-500/10 text-emerald-200";
  if (label === "statewide overlay") return "border-violet-300/20 bg-violet-500/10 text-violet-200";
  if (label === "federal overlay") return "border-sky-300/20 bg-sky-500/10 text-sky-200";
  if (label === "needs review" || label === "low confidence") return "border-amber-300/20 bg-amber-500/10 text-amber-200";
  return "border-white/10 bg-white/5 text-slate-200";
}

function totalLocalDashboardRecords(relationships: CommunityRelationshipBucket) {
  const dashboardDomains: CommunityRelationshipDomain[] = ["meetings", "votingCards", "issues", "courtCases", "spendingRecords", "projects", "elections", "officialActionRecords"];
  return dashboardDomains.reduce((total, domain) => total + relationships.localCounts[domain], 0);
}

function getDestination(record: CommunityRelationshipRecord) {
  if (record.href?.startsWith("http")) return { destinationHref: record.href, destinationKind: "source" as const };
  if (record.href) return { destinationHref: record.href, destinationKind: "internal" as const };
  if (record.sourceUrl) return { destinationHref: record.sourceUrl, destinationKind: "source" as const };
  return { destinationHref: null, destinationKind: "missing" as const };
}

function getSourceOriginLabel(record: CommunityRelationshipRecord) {
  if (record.sourcePath.includes("public-meeting-voting-cards")) return "voting cards";
  if (record.sourcePath.includes("public-meetings") || record.sourcePath.includes("public-meeting-items")) return "imported meeting data";
  if (record.sourcePath.includes("public-court") || record.sourcePath.includes("public-cases")) return "court cases";
  if (record.sourcePath.includes("issues-runtime")) return "issues";
  if (record.sourcePath.includes("nv-sos")) return "Nevada election/finance import";
  if (record.sourcePath.includes("officials-runtime")) return "official action records";
  return "generated relationships";
}

function getWhySeeingThis(record: CommunityRelationshipRecord, communityName: string, hasLocalData: boolean) {
  const confidenceNote = record.needsReview
    ? " It needs review before being treated as fully verified."
    : record.confidence !== null && record.confidence < 0.5
      ? " It is low confidence and should be checked against the source."
      : "";

  if (record.relationshipScope === "direct_local") return `Shown because this record is directly tied to ${communityName}.${confidenceNote}`;
  if (record.relationshipScope === "county") return `Shown because this county-level record may affect residents of ${communityName}.${confidenceNote}`;
  if (record.relationshipScope === "school_special_district") return `Shown because this school or special district record is tied to the local civic area.${confidenceNote}`;
  if (record.relationshipScope === "statewide_overlay" || record.linkType === "statewide_overlay") {
    return hasLocalData
      ? `Shown because this statewide Nevada record may affect ${communityName}.${confidenceNote}`
      : `Shown because statewide Nevada records are useful while local records for ${communityName} are still limited.${confidenceNote}`;
  }
  if (record.relationshipScope === "federal_overlay" || record.linkType === "federal_overlay") {
    return hasLocalData
      ? `Shown as a federal overlay because it may affect Nevada residents, including ${communityName}.${confidenceNote}`
      : `Shown as a federal overlay because no local record is available yet.${confidenceNote}`;
  }
  return `Shown because this record was inferred from jurisdiction or public-body text tied to ${communityName}.${confidenceNote}`;
}

function getSourceAuditLabel(record: CommunityRelationshipRecord) {
  const confidence = record.confidence === null ? "confidence unknown" : `${Math.round(record.confidence * 100)}% confidence`;
  const sources = `${record.sourceCount} source${record.sourceCount === 1 ? "" : "s"}`;
  const updated = formatNullableDate(record.sourceUpdatedAt ?? record.date) ?? "date pending";
  return `${confidence} · ${sources} · updated ${updated} · ${getSourceOriginLabel(record)}`;
}

function makeDashboardItem(label: string, record: CommunityRelationshipRecord, communityName: string, hasLocalData: boolean): DashboardItem {
  const destination = getDestination(record);
  const storySummary = record.storySummary || `${getLinkTypeLabel(record)}${record.date ? ` · ${formatNullableDate(record.date) ?? "Date pending"}` : ""}`;
  return {
    id: `${label}-${record.id}-${record.linkType}`,
    label,
    storyType: record.storyType ?? label,
    title: record.storyHeadline || record.title,
    summary: storySummary,
    whyItMatters: record.storyWhyItMatters || "This may affect residents, services, rules, oversight, or public resources.",
    sourceLabel: record.storySourceLabel || "Source",
    sourceDetail: record.storySourceDetail ?? null,
    ...destination,
    date: record.date,
    whyLabel: getWhySeeingThis(record, communityName, hasLocalData),
    sourceAuditLabel: getSourceAuditLabel(record),
    record,
  };
}

function getMostRecentRecord(records: CommunityRelationshipRecord[]) {
  const now = Date.now();
  return sortDashboardRecords(records)
    .filter((record) => {
      const timestamp = Date.parse(record.date ?? "");
      return Number.isFinite(timestamp) && timestamp <= now;
    })
    .sort((left, right) => (Date.parse(right.date ?? "") || 0) - (Date.parse(left.date ?? "") || 0))[0] ?? null;
}

function getNextUpcomingRecord(records: CommunityRelationshipRecord[]) {
  const now = Date.now();
  return sortDashboardRecords(records)
    .filter((record) => {
      const timestamp = Date.parse(record.date ?? "");
      return Number.isFinite(timestamp) && timestamp > now;
    })
    .sort((left, right) => (Date.parse(left.date ?? "") || 0) - (Date.parse(right.date ?? "") || 0))[0] ?? null;
}

function buildDashboardSections(relationships: CommunityRelationshipBucket, communityName: string): DashboardSection[] {
  const hasLocalData = totalLocalDashboardRecords(relationships) > 0;
  const recentMeeting = getMostRecentRecord(relationships.records.meetings);
  const upcomingMeeting = getNextUpcomingRecord(relationships.records.meetings);
  const overlayRecords = sortDashboardRecords([
    ...relationships.records.votingCards,
    ...relationships.records.issues,
    ...relationships.records.courtCases,
    ...relationships.records.spendingRecords,
    ...relationships.records.projects,
    ...relationships.records.elections,
    ...relationships.records.officialActionRecords,
  ]).filter((record) => record.statewideOverlay || record.federalOverlay || record.linkType === "statewide_overlay" || record.linkType === "federal_overlay");

  return [
    {
      id: "meetings-now-next",
      title: "Meetings",
      emptyLabel: "Meeting records are queued for this community.",
      items: [
        recentMeeting ? makeDashboardItem("Most recent meeting", recentMeeting, communityName, hasLocalData) : null,
        upcomingMeeting ? makeDashboardItem("Next upcoming meeting", upcomingMeeting, communityName, hasLocalData) : null,
      ].filter((item): item is DashboardItem => Boolean(item)),
    },
    {
      id: "voting-cards",
      title: "Top voting cards",
      emptyLabel: "Plain-language voting cards will appear after local agenda items are reviewed.",
      items: sortDashboardRecords(relationships.records.votingCards).slice(0, 4).map((record) => makeDashboardItem("Voting card", record, communityName, hasLocalData)),
    },
    {
      id: "issues",
      title: "Active issues",
      emptyLabel: "Issue hubs are ready for reviewed local signals.",
      items: sortDashboardRecords(relationships.records.issues).slice(0, 3).map((record) => makeDashboardItem("Issue", record, communityName, hasLocalData)),
    },
    {
      id: "court-cases",
      title: "Recent court cases",
      emptyLabel: "Reviewed public case records will appear here.",
      items: sortDashboardRecords(relationships.records.courtCases).slice(0, 3).map((record) => makeDashboardItem("Court case", record, communityName, hasLocalData)),
    },
    {
      id: "spending",
      title: "Recent spending",
      emptyLabel: "Budget, campaign-finance, and agenda-linked spending records will appear here.",
      items: sortDashboardRecords(relationships.records.spendingRecords).slice(0, 3).map((record) => makeDashboardItem("Spending", record, communityName, hasLocalData)),
    },
    {
      id: "projects",
      title: "Projects and capital work",
      emptyLabel: "No reviewed local project records currently available.",
      items: sortDashboardRecords(relationships.records.projects).slice(0, 3).map((record) => makeDashboardItem("Project", record, communityName, hasLocalData)),
    },
    {
      id: "overlays",
      title: "Statewide and federal overlays",
      emptyLabel: "No statewide or federal overlays are linked right now.",
      items: overlayRecords.slice(0, 4).map((record) => makeDashboardItem(record.federalOverlay ? "Federal overlay" : "Statewide overlay", record, communityName, hasLocalData)),
    },
  ];
}

function buildPriorityStoryItems(relationships: CommunityRelationshipBucket, communityName: string) {
  const hasLocalData = totalLocalDashboardRecords(relationships) > 0;
  const records = [
    ...relationships.records.votingCards,
    ...relationships.records.spendingRecords,
    ...relationships.records.issues,
    ...relationships.records.courtCases,
    ...relationships.records.meetings,
    ...relationships.records.projects,
  ];
  const seen = new Set<string>();
  return sortCivicStories(records)
    .filter((record) => {
      const key = `${record.id}-${record.linkType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .map((record) => makeDashboardItem(record.storyType === "vote" ? "Vote" : record.storyType ? sentenceCaseLabel(record.storyType) : "Story", record, communityName, hasLocalData));
}

function sentenceCaseLabel(value: string) {
  if (!value) return "Story";
  return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
}

function buildCoverageStats(relationships: CommunityRelationshipBucket) {
  return [
    { label: "Meetings", count: relationships.counts.meetings },
    { label: "Voting cards", count: relationships.counts.votingCards },
    { label: "Issues", count: relationships.counts.issues },
    { label: "Court cases", count: relationships.counts.courtCases },
    { label: "Spending", count: relationships.counts.spendingRecords },
    { label: "Projects", count: relationships.counts.projects },
    { label: "Elections", count: relationships.counts.elections },
    { label: "Officials/actions", count: relationships.counts.officialActionRecords },
  ];
}

function getRelationshipHighlights(relationships: CommunityRelationshipBucket): RelationshipHighlight[] {
  const domains: Array<{ id: CommunityRelationshipDomain; label: string; title: string }> = [
    { id: "votingCards", label: "Voting cards", title: "Plain-language government actions" },
    { id: "issues", label: "Issues", title: "Source-backed issue hubs" },
    { id: "meetings", label: "Meetings", title: "Public meetings" },
    { id: "courtCases", label: "Court cases", title: "Public case records" },
    { id: "spendingRecords", label: "Spending", title: "Budget and finance signals" },
    { id: "projects", label: "Projects", title: "Public projects and capital work" },
    { id: "elections", label: "Elections", title: "Election and candidate records" },
    { id: "officialActionRecords", label: "Officials", title: "Official action records" },
  ];

  return domains
    .map((domain) => ({
      ...domain,
      totalCount: relationships.counts[domain.id],
      localCount: relationships.localCounts[domain.id],
      statewideOverlayCount: relationships.statewideOverlayCounts[domain.id],
      records: relationships.records[domain.id].slice(0, 3),
    }))
    .filter((domain) => domain.totalCount > 0);
}

async function loadCommunityDataset<T>(label: string, promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    console.error(`[my-community] ${label} loader failed`, error);
    return fallback;
  }
}

export default async function MyCommunityPage({ searchParams }: MyCommunityPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const selectedCommunityId = params?.communityId ?? getDefaultCommunityForUser(user).id;
  const currentCommunity = getCommunityById(selectedCommunityId) ?? getDefaultCommunityForUser(user);

  const [
    elections,
    favoriteRecords,
    topIssues,
    events,
    previewPosts,
    previewDebates,
    petitions,
    issueDirectory,
    people,
    candidates,
    officials,
    cases,
    organizations,
    meetingSummary,
    relationships,
  ] = await Promise.all([
    loadCommunityDataset("elections", getElectionSummaries(), []),
    loadCommunityDataset("favorites", getFavoritesForUser(user.id), []),
    loadCommunityDataset("top issues", getTopIssuesForUser(user, "all", selectedCommunityId), []),
    loadCommunityDataset("events", getDiscoverableEventsForUser(user, { communityId: selectedCommunityId, scope: "all", limit: 8 }), []),
    loadCommunityDataset(
      "posts",
      getContextualPostPreviews({
        viewerUserId: user.id,
        limit: 3,
        attachments: [{ type: "community", id: selectedCommunityId, label: currentCommunity.name }],
        preferredRoles: ["trustedCitizen", "official", "candidate", "media"],
      }),
      [],
    ),
    loadCommunityDataset("debates", getFeedDebatePreviews({ jurisdictionNames: currentCommunity.jurisdictionMatches, limit: 3 }), []),
    loadCommunityDataset("petitions", getAllPetitions(), []),
    loadCommunityDataset("issue directory", getIssueDirectoryForUser(user, { communityId: selectedCommunityId }), []),
    loadCommunityDataset("people", getPublicPeopleDirectory(user), []),
    loadCommunityDataset("candidates", getCandidateProfiles(), []),
    loadCommunityDataset("officials", getOfficials(), []),
    loadCommunityDataset("cases", getAllCases(), []),
    loadCommunityDataset("organizations", getAllOrganizations(user), []),
    loadCommunityDataset("meeting records", getCommunityMeetingSummary(currentCommunity), {
      community_name: currentCommunity.name,
      matching_public_body_count: 0,
      upcoming_meetings: [],
      recent_decisions: [],
      open_questions: [],
      recently_approved_spending: [],
      public_cases: [],
      public_comment_opportunities: [],
      last_updated_at: null,
    }),
    loadCommunityDataset("community relationships", getCommunityRelationships(selectedCommunityId, currentCommunity.name), emptyCommunityRelationshipBucket(selectedCommunityId, currentCommunity.name)),
  ]);

  const upcomingElections = getUpcomingElectionsForUser(elections, currentCommunity, user);
  const upcomingElectionItems = buildUpcomingElectionItems(upcomingElections, currentCommunity, user);
  const coverageSections = buildCoverageSections({
    currentCommunity,
    relationships,
  });
  const relationshipHighlights = getRelationshipHighlights(relationships);
  const dashboardSections = buildDashboardSections(relationships, currentCommunity.name);
  const priorityStoryItems = buildPriorityStoryItems(relationships, currentCommunity.name);
  const coverageStats = buildCoverageStats(relationships);
  const localDashboardRecordCount = totalLocalDashboardRecords(relationships);
  const hasLimitedLocalData = localDashboardRecordCount < 5;
  const hasOnlyOverlayData = localDashboardRecordCount === 0 && relationships.linkCounts.statewideOverlay + (relationships.linkCounts.federalOverlay ?? 0) > 0;
  const lastGeneratedLabel = formatNullableDate(relationships.generatedAt) ?? "Not generated yet";

  const favoriteItems = favoriteRecords
    .map((record): HomeFavoriteItem | null => {
      switch (record.targetType) {
        case "community": {
          const community = seededCommunities.find((entry) => entry.id === record.targetId);
          if (!community) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: community.name,
            summary: community.descriptor,
            href: `/my-community?communityId=${community.id}`,
          };
        }
        case "issue": {
          const issue = issueDirectory.find((entry) => entry.id === record.targetId);
          if (!issue) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: issue.issueText,
            summary: `${issue.jurisdictionName} · ${issue.upvoteCount} people elevating this issue`,
            href: `/issues/${slugifyIssueText(issue.issueText)}`,
          };
        }
        case "person": {
          const person = people.find((entry) => entry.id === record.targetId);
          if (!person) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: person.name,
            summary: `${person.jurisdictionName} · ${clipText(person.bio, 90) || "Public citizen profile"}`,
            href: `/citizens/${person.id}`,
          };
        }
        case "candidate": {
          const candidate = candidates.find((entry) => entry.id === record.targetId);
          if (!candidate) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: candidate.name,
            summary: `${candidate.partyText ?? "Candidate"} · ${candidate.jurisdictionName}`,
            href: `/candidates/${candidate.id}`,
          };
        }
        case "official": {
          const official = officials.find((entry) => entry.id === record.targetId);
          if (!official) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: official.name,
            summary: `${official.officeTitle ?? "Official"} · ${official.jurisdictionName}`,
            href: `/officials/${official.id}`,
          };
        }
        case "petition": {
          const petition = petitions.find((entry) => entry.id === record.targetId);
          if (!petition) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: petition.title,
            summary: `${petition.signatureCount} signatures · ${petition.jurisdictionName}`,
            href: `/petitions/${petition.id}`,
          };
        }
        case "case": {
          const caseItem = cases.find((entry) => entry.id === record.targetId);
          if (!caseItem) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: caseItem.title,
            summary: `${caseItem.jurisdictionName} · ${clipText(caseItem.summary, 90)}`,
            href: `/cases/${caseItem.id}`,
          };
        }
        case "event": {
          const event = events.find((entry) => entry.id === record.targetId);
          if (!event) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: event.title,
            summary: `${formatElectionDate(event.startsAt)} · ${event.distanceLabel}`,
            href: `/events/${event.id}`,
          };
        }
        case "election": {
          const election = elections.find((entry) => entry.id === record.targetId);
          if (!election) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: election.title,
            summary: `${election.jurisdictionName} · ${formatElectionDate(election.electionDate)}`,
            href: `/elections/${election.id}`,
          };
        }
        case "organization": {
          const organization = organizations.find((entry) => entry.id === record.targetId);
          if (!organization) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: organization.name,
            summary: `${organization.jurisdictionName} · ${clipText(organization.description, 90)}`,
            href: `/organizations/${organization.id}`,
          };
        }
      }
    })
    .filter((item): item is HomeFavoriteItem => item !== null)
    .slice(0, 5);

  const relevantPetition =
    petitions.find((petition) => currentCommunity.jurisdictionMatches.includes(petition.jurisdictionName)) ?? petitions[0] ?? null;

  const trendingItems: TrendingItem[] = [
    topIssues[0]
      ? {
          id: `issue-${topIssues[0].id}`,
          label: "Trending issue",
          title: topIssues[0].issueText,
          summary: `${topIssues[0].upvoteCount} people are elevating this across ${currentCommunity.name}.`,
          href: `/issues/${slugifyIssueText(topIssues[0].issueText)}`,
          ctaLabel: "View",
        }
      : null,
    relevantPetition
      ? {
          id: `petition-${relevantPetition.id}`,
          label: "Active petition",
          title: relevantPetition.title,
          summary: `${relevantPetition.signatureCount} signatures and building momentum in ${relevantPetition.jurisdictionName}.`,
          href: `/petitions/${relevantPetition.id}`,
          ctaLabel: "View",
        }
      : null,
    events[0]
      ? {
          id: `event-${events[0].id}`,
          label: "Upcoming civic meeting",
          title: events[0].title,
          summary: `${formatElectionDate(events[0].startsAt)} · ${events[0].distanceLabel} · ${clipText(events[0].description, 90)}`,
          href: `/events/${events[0].id}`,
          ctaLabel: "View",
        }
      : null,
    previewPosts[0]
      ? {
          id: `post-${previewPosts[0].id}`,
          label:
            getPerspectiveType(previewPosts[0]) === "official_update"
              ? "Official update"
              : getPerspectiveType(previewPosts[0]) === "candidate_statement"
                ? "Candidate statement"
                : getPerspectiveType(previewPosts[0]) === "media_summary"
                  ? "Media summary"
                  : "Perspective",
          title: previewPosts[0].title ?? previewPosts[0].authorName,
          summary: clipText(previewPosts[0].content, 110),
          href: `/posts/${previewPosts[0].id}`,
          ctaLabel: "View",
        }
      : null,
    previewDebates[0]
      ? {
          id: `debate-${previewDebates[0].id}`,
          label: "Trusted debate",
          title: previewDebates[0].title,
          summary: clipText(previewDebates[0].description, 110),
          href: `/debates/${previewDebates[0].id}`,
          ctaLabel: "View",
        }
      : null,
  ].filter((item): item is TrendingItem => item !== null).slice(0, 5);

  return (
    <div className="space-y-8 py-8">
      <CommunityHero community={getCommunityHero(selectedCommunityId)} />

      <CommunitySelector
        currentCommunity={currentCommunity}
        followedCommunities={[]}
        suggestedCommunities={[]}
        followedIds={[]}
        returnPath="/my-community"
      />

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="What's happening here"
            title={`${currentCommunity.name} civic dashboard`}
            description="Local records are shown first, followed by county, statewide, and federal overlays when they affect this community."
          />
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
            <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Last generated</span>
            <span className="mt-1 block font-semibold text-slate-100">{lastGeneratedLabel}</span>
          </div>
        </div>

        {hasLimitedLocalData ? (
          <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
            We do not have many local records for this community yet, so we are showing county, statewide, and federal civic activity that may still affect residents here.
            {hasOnlyOverlayData
              ? " Local meetings, voting cards, officials, elections, court cases, and spending records are still being connected."
              : " The local records we do have are prioritized first, with broader records shown below them."}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4 lg:grid-cols-2">
            {priorityStoryItems.length ? (
              <article className="rounded-[1.35rem] border border-cyan-300/20 bg-cyan-500/10 p-4 lg:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Pay attention first</p>
                    <h2 className="mt-2 text-base font-semibold text-slate-50">Most important civic stories</h2>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/15 px-3 py-1 text-xs font-semibold text-slate-300">
                    Local, county, state, federal
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {priorityStoryItems.map((item) => {
                    const destinationLabel = item.destinationKind === "source" ? "Source" : item.destinationKind === "internal" ? "Open" : "No destination yet";
                    const content = (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
                            {item.label}
                          </span>
                          {getSourceBadges(item.record).map((badge) => (
                            <span
                              key={`${item.id}-${badge}`}
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${getBadgeClassName(badge)}`}
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                        <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-slate-50">{item.title}</h3>
                        <p className="mt-2 text-xs leading-5 text-slate-300">{item.summary}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-400">Why it matters: {item.whyItMatters}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-500">Source: {item.sourceDetail ?? item.sourceLabel}</p>
                        <span className="mt-3 inline-flex text-xs font-semibold text-cyan-200">{destinationLabel}</span>
                      </>
                    );
                    return item.destinationHref && item.destinationKind === "internal" ? (
                      <Link
                        key={item.id}
                        href={item.destinationHref}
                        className="block rounded-2xl border border-white/10 bg-black/15 p-3 transition hover:border-cyan-300/30 hover:bg-white/[0.06]"
                      >
                        {content}
                      </Link>
                    ) : item.destinationHref ? (
                      <a
                        key={item.id}
                        href={item.destinationHref}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-2xl border border-white/10 bg-black/15 p-3 transition hover:border-cyan-300/30 hover:bg-white/[0.06]"
                      >
                        {content}
                      </a>
                    ) : (
                      <div key={item.id} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                        {content}
                      </div>
                    );
                  })}
                </div>
              </article>
            ) : null}

            {dashboardSections.map((section) => (
              <article key={section.id} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
                <h2 className="text-base font-semibold text-slate-50">{section.title}</h2>
                {section.items.length ? (
                  <div className="mt-4 space-y-3">
                    {section.items.map((item) => {
                      const content = (
                        <>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
                              {item.label}
                            </span>
                            {getSourceBadges(item.record).map((badge) => (
                              <span
                                key={`${item.id}-${badge}`}
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${getBadgeClassName(badge)}`}
                              >
                                {badge}
                              </span>
                            ))}
                          </div>
                          <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-slate-50">{item.title}</h3>
                          <p className="mt-1 text-xs leading-5 text-slate-400">{item.summary}</p>
                          <p className="mt-2 text-xs leading-5 text-slate-300">Why it matters: {item.whyItMatters}</p>
                          <p className="mt-2 text-xs leading-5 text-slate-300">Why am I seeing this? {item.whyLabel}</p>
                          <p className="mt-2 text-xs leading-5 text-slate-500">Source: {item.sourceDetail ?? item.sourceLabel}</p>
                          <p className="mt-2 text-xs leading-5 text-slate-500">{item.sourceAuditLabel}</p>
                        </>
                      );

                      const destinationLabel = item.destinationKind === "source" ? "Source" : item.destinationKind === "internal" ? "Open" : "No destination yet";

                      return item.destinationHref && item.destinationKind === "internal" ? (
                        <Link
                          key={item.id}
                          href={item.destinationHref}
                          className="block rounded-2xl border border-white/10 bg-black/10 p-3 transition hover:border-cyan-300/20 hover:bg-white/[0.06]"
                        >
                          {content}
                          <span className="mt-3 inline-flex text-xs font-semibold text-cyan-200">{destinationLabel}</span>
                        </Link>
                      ) : item.destinationHref ? (
                        <a
                          key={item.id}
                          href={item.destinationHref}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-2xl border border-white/10 bg-black/10 p-3 transition hover:border-cyan-300/20 hover:bg-white/[0.06]"
                        >
                          {content}
                          <span className="mt-3 inline-flex text-xs font-semibold text-cyan-200">{destinationLabel}</span>
                        </a>
                      ) : (
                        <div key={item.id} className="rounded-2xl border border-white/10 bg-black/10 p-3">
                          {content}
                          <span className="mt-3 inline-flex text-xs font-semibold text-amber-200">{destinationLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-3 text-sm leading-6 text-slate-400">{section.emptyLabel}</p>
                )}
              </article>
            ))}
          </div>

          <aside className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Data coverage</p>
              <h2 className="mt-2 text-base font-semibold text-slate-50">Linked records</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {localDashboardRecordCount} local records · {relationships.linkCounts.statewideOverlay} statewide overlays
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {coverageStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/10 p-3">
                  <p className="text-2xl font-semibold text-slate-50">{stat.count}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <SectionHeading
          eyebrow="Nevada Coverage"
          title="Community sections"
          description="Every Nevada community page stays navigable while source ingestion fills in officials, meetings, elections, issues, cases, spending, and news."
        />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {coverageSections.map((section) => (
            <Link
              key={section.id}
              href={section.href}
              className="flex min-h-[210px] flex-col justify-between rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/20 hover:bg-white/[0.06]"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{section.label}</p>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                      section.hasData
                        ? "border border-emerald-300/20 bg-emerald-500/10 text-emerald-200"
                        : "border border-amber-300/20 bg-amber-500/10 text-amber-200"
                    }`}
                  >
                    {section.statusLabel}
                  </span>
                </div>
                <h2 className="mt-3 text-base font-semibold text-slate-50">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{section.summary}</p>
              </div>
              <span className="mt-4 text-sm font-semibold text-cyan-200">Open section</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Relationship Map"
            title="Linked civic records"
            description="These records come from the generated Nevada relationship index, with direct, inferred, statewide overlay, and review status shown on each item."
          />
          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-cyan-200">
              {relationships.linkCounts.inferred} inferred
            </span>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-emerald-200">
              {relationships.linkCounts.direct} direct
            </span>
            <span className="rounded-full border border-violet-300/20 bg-violet-500/10 px-3 py-1 text-violet-200">
              {relationships.linkCounts.statewideOverlay} statewide
            </span>
          </div>
        </div>

        {relationshipHighlights.length ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {relationshipHighlights.map((section) => (
              <article key={section.id} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{section.label}</p>
                    <h2 className="mt-2 text-base font-semibold text-slate-50">{section.title}</h2>
                    <p className="mt-2 text-sm text-slate-400">
                      {section.localCount} local · {section.statewideOverlayCount} statewide overlay · {section.totalCount} total
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {section.records.map((record) => {
                    const content = (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {getSourceBadges(record).map((badge) => (
                            <span
                              key={`${section.id}-${record.id}-${badge}`}
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${getBadgeClassName(badge)}`}
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                        <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-slate-50">{record.title}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {record.confidence === null ? "Confidence unknown" : `Confidence ${Math.round(record.confidence * 100)}%`}
                          {record.date ? ` · ${formatNullableDate(record.date) ?? "Date pending"}` : ""}
                        </p>
                      </>
                    );

                    return record.href ? (
                      <Link
                        key={`${section.id}-${record.id}-${record.linkType}`}
                        href={record.href}
                        className="block rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-cyan-300/20 hover:bg-white/[0.06]"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div key={`${section.id}-${record.id}-${record.linkType}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        {content}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">
            No relationship-map records are linked to this community yet.
          </div>
        )}
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Upcoming Elections"
            title="Upcoming Elections"
            description="The next election, deadline, or ballot moment tied to your local, county, state, and national civic life."
          />
          <Link
            href={`/who-represents-me?community=${selectedCommunityId}`}
            className="text-sm font-semibold text-cyan-200 hover:text-cyan-100"
          >
            Who represents me?
          </Link>
        </div>
        <div className="mt-6">
          <HomeUpcomingElectionsPane elections={upcomingElectionItems} />
        </div>
      </section>

      <CommunityMeetingIntelligenceCard summary={meetingSummary} />

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Favorites"
            title="Saved civic items"
            description="A short list of the communities, issues, officials, candidates, petitions, and civic items you want to keep close."
          />
          <Link
            href={`/explore?communityId=${selectedCommunityId}`}
            className="text-sm font-semibold text-cyan-200 hover:text-cyan-100"
          >
            View all
          </Link>
        </div>

        {favoriteItems.length ? (
          <div className="mt-6 space-y-3">
            {favoriteItems.map((item) => (
              <article key={item.id} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{item.label}</p>
                    <h3 className="mt-2 text-base font-semibold text-slate-50">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.summary}</p>
                  </div>
                  <Link
                    href={item.href}
                    className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100"
                  >
                    View
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">
            Save communities, issues, officials, or petitions to see them here.
          </div>
        )}
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <SectionHeading
          eyebrow="Summary & Trending"
          title="Summary & Trending"
          description="A quick civic read so you can see what matters nearby without falling into a full feed."
        />

        {trendingItems.length ? (
          <div className="mt-6 space-y-3">
            {trendingItems.map((item) => (
              <article key={item.id} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{item.label}</p>
                    <h3 className="mt-2 text-base font-semibold text-slate-50">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.summary}</p>
                  </div>
                  <Link
                    href={item.href}
                    className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100"
                  >
                    {item.ctaLabel}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">
            Nothing major is trending in your area yet.
          </div>
        )}
      </section>
    </div>
  );
}
