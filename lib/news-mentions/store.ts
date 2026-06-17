import {
  CivicRecordReviewStatus,
  NewsMentionProviderName,
  NewsMentionTargetType,
  SourceSyncStatus,
  type NewsMention,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createNewsProvider, hashNewsValue, type NormalizedNewsResult } from "@/lib/news-mentions/providers";

const PUBLIC_REVIEW_STATUSES = [CivicRecordReviewStatus.approved, CivicRecordReviewStatus.verified] as const;
const DEFAULT_DAILY_CAP = Number(process.env.NEWS_MENTION_DAILY_CAP ?? 100);

export type PublicNewsMentionSummary = {
  id: string;
  title: string;
  sourceName: string;
  sourceDomain?: string | null;
  url: string;
  canonicalUrl?: string | null;
  publishedAt?: string | null;
  snippetOrSummary?: string | null;
  provider: string;
  reviewStatus: string;
  confidenceScore: number;
};

export type ProfileNewsMentionCardData = {
  mentions: PublicNewsMentionSummary[];
  totalCount: number;
  approvedCount: number;
  verifiedCount: number;
  pendingCount: number;
  providerUsed: string | null;
  lastImportRun: {
    startedAt: string;
    completedAt: string | null;
    status: string;
    matchedQuery: string | null;
  } | null;
};

type CandidateTarget = {
  targetType: "CANDIDATE";
  id: string;
  fullName: string;
  ballotName: string | null;
  partyText: string | null;
  officeTitle: string | null;
  districtName: string | null;
  jurisdictionName: string;
  electionTitle: string;
  electionDate: Date;
  electionYear: number;
  status: string;
  mentionCount: number;
};

type OfficialTarget = {
  targetType: "OFFICIAL";
  id: string;
  fullName: string;
  partyText: string | null;
  officeTitle: string;
  officeLevel: string;
  districtName: string | null;
  jurisdictionName: string;
  status: string;
  mentionCount: number;
};

type LocalTopicTarget = {
  targetType: "JURISDICTION" | "ISSUE" | "MEETING" | "CASE" | "ELECTION";
  id: string;
  fullName: string;
  topicTerms: string[];
  officeTitle: string | null;
  jurisdictionName: string;
  mentionCount: number;
};

type NewsTarget = CandidateTarget | OfficialTarget | LocalTopicTarget;

export type NewsMentionImportOptions = {
  providerName?: NewsMentionProviderName;
  sourceSlug?: string;
  dailyCap?: number;
  limit?: number;
  pageSize?: number;
  dryRun?: boolean;
  force?: boolean;
  targetType?: NewsMentionTargetType;
  targetId?: string;
};

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return value;
  }
}

function duplicateHashFor(target: NewsTarget, result: NormalizedNewsResult) {
  const date = result.publishedAt ? result.publishedAt.toISOString().slice(0, 10) : "unknown-date";
  return hashNewsValue([
    target.targetType,
    target.id,
    canonicalUrl(result.canonicalUrl ?? result.url),
    normalizeTitle(result.title),
    result.sourceDomain ?? result.sourceName.toLowerCase(),
    date,
  ].join("|"));
}

function compactTerms(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))];
}

function exactQuoted(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? `"${clean.replaceAll('"', "")}"` : null;
}

function normalizePersonName(value: string | null | undefined) {
  return value
    ?.replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim() ?? "";
}

function reorderCommaName(value: string) {
  const [last, ...rest] = value.split(",");
  const first = rest.join(",").trim();
  return first && last ? `${first} ${last.trim()}` : null;
}

function surnameTailAlias(value: string) {
  const parts = value.split(/\s+/).filter(Boolean);
  return parts.length >= 3 ? parts.slice(-2).join(" ") : null;
}

function personNameAliases(...values: Array<string | null | undefined>) {
  const aliases: string[] = [];
  for (const value of values) {
    const normalized = normalizePersonName(value);
    if (!normalized) continue;
    aliases.push(normalized);
    const reordered = normalized.includes(",") ? reorderCommaName(normalized) : null;
    if (reordered) aliases.push(reordered);
    const tail = surnameTailAlias(reordered ?? normalized);
    if (tail) aliases.push(tail);
  }
  return compactTerms(aliases);
}

function officeSearchKeyword(officeTitle: string | null | undefined) {
  const office = officeTitle?.toLowerCase() ?? "";
  if (office.includes("senator") || office.includes("senate")) return "Senate";
  if (office.includes("representative") || office.includes("congress")) return "Congress";
  if (office.includes("assembly")) return "Assembly";
  if (office.includes("governor")) return "Governor";
  if (office.includes("attorney general")) return "Attorney General";
  return null;
}

export function generateCandidateNewsQueries(candidate: CandidateTarget) {
  const names = personNameAliases(candidate.ballotName, candidate.fullName);
  const primaryName = exactQuoted(names[0]);
  const legalName = exactQuoted(names.find((name) => name.toLowerCase() === normalizePersonName(candidate.fullName).toLowerCase()));
  const aliasName = names.find((name) => name !== names[0] && !name.includes(","));
  const office = candidate.officeTitle;
  const officeKeyword = officeSearchKeyword(office);
  const state = candidate.jurisdictionName.includes("Nevada") || candidate.jurisdictionName === "Nevada" ? "Nevada" : `${candidate.jurisdictionName} Nevada`;

  return compactTerms([
    primaryName,
    primaryName ? `${primaryName} Nevada` : null,
    primaryName && officeKeyword ? `${primaryName} ${officeKeyword}` : null,
    primaryName && office ? `${primaryName} ${office}` : null,
    primaryName ? `${primaryName} campaign` : null,
    primaryName ? `${primaryName} election` : null,
    legalName && legalName !== primaryName ? `${legalName} Nevada` : null,
    aliasName ? exactQuoted(aliasName) : null,
    primaryName ? `${primaryName} ${candidate.electionYear}` : null,
    primaryName ? `${primaryName} ${state}` : null,
  ]).slice(0, 6);
}

export function generateOfficialNewsQueries(official: OfficialTarget) {
  const names = personNameAliases(official.fullName);
  const name = exactQuoted(names[0]);
  const aliasName = names.find((alias) => alias !== names[0] && !alias.includes(","));
  const office = official.officeTitle;
  const officeKeyword = officeSearchKeyword(office);
  const state = official.jurisdictionName.includes("Nevada") || official.jurisdictionName === "Nevada" ? "Nevada" : `${official.jurisdictionName} Nevada`;

  return compactTerms([
    name,
    name ? `${name} Nevada` : null,
    name && officeKeyword ? `${name} ${officeKeyword}` : null,
    name && office ? `${name} ${office}` : null,
    aliasName ? exactQuoted(aliasName) : null,
    name ? `${name} ${state}` : null,
  ]).slice(0, 6);
}

function queryForTarget(target: NewsTarget) {
  if (target.targetType === "CANDIDATE") return generateCandidateNewsQueries(target);
  if (target.targetType === "OFFICIAL") return generateOfficialNewsQueries(target);
  return compactTerms([exactQuoted(target.fullName), ...target.topicTerms]).slice(0, 8);
}

function carsonCityQueries() {
  return [
    "Carson City",
    "Board of Supervisors",
    "Mayor Carson City",
    "Clerk-Recorder Carson City",
    "Assessor Carson City",
    "Sheriff Carson City",
    "District Attorney Carson City",
    "School Board Carson City",
    "Planning Commission Carson City",
    "Carson City elections",
    "Carson City ballot question",
    "Carson City campaign",
    "Carson City candidate",
  ];
}

function queryForProviderTarget(providerName: NewsMentionProviderName, target: NewsTarget) {
  const baseQueries = queryForTarget(target);
  if (providerName !== NewsMentionProviderName.CARSON_NOW && providerName !== NewsMentionProviderName.LOCAL_CONFIGURED) return baseQueries;
  if (target.targetType !== "CANDIDATE" && target.targetType !== "OFFICIAL") return baseQueries.slice(0, 6);
  const targetJurisdiction = target.jurisdictionName.toLowerCase();
  const localContext = targetJurisdiction.includes("carson") ? ["Carson City", "Board of Supervisors", "elections", "campaign"] : [];
  return compactTerms([...baseQueries.slice(0, 1), ...localContext.slice(0, 1).map((term) => `${baseQueries[0] ?? target.fullName} ${term}`)]).slice(0, 2);
}

const PRIORITY_NEWS_NAMES = [
  "catherine cortez masto",
  "joe lombardo",
  "stavros anthony",
  "aaron ford",
  "cisco aguilar",
  "zach conine",
  "andy matthews",
  "jacky rosen",
];

function priorityNewsRank(target: NewsTarget) {
  if (target.targetType !== "CANDIDATE" && target.targetType !== "OFFICIAL") return PRIORITY_NEWS_NAMES.length + 20;
  const name = target.fullName.toLowerCase().replace(/\s*,\s*/g, ", ");
  const reordered = name.includes(",") ? reorderCommaName(name)?.toLowerCase() ?? name : name;
  const index = PRIORITY_NEWS_NAMES.findIndex((priorityName) => name.includes(priorityName) || reordered.includes(priorityName));
  if (index >= 0) return index;
  if (target.targetType === "OFFICIAL" && target.jurisdictionName === "Nevada") return PRIORITY_NEWS_NAMES.length;
  return PRIORITY_NEWS_NAMES.length + 10;
}

function queryHasExactName(target: NewsTarget, query: string) {
  const queryLower = query.toLowerCase();
  return personNameAliases(target.fullName, target.targetType === "CANDIDATE" ? target.ballotName : null).some((name) =>
    queryLower.includes(`"${name.toLowerCase()}"`),
  );
}

function scoreMention(target: NewsTarget, result: NormalizedNewsResult, query: string) {
  const haystack = `${result.title} ${result.snippetOrSummary ?? ""}`.toLowerCase();
  const aliases = personNameAliases(target.fullName, target.targetType === "CANDIDATE" ? target.ballotName : null).map((name) => name.toLowerCase());
  const office = target.officeTitle?.toLowerCase() ?? "";
  const jurisdiction = target.jurisdictionName.toLowerCase();
  const exactName = aliases.some((name) => haystack.includes(name)) || queryHasExactName(target, query);
  const officeMatch = office ? haystack.includes(office) : false;
  const carsonMatch = haystack.includes("carson city") || query.toLowerCase().includes("carson city");
  const civicContext =
    haystack.includes("board of supervisors") ||
    haystack.includes("planning commission") ||
    haystack.includes("school board") ||
    haystack.includes("sheriff") ||
    haystack.includes("assessor") ||
    haystack.includes("clerk-recorder") ||
    haystack.includes("district attorney");
  const nevadaMatch = haystack.includes("nevada") || haystack.includes("reno") || haystack.includes("washoe") || haystack.includes(jurisdiction) || query.toLowerCase().includes("nevada") || carsonMatch;
  const campaignContext =
    haystack.includes("campaign") ||
    haystack.includes("election") ||
    haystack.includes("candidate") ||
    haystack.includes("senate") ||
    haystack.includes("assembly") ||
    query.toLowerCase().includes("senator") ||
    query.toLowerCase().includes("representative");

  if (target.targetType !== "CANDIDATE" && target.targetType !== "OFFICIAL") {
    if (exactName && (civicContext || campaignContext || haystack.includes("meeting") || haystack.includes("agenda") || haystack.includes("ballot"))) return 0.86;
    if (exactName && (haystack.includes("government") || haystack.includes("supervisors") || haystack.includes("public"))) return 0.68;
    if (exactName || civicContext || campaignContext) return 0.48;
    return 0.35;
  }

  if (exactName && (officeMatch || campaignContext || civicContext) && nevadaMatch) return 0.9;
  if (exactName && nevadaMatch) return 0.72;
  if (exactName) return 0.58;
  return 0.35;
}

function reviewStatusForConfidence(score: number) {
  if (score >= 0.85) return CivicRecordReviewStatus.approved;
  return CivicRecordReviewStatus.pending_review;
}

function matchedTermsFor(target: NewsTarget, result: NormalizedNewsResult) {
  const haystack = `${result.title} ${result.snippetOrSummary ?? ""}`.toLowerCase();
  const matchedNames = personNameAliases(target.fullName, target.targetType === "CANDIDATE" ? target.ballotName : null).filter((name) =>
    haystack.includes(name.toLowerCase()),
  );
  return compactTerms([
    ...matchedNames,
    target.officeTitle && haystack.includes(target.officeTitle.toLowerCase()) ? target.officeTitle : null,
    haystack.includes("nevada") ? "Nevada" : null,
    haystack.includes("campaign") ? "campaign" : null,
    haystack.includes("election") ? "election" : null,
    haystack.includes("carson city") ? "Carson City" : null,
    haystack.includes("board of supervisors") ? "Board of Supervisors" : null,
  ]);
}

function mapMention(row: NewsMention): PublicNewsMentionSummary {
  return {
    id: row.id,
    title: row.title,
    sourceName: row.sourceName,
    sourceDomain: row.sourceDomain,
    url: row.url,
    canonicalUrl: row.canonicalUrl,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    snippetOrSummary: row.snippetOrSummary,
    provider: row.provider,
    reviewStatus: row.reviewStatus,
    confidenceScore: row.confidenceScore,
  };
}

export async function getPublicNewsMentions(targetType: NewsMentionTargetType, targetId: string) {
  const mentions = await prisma.newsMention.findMany({
    where: {
      targetType,
      targetId,
      reviewStatus: { in: [...PUBLIC_REVIEW_STATUSES] },
    },
    orderBy: [{ publishedAt: "desc" }, { discoveredAt: "desc" }],
    take: 8,
  });

  return mentions.map(mapMention);
}

export async function getProfileNewsMentionCard(
  targetType: NewsMentionTargetType,
  targetId: string,
  options: { includePending?: boolean } = {},
): Promise<ProfileNewsMentionCardData> {
  const visibleStatuses = options.includePending
    ? [...PUBLIC_REVIEW_STATUSES, CivicRecordReviewStatus.pending_review]
    : [...PUBLIC_REVIEW_STATUSES];
  const [mentions, statusCounts, lastRun] = await Promise.all([
    prisma.newsMention.findMany({
      where: {
        targetType,
        targetId,
        reviewStatus: { in: visibleStatuses },
      },
      orderBy: [{ publishedAt: "desc" }, { discoveredAt: "desc" }],
      take: 8,
    }),
    prisma.newsMention.groupBy({
      by: ["reviewStatus"],
      where: { targetType, targetId },
      _count: { _all: true },
    }),
    prisma.newsMentionSearchRun.findFirst({
      where: { targetType, targetId },
      orderBy: { startedAt: "desc" },
      select: {
        provider: true,
        startedAt: true,
        completedAt: true,
        status: true,
        matchedQuery: true,
      },
    }),
  ]);
  const countFor = (status: CivicRecordReviewStatus) => statusCounts.find((row) => row.reviewStatus === status)?._count._all ?? 0;

  return {
    mentions: mentions.map(mapMention),
    totalCount: statusCounts.reduce((sum, row) => sum + row._count._all, 0),
    approvedCount: countFor(CivicRecordReviewStatus.approved),
    verifiedCount: countFor(CivicRecordReviewStatus.verified),
    pendingCount: countFor(CivicRecordReviewStatus.pending_review),
    providerUsed: lastRun?.provider ?? mentions[0]?.provider ?? null,
    lastImportRun: lastRun
      ? {
          startedAt: lastRun.startedAt.toISOString(),
          completedAt: lastRun.completedAt?.toISOString() ?? null,
          status: lastRun.status,
          matchedQuery: lastRun.matchedQuery,
        }
      : null,
  };
}

export async function getAdminNewsMentionQueue(status: CivicRecordReviewStatus | "all" = CivicRecordReviewStatus.pending_review) {
  const mentions = await prisma.newsMention.findMany({
    where: status === "all" ? undefined : { reviewStatus: status },
    orderBy: [{ discoveredAt: "desc" }],
    take: 100,
  });

  return mentions.map(mapMention);
}

export async function getNewsMentionDiagnostics(options: { targetType?: NewsMentionTargetType; targetId?: string } = {}) {
  const provider = createNewsProvider(NewsMentionProviderName.CARSON_NOW);
  const [health, totalMentions, statusCounts, lastRun] = await Promise.all([
    provider.healthCheck(),
    prisma.newsMention.count(),
    prisma.newsMention.groupBy({ by: ["reviewStatus"], _count: { _all: true } }),
    prisma.newsMentionSearchRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);
  let targetType = options.targetType;
  let targetId = options.targetId;
  let targetLabel: string | null = null;

  if (!targetType || !targetId) {
    const catherine = await prisma.official.findFirst({
      where: { fullName: { contains: "Catherine Cortez Masto", mode: "insensitive" } },
      select: { id: true, fullName: true },
    });
    if (catherine) {
      targetType = NewsMentionTargetType.OFFICIAL;
      targetId = catherine.id;
      targetLabel = catherine.fullName;
    }
  }

  if (targetType && targetId && !targetLabel) {
    if (targetType === NewsMentionTargetType.CANDIDATE) {
      const candidate = await prisma.candidate.findUnique({ where: { id: targetId }, select: { fullName: true, ballotName: true } });
      targetLabel = candidate?.ballotName ?? candidate?.fullName ?? null;
    } else if (targetType === NewsMentionTargetType.OFFICIAL) {
      const official = await prisma.official.findUnique({ where: { id: targetId }, select: { fullName: true } });
      targetLabel = official?.fullName ?? null;
    }
  }

  const profileMentions =
    targetType && targetId
      ? await prisma.newsMention.findMany({
          where: { targetType, targetId },
          orderBy: [{ publishedAt: "desc" }, { discoveredAt: "desc" }],
          take: 10,
        })
      : [];
  const profileStatusCounts =
    targetType && targetId
      ? await prisma.newsMention.groupBy({
          by: ["reviewStatus"],
          where: { targetType, targetId },
          _count: { _all: true },
        })
      : [];

  return {
    providerUsed: provider.providerName,
    providerHealth: health,
    totalMentions,
    statusCounts: statusCounts.map((row) => ({ reviewStatus: row.reviewStatus, count: row._count._all })),
    lastRun,
    targetType: targetType ?? null,
    targetId: targetId ?? null,
    targetLabel,
    profileMentionCount: profileMentions.length,
    profileStatusCounts: profileStatusCounts.map((row) => ({ reviewStatus: row.reviewStatus, count: row._count._all })),
    profileMentions: profileMentions.map(mapMention),
  };
}

async function getRequestCountToday(provider: NewsMentionProviderName) {
  const result = await prisma.newsMentionSearchRun.aggregate({
    where: {
      provider,
      startedAt: { gte: startOfToday() },
    },
    _sum: { requestCount: true },
  });
  return result._sum.requestCount ?? 0;
}

async function wasTargetSearchedToday(provider: NewsMentionProviderName, target: NewsTarget) {
  const count = await prisma.newsMentionSearchRun.count({
    where: {
      provider,
      targetType: target.targetType,
      targetId: target.id,
      startedAt: { gte: startOfToday() },
    },
  });
  return count > 0;
}

async function loadTargets(limit: number): Promise<NewsTarget[]> {
  const [candidates, officials] = await Promise.all([
    prisma.candidate.findMany({
      where: { status: { not: "NEEDS_REVIEW" } },
      include: {
        office: { select: { title: true } },
        district: { select: { name: true } },
        jurisdiction: { select: { name: true } },
        election: { select: { title: true, electionDate: true } },
        _count: { select: { newsMentions: true } },
      },
      orderBy: [{ election: { electionDate: "asc" } }, { updatedAt: "desc" }],
      take: Math.max(limit * 6, 100),
    }),
    prisma.official.findMany({
      where: { status: "CURRENT" },
      include: {
        office: { select: { title: true, level: true } },
        district: { select: { name: true } },
        jurisdiction: { select: { name: true } },
        _count: { select: { newsMentions: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: Math.max(limit * 6, 100),
    }),
  ]);

  const now = Date.now();
  const candidateTargets: CandidateTarget[] = candidates.map((candidate) => ({
    targetType: "CANDIDATE",
    id: candidate.id,
    fullName: candidate.fullName,
    ballotName: candidate.ballotName,
    partyText: candidate.partyText,
    officeTitle: candidate.office?.title ?? null,
    districtName: candidate.district?.name ?? null,
    jurisdictionName: candidate.jurisdiction.name,
    electionTitle: candidate.election.title,
    electionDate: candidate.election.electionDate,
    electionYear: candidate.election.electionDate.getUTCFullYear(),
    status: candidate.status,
    mentionCount: candidate._count.newsMentions,
  }));
  const officialTargets: OfficialTarget[] = officials.map((official) => ({
    targetType: "OFFICIAL",
    id: official.id,
    fullName: official.fullName,
    partyText: official.partyText,
    officeTitle: official.office.title,
    officeLevel: official.office.level,
    districtName: official.district?.name ?? null,
    jurisdictionName: official.jurisdiction.name,
    status: official.status,
    mentionCount: official._count.newsMentions,
  }));

  const sortedCandidates = candidateTargets.sort((left, right) => {
      const emptyDelta = Number(left.mentionCount > 0) - Number(right.mentionCount > 0);
      if (emptyDelta) return emptyDelta;
    return Math.abs(left.electionDate.getTime() - now) - Math.abs(right.electionDate.getTime() - now);
  });
  const sortedOfficials = officialTargets.sort((left, right) => {
    const priorityDelta = priorityNewsRank(left) - priorityNewsRank(right);
    if (priorityDelta) return priorityDelta;
    const emptyDelta = Number(left.mentionCount > 0) - Number(right.mentionCount > 0);
    if (emptyDelta) return emptyDelta;
    const levelRank = (value: string) => (value === "FEDERAL" ? 0 : value === "STATE" ? 1 : 2);
    const levelDelta = levelRank(left.officeLevel) - levelRank(right.officeLevel);
    if (levelDelta) return levelDelta;
    return left.fullName.localeCompare(right.fullName);
  });
  const targets: NewsTarget[] = [];
  const maxPerGroup = Math.max(1, Math.ceil(limit / 2));
  targets.push(...sortedOfficials.slice(0, maxPerGroup), ...sortedCandidates.slice(0, maxPerGroup));
  return targets.slice(0, limit);
}

async function loadLocalNewsTopicTargets(providerName: NewsMentionProviderName, sourceSlug?: string): Promise<NewsTarget[]> {
  if (providerName !== NewsMentionProviderName.CARSON_NOW && providerName !== NewsMentionProviderName.LOCAL_CONFIGURED) return [];
  const source = await prisma.newsSource.findUnique({ where: { sourceSlug: sourceSlug ?? "carson_now" } }).catch(() => null);
  const jurisdiction = await prisma.jurisdiction.findFirst({
    where: { OR: [{ slug: "carson-city" }, { name: { contains: "Carson City", mode: "insensitive" } }] },
    select: { id: true, name: true },
  }).catch(() => null);
  const terms = source?.defaultQueryTerms?.length
    ? source.defaultQueryTerms
    : carsonCityQueries();
  return [
    {
      targetType: "JURISDICTION",
      id: jurisdiction?.id ?? `news-source:${sourceSlug ?? "carson_now"}:carson-city`,
      fullName: jurisdiction?.name ?? "Carson City",
      topicTerms: terms,
      officeTitle: null,
      jurisdictionName: jurisdiction?.name ?? source?.jurisdiction ?? "Carson City",
      mentionCount: await prisma.newsMention.count({
        where: {
          targetType: NewsMentionTargetType.JURISDICTION,
          targetId: jurisdiction?.id ?? `news-source:${sourceSlug ?? "carson_now"}:carson-city`,
        },
      }).catch(() => 0),
    },
  ];
}

async function loadTargetById(targetType: NewsMentionTargetType, targetId: string): Promise<NewsTarget | null> {
  if (targetType === NewsMentionTargetType.CANDIDATE) {
    const candidate = await prisma.candidate.findUnique({
      where: { id: targetId },
      include: {
        office: { select: { title: true } },
        district: { select: { name: true } },
        jurisdiction: { select: { name: true } },
        election: { select: { title: true, electionDate: true } },
        _count: { select: { newsMentions: true } },
      },
    });
    if (!candidate) return null;
    return {
      targetType: "CANDIDATE",
      id: candidate.id,
      fullName: candidate.fullName,
      ballotName: candidate.ballotName,
      partyText: candidate.partyText,
      officeTitle: candidate.office?.title ?? null,
      districtName: candidate.district?.name ?? null,
      jurisdictionName: candidate.jurisdiction.name,
      electionTitle: candidate.election.title,
      electionDate: candidate.election.electionDate,
      electionYear: candidate.election.electionDate.getUTCFullYear(),
      status: candidate.status,
      mentionCount: candidate._count.newsMentions,
    };
  }

  if (targetType === NewsMentionTargetType.OFFICIAL) {
    const official = await prisma.official.findUnique({
      where: { id: targetId },
      include: {
        office: { select: { title: true, level: true } },
        district: { select: { name: true } },
        jurisdiction: { select: { name: true } },
        _count: { select: { newsMentions: true } },
      },
    });
    if (!official) return null;
    return {
      targetType: "OFFICIAL",
      id: official.id,
      fullName: official.fullName,
      partyText: official.partyText,
      officeTitle: official.office.title,
      officeLevel: official.office.level,
      districtName: official.district?.name ?? null,
      jurisdictionName: official.jurisdiction.name,
      status: official.status,
      mentionCount: official._count.newsMentions,
    };
  }

  return null;
}

export async function importNewsMentions(options: NewsMentionImportOptions = {}) {
  const providerName = options.providerName ?? NewsMentionProviderName.NEWS_API_ORG;
  const provider = createNewsProvider(providerName, { sourceSlug: options.sourceSlug });
  const health = await provider.healthCheck();
  const dailyCap = Math.max(0, options.dailyCap ?? DEFAULT_DAILY_CAP);
  const pageSize = Math.max(1, Math.min(options.pageSize ?? 5, 20));
  const limit = Math.max(0, options.limit ?? 10);
  const totals = {
    ok: health.ok,
    provider: provider.providerName,
    healthMessage: health.message,
    dailyCap,
    alreadyUsed: await getRequestCountToday(providerName),
    searchedTargets: 0,
    requests: 0,
    found: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    dryRun: Boolean(options.dryRun),
  };

  if (!health.ok || limit === 0) {
    return totals;
  }

  const explicitTarget = options.targetType && options.targetId ? await loadTargetById(options.targetType, options.targetId) : null;
  const localTopicTargets = explicitTarget ? [] : await loadLocalNewsTopicTargets(providerName, options.sourceSlug);
  const targets = explicitTarget ? [explicitTarget] : [...localTopicTargets, ...(await loadTargets(limit))].slice(0, limit);

  for (const target of targets) {
    if (totals.alreadyUsed + totals.requests >= dailyCap) break;
    if (!options.force && await wasTargetSearchedToday(providerName, target)) {
      totals.skipped += 1;
      continue;
    }

    const queries = queryForProviderTarget(providerName, target);
    totals.searchedTargets += 1;

    for (const query of queries) {
      if (totals.alreadyUsed + totals.requests >= dailyCap) break;
      const queryHash = hashNewsValue(`${providerName}:${target.targetType}:${target.id}:${query}`);
      const run = options.dryRun
        ? null
        : await prisma.newsMentionSearchRun.create({
            data: {
              provider: providerName,
              targetType: target.targetType,
              targetId: target.id,
              matchedQuery: query,
              queryHash,
              status: SourceSyncStatus.SYNCING,
            },
          });

      try {
        totals.requests += 1;
        const rawResults = await provider.searchMentions(query, {
          pageSize,
          from: daysAgo(30),
          to: new Date(),
        });
        totals.found += rawResults.length;

        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (const raw of rawResults) {
          const normalized = provider.normalizeResult(raw);
          if (!normalized) {
            skipped += 1;
            continue;
          }

          const score = scoreMention(target, normalized, query);
          const duplicateHash = duplicateHashFor(target, normalized);
          const data = {
            targetType: target.targetType,
            targetId: target.id,
            candidateId: target.targetType === "CANDIDATE" ? target.id : null,
            officialId: target.targetType === "OFFICIAL" ? target.id : null,
            title: normalized.title,
            sourceName: normalized.sourceName,
            sourceDomain: normalized.sourceDomain,
            url: normalized.url,
            canonicalUrl: normalized.canonicalUrl ? canonicalUrl(normalized.canonicalUrl) : canonicalUrl(normalized.url),
            publishedAt: normalized.publishedAt,
            snippetOrSummary: normalized.snippetOrSummary,
            matchedQuery: query,
            matchedTerms: matchedTermsFor(target, normalized),
            confidenceScore: score,
            provider: providerName,
            reviewStatus: reviewStatusForConfidence(score),
          };

          if (options.dryRun) {
            skipped += 1;
            continue;
          }

          const existing = await prisma.newsMention.findUnique({ where: { duplicateHash }, select: { id: true } });
          await prisma.newsMention.upsert({
            where: { duplicateHash },
            create: { ...data, duplicateHash },
            update: {
              targetType: data.targetType,
              targetId: data.targetId,
              candidateId: data.candidateId,
              officialId: data.officialId,
              title: data.title,
              sourceName: data.sourceName,
              sourceDomain: data.sourceDomain,
              url: data.url,
              canonicalUrl: data.canonicalUrl,
              publishedAt: data.publishedAt,
              snippetOrSummary: data.snippetOrSummary,
              matchedQuery: data.matchedQuery,
              matchedTerms: data.matchedTerms,
              confidenceScore: data.confidenceScore,
              provider: data.provider,
            },
          });
          if (existing) updated += 1;
          else created += 1;
        }

        totals.created += created;
        totals.updated += updated;
        totals.skipped += skipped;

        if (run) {
          await prisma.newsMentionSearchRun.update({
            where: { id: run.id },
            data: {
              completedAt: new Date(),
              status: SourceSyncStatus.SUCCESS,
              requestCount: 1,
              recordsFound: rawResults.length,
              recordsCreated: created,
              recordsUpdated: updated,
              recordsSkipped: skipped,
            },
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown news import error.";
        if (run) {
          await prisma.newsMentionSearchRun.update({
            where: { id: run.id },
            data: {
              completedAt: new Date(),
              status: SourceSyncStatus.ERROR,
              requestCount: 1,
              errorLog: message,
            },
          });
        }
      }
    }
  }

  return totals;
}
