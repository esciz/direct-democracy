import "server-only";

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type CommunityRelationshipDomain =
  | "meetings"
  | "agendaItems"
  | "votingCards"
  | "issues"
  | "courtCases"
  | "spendingRecords"
  | "projects"
  | "elections"
  | "officialActionRecords";

export type CommunityRelationshipLinkType = "direct" | "inferred" | "statewide_overlay" | "federal_overlay";

export type CommunityRelationshipScope =
  | "direct_local"
  | "inferred_local"
  | "county"
  | "school_special_district"
  | "statewide_overlay"
  | "federal_overlay";

export type CommunityRelationshipRecord = {
  id: string;
  title: string;
  storyType?: "vote" | "meeting" | "case" | "spending" | "project" | "issue" | "election" | "official" | "source";
  storyHeadline?: string;
  storySummary?: string;
  storyWhyItMatters?: string;
  storyJurisdiction?: string | null;
  storySourceLabel?: string;
  storySourceDetail?: string | null;
  sourcePath: string;
  linkType: CommunityRelationshipLinkType;
  relationshipScope: CommunityRelationshipScope;
  linkBasis: string;
  reviewStatus: string;
  confidence: number | null;
  date: string | null;
  sourceCount: number;
  sourceUpdatedAt: string | null;
  sourceUrl: string | null;
  href: string | null;
  needsReview: boolean;
  statewideOverlay: boolean;
  federalOverlay: boolean;
};

export type CommunitySourceDocumentRecord = {
  id: string;
  sourceUrl: string | null;
  sourcePath: string | null;
  relatedRecordId: string;
  relatedRecordType: CommunityRelationshipDomain;
  linkType: CommunityRelationshipLinkType;
  reviewStatus: string;
  needsReview: boolean;
};

export type CommunityRelationshipBucket = {
  communityId: string;
  name: string;
  generatedAt?: string;
  counts: Record<CommunityRelationshipDomain | "sourceDocuments", number>;
  localCounts: Record<CommunityRelationshipDomain, number>;
  statewideOverlayCounts: Record<CommunityRelationshipDomain, number>;
  linkCounts: {
    direct: number;
    inferred: number;
    statewideOverlay: number;
    federalOverlay?: number;
  };
  reviewCounts: {
    approved: number;
    ready: number;
    needsReview: number;
    unknown: number;
  };
  confidenceCounts: {
    high: number;
    medium: number;
    low: number;
    unknown: number;
  };
  records: Record<CommunityRelationshipDomain, CommunityRelationshipRecord[]> & {
    sourceDocuments: CommunitySourceDocumentRecord[];
  };
};

export type NevadaCommunityRelationshipMap = {
  schemaVersion: number;
  generatedAt: string;
  totals: {
    recordsProcessed: number;
    directLinkCount: number;
    inferredLinkCount: number;
    statewideOnlyCount: number;
    federalOnlyCount: number;
    unlinkedCount: number;
    needsReviewCount: number;
    lowConfidenceCount: number;
  };
  communities: Record<string, CommunityRelationshipBucket>;
};

const RELATIONSHIPS_PATH = path.join(process.cwd(), "data/generated/nevada-community-relationships.json");

function emptyDomainCounts() {
  return {
    meetings: 0,
    agendaItems: 0,
    votingCards: 0,
    issues: 0,
    courtCases: 0,
    spendingRecords: 0,
    projects: 0,
    elections: 0,
    officialActionRecords: 0,
  };
}

export function emptyCommunityRelationshipBucket(communityId: string, name = communityId): CommunityRelationshipBucket {
  return {
    communityId,
    name,
    counts: { ...emptyDomainCounts(), sourceDocuments: 0 },
    localCounts: emptyDomainCounts(),
    statewideOverlayCounts: emptyDomainCounts(),
    linkCounts: { direct: 0, inferred: 0, statewideOverlay: 0, federalOverlay: 0 },
    reviewCounts: { approved: 0, ready: 0, needsReview: 0, unknown: 0 },
    confidenceCounts: { high: 0, medium: 0, low: 0, unknown: 0 },
    records: {
      meetings: [],
      agendaItems: [],
      votingCards: [],
      issues: [],
      courtCases: [],
      spendingRecords: [],
      projects: [],
      elections: [],
      officialActionRecords: [],
      sourceDocuments: [],
    },
  };
}

export async function getNevadaCommunityRelationshipMap(): Promise<NevadaCommunityRelationshipMap | null> {
  if (!existsSync(RELATIONSHIPS_PATH)) {
    return null;
  }

  try {
    return JSON.parse(await readFile(RELATIONSHIPS_PATH, "utf8")) as NevadaCommunityRelationshipMap;
  } catch (error) {
    console.error("[community-relationships] Failed to read relationship map", error);
    return null;
  }
}

export async function getCommunityRelationships(communityId: string, communityName?: string) {
  const relationshipMap = await getNevadaCommunityRelationshipMap();
  const bucket = relationshipMap?.communities[communityId];
  return bucket ? { ...bucket, generatedAt: relationshipMap?.generatedAt } : emptyCommunityRelationshipBucket(communityId, communityName);
}
