import "server-only";

import { CandidateKnowledgeSourceType, ProfileEnrichmentReviewStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type CandidateKnowledgeSourceInput = {
  url: string;
  sourceName?: string;
  sourceType?: CandidateKnowledgeSourceType;
};

const FETCH_TIMEOUT_MS = 7000;
const RATE_LIMIT_MS = 900;
let lastFetchAt = 0;

const NEWS_HOST_PARTS = [
  "apnews.com",
  "reuters.com",
  "reviewjournal.com",
  "thenevadaindependent.com",
  "rgj.com",
  "kunr.org",
  "knpr.org",
  "kolotv.com",
  "ktvn.com",
];

const SOCIAL_HOST_PARTS = ["x.com", "twitter.com", "facebook.com", "instagram.com", "threads.net", "youtube.com", "tiktok.com", "linkedin.com"];

export type PublicCandidateKnowledgeSection = {
  id: string;
  sourceUrl: string;
  sourceName: string;
  sourceType: string;
  sourcePriority: number;
  title: string | null;
  aboutSummary: string | null;
  ownWordsSummary: string | null;
  issues: Array<{ label: string; summary: string; sourceUrl: string }>;
  experienceSummary: string | null;
  financeContext: string | null;
  newsItems: Array<{ title: string; summary: string; sourceUrl: string; sourceName: string }>;
  socialLinks: string[];
  confidenceScore: number;
  reviewStatus: string;
  lastUpdatedAt: Date;
};

export type AdminCandidateKnowledgeRow = PublicCandidateKnowledgeSection & {
  candidateId: string;
  candidateName: string;
  errorLog: string | null;
  reviewNotes: string | null;
  fetchedAt: Date;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripHtml(value: string) {
  return normalizeWhitespace(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"'),
  );
}

function summarizeText(value: string, maxLength = 520) {
  const text = normalizeWhitespace(value);
  if (!text) return null;
  const sentences = text.match(/[^.!?]+[.!?]+/g)?.map((sentence) => normalizeWhitespace(sentence)) ?? [text];
  const summary = sentences.slice(0, 3).join(" ");
  return summary.length > maxLength ? `${summary.slice(0, maxLength - 3).trimEnd()}...` : summary;
}

function safeUrl(value: string | null | undefined, base?: string) {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function sourcePriority(sourceType: CandidateKnowledgeSourceType) {
  switch (sourceType) {
    case CandidateKnowledgeSourceType.CAMPAIGN_WEBSITE:
    case CandidateKnowledgeSourceType.OFFICIAL_WEBSITE:
      return 1;
    case CandidateKnowledgeSourceType.SOS_PUBLIC_MEDIA:
      return 2;
    case CandidateKnowledgeSourceType.BALLOTPEDIA:
      return 3;
    case CandidateKnowledgeSourceType.VOTE_SMART:
      return 4;
    case CandidateKnowledgeSourceType.FILING_RECORD:
    case CandidateKnowledgeSourceType.CAMPAIGN_FINANCE:
      return 5;
    case CandidateKnowledgeSourceType.NEWS_ARTICLE:
    case CandidateKnowledgeSourceType.PRESS_RELEASE:
      return 6;
    case CandidateKnowledgeSourceType.LEGISLATIVE_VOTE:
      return 6;
    case CandidateKnowledgeSourceType.SOCIAL_PROFILE:
    case CandidateKnowledgeSourceType.OFFICIAL_SOCIAL:
      return 7;
    default:
      return 8;
  }
}

export function classifyCandidateKnowledgeSource(urlValue: string, explicitType?: CandidateKnowledgeSourceType) {
  if (explicitType) return explicitType;
  const url = new URL(urlValue);
  const host = url.hostname.toLowerCase();

  if (host.includes("ballotpedia.org")) return CandidateKnowledgeSourceType.BALLOTPEDIA;
  if (host.includes("votesmart.org")) return CandidateKnowledgeSourceType.VOTE_SMART;
  if (host.includes("nvsos.gov")) return CandidateKnowledgeSourceType.SOS_PUBLIC_MEDIA;
  if (host.includes("leg.state.nv.us") || host.includes("congress.gov")) return CandidateKnowledgeSourceType.LEGISLATIVE_VOTE;
  if (url.pathname.toLowerCase().includes("press") || host.includes("prnewswire.com")) return CandidateKnowledgeSourceType.PRESS_RELEASE;
  if (host.includes("fec.gov") || host.includes("docquery.fec.gov") || host.includes("campaignfinance")) return CandidateKnowledgeSourceType.CAMPAIGN_FINANCE;
  if (SOCIAL_HOST_PARTS.some((part) => host.includes(part))) return CandidateKnowledgeSourceType.SOCIAL_PROFILE;
  if (NEWS_HOST_PARTS.some((part) => host.includes(part))) return CandidateKnowledgeSourceType.NEWS_ARTICLE;
  return CandidateKnowledgeSourceType.CAMPAIGN_WEBSITE;
}

function sourceNameForType(sourceType: CandidateKnowledgeSourceType) {
  switch (sourceType) {
    case CandidateKnowledgeSourceType.CAMPAIGN_WEBSITE:
      return "Candidate/campaign official website";
    case CandidateKnowledgeSourceType.OFFICIAL_WEBSITE:
      return "Official website";
    case CandidateKnowledgeSourceType.SOS_PUBLIC_MEDIA:
      return "Nevada SOS public candidate media";
    case CandidateKnowledgeSourceType.BALLOTPEDIA:
      return "Ballotpedia Candidate Connection";
    case CandidateKnowledgeSourceType.VOTE_SMART:
      return "Vote Smart";
    case CandidateKnowledgeSourceType.CAMPAIGN_FINANCE:
      return "Official campaign finance record";
    case CandidateKnowledgeSourceType.FILING_RECORD:
      return "Official filing record";
    case CandidateKnowledgeSourceType.NEWS_ARTICLE:
      return "Media coverage";
    case CandidateKnowledgeSourceType.PRESS_RELEASE:
      return "Press release";
    case CandidateKnowledgeSourceType.LEGISLATIVE_VOTE:
      return "Legislative vote";
    case CandidateKnowledgeSourceType.SOCIAL_PROFILE:
    case CandidateKnowledgeSourceType.OFFICIAL_SOCIAL:
      return "Official public social profile";
    default:
      return "Candidate knowledge source";
  }
}

function extractMeta(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  return pattern.exec(html)?.[1] ?? null;
}

function extractTitle(html: string) {
  return normalizeWhitespace(extractMeta(html, "og:title") ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
}

function extractLinks(html: string, sourceUrl: string) {
  return [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => safeUrl(match[1], sourceUrl))
    .filter((url): url is string => Boolean(url));
}

function extractIssues(text: string, sourceUrl: string) {
  const lower = text.toLowerCase();
  const labels = ["housing", "public safety", "education", "water", "transportation", "infrastructure", "healthcare", "jobs", "economy", "transparency", "veterans", "public lands"];

  return labels
    .filter((label) => lower.includes(label))
    .slice(0, 8)
    .map((label) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      summary: `This source mentions ${label} as part of the candidate context.`,
      sourceUrl,
    }));
}

function extractExperience(text: string) {
  const match = /(experience|background|served|worked|owned|teacher|attorney|veteran|commissioner|council|assembly|senate)[^.]{20,260}[.]/i.exec(text);
  return match ? summarizeText(match[0], 300) : null;
}

async function waitForRateLimit() {
  const elapsed = Date.now() - lastFetchAt;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }
  lastFetchAt = Date.now();
}

async function fetchTextWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    await waitForRateLimit();
    const response = await fetch(url, {
      headers: {
        "user-agent": "DirectDemocracyBot/0.1 candidate-knowledge-enrichment-review",
        accept: "text/html, text/plain;q=0.8",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Fetch failed with ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error(`Unsupported content type: ${contentType || "unknown"}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseKnowledgeJsonArray<T>(value: Prisma.JsonValue | null, fallback: T[] = []) {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function mapKnowledgeRow(row: Awaited<ReturnType<typeof prisma.candidateKnowledgeEnrichment.findMany>>[number]): PublicCandidateKnowledgeSection {
  return {
    id: row.id,
    sourceUrl: row.sourceUrl,
    sourceName: row.sourceName,
    sourceType: row.sourceType,
    sourcePriority: row.sourcePriority,
    title: row.title,
    aboutSummary: row.aboutSummary,
    ownWordsSummary: row.ownWordsSummary,
    issues: parseKnowledgeJsonArray(row.issues),
    experienceSummary: row.experienceSummary,
    financeContext: row.financeContext,
    newsItems: parseKnowledgeJsonArray(row.newsItems),
    socialLinks: parseKnowledgeJsonArray(row.socialLinks),
    confidenceScore: row.confidenceScore,
    reviewStatus: row.reviewStatus,
    lastUpdatedAt: row.lastUpdatedAt,
  };
}

export async function discoverCandidateKnowledgeSources(candidateId: string): Promise<CandidateKnowledgeSourceInput[]> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      election: { select: { officeTitle: true } },
      office: { select: { title: true } },
      source: { select: { name: true, url: true } },
    },
  });

  if (!candidate) return [];

  const name = candidate.ballotName ?? candidate.fullName;
  const office = candidate.office?.title ?? candidate.election.officeTitle;
  const query = encodeURIComponent(`${name} ${office} Nevada`);
  const sourceCandidates: Array<CandidateKnowledgeSourceInput | null> = [
    candidate.websiteUrl ? { url: candidate.websiteUrl, sourceType: CandidateKnowledgeSourceType.CAMPAIGN_WEBSITE } : null,
    candidate.sourceUrl ? { url: candidate.sourceUrl, sourceName: "Nevada SOS public media info", sourceType: CandidateKnowledgeSourceType.SOS_PUBLIC_MEDIA } : null,
    candidate.source?.url ? { url: candidate.source.url, sourceName: candidate.source.name, sourceType: CandidateKnowledgeSourceType.FILING_RECORD } : null,
    { url: `https://ballotpedia.org/wiki/index.php?search=${query}`, sourceType: CandidateKnowledgeSourceType.BALLOTPEDIA },
    { url: `https://justfacts.votesmart.org/search?q=${query}`, sourceType: CandidateKnowledgeSourceType.VOTE_SMART },
  ];
  const sources = sourceCandidates.filter((source): source is CandidateKnowledgeSourceInput => Boolean(source?.url));

  const seen = new Set<string>();
  return sources.filter((source) => {
    const normalizedUrl = safeUrl(source.url);
    if (!normalizedUrl || seen.has(normalizedUrl)) return false;
    seen.add(normalizedUrl);
    source.url = normalizedUrl;
    return true;
  });
}

export async function runCandidateKnowledgeEnrichment({
  candidateId,
  source,
}: {
  candidateId: string;
  source?: CandidateKnowledgeSourceInput | null;
}) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      election: { select: { title: true, officeTitle: true } },
      office: { select: { title: true } },
      jurisdiction: { select: { name: true } },
    },
  });

  if (!candidate) {
    throw new Error("Candidate was not found.");
  }

  const discoveredSources = source ? [source] : await discoverCandidateKnowledgeSources(candidateId);
  const results = [];

  for (const item of discoveredSources) {
    const url = safeUrl(item.url);
    if (!url) continue;

    const sourceType = classifyCandidateKnowledgeSource(url, item.sourceType);
    const sourceName = item.sourceName ?? sourceNameForType(sourceType);
    const isSocialSource = sourceType === CandidateKnowledgeSourceType.OFFICIAL_SOCIAL || sourceType === CandidateKnowledgeSourceType.SOCIAL_PROFILE;
    const fetchedAt = new Date();
    let title: string | null = null;
    let aboutSummary: string | null = null;
    let ownWordsSummary: string | null = null;
    let experienceSummary: string | null = null;
    let financeContext: string | null = null;
    let issues: Array<{ label: string; summary: string; sourceUrl: string }> = [];
    let newsItems: Array<{ title: string; summary: string; sourceUrl: string; sourceName: string }> = [];
    let socialLinks: string[] = [];
    let confidenceScore = 0.35;
    let errorLog: string | null = null;

    try {
      if (isSocialSource) {
        title = `${candidate.ballotName ?? candidate.fullName} public social profile`;
        socialLinks = [url];
        confidenceScore = 0.72;
      } else {
        const html = await fetchTextWithTimeout(url);
        const text = stripHtml(html);
        const description = extractMeta(html, "description") ?? extractMeta(html, "og:description");
        title = extractTitle(html) || `${candidate.ballotName ?? candidate.fullName} source`;
        const summarySource = description ?? text;
        aboutSummary = sourceType === CandidateKnowledgeSourceType.NEWS_ARTICLE ? null : summarizeText(summarySource);
        ownWordsSummary =
          sourceType === CandidateKnowledgeSourceType.CAMPAIGN_WEBSITE ||
          sourceType === CandidateKnowledgeSourceType.OFFICIAL_WEBSITE ||
          sourceType === CandidateKnowledgeSourceType.SOS_PUBLIC_MEDIA ||
          sourceType === CandidateKnowledgeSourceType.BALLOTPEDIA ||
          sourceType === CandidateKnowledgeSourceType.PRESS_RELEASE
            ? summarizeText(summarySource, 460)
            : null;
        issues = extractIssues(text, url);
        experienceSummary = extractExperience(text);
        financeContext = sourceType === CandidateKnowledgeSourceType.CAMPAIGN_FINANCE || sourceType === CandidateKnowledgeSourceType.FILING_RECORD ? summarizeText(summarySource, 420) : null;
        newsItems =
          sourceType === CandidateKnowledgeSourceType.NEWS_ARTICLE || sourceType === CandidateKnowledgeSourceType.PRESS_RELEASE
            ? [{ title: title ?? sourceName, summary: summarizeText(summarySource, 420) ?? "Media coverage summary pending review.", sourceUrl: url, sourceName }]
            : [];
        socialLinks = extractLinks(html, url)
          .filter((link) => SOCIAL_HOST_PARTS.some((host) => new URL(link).hostname.toLowerCase().includes(host)))
          .slice(0, 5);
        confidenceScore = Math.min(0.95, 0.25 + (aboutSummary ? 0.2 : 0) + (ownWordsSummary ? 0.2 : 0) + (issues.length ? 0.15 : 0) + (experienceSummary ? 0.1 : 0) + (socialLinks.length ? 0.05 : 0));
      }
    } catch (error) {
      errorLog = error instanceof Error ? error.message : "Unknown candidate knowledge enrichment error.";
    }

    results.push(
      await prisma.candidateKnowledgeEnrichment.upsert({
        where: {
          candidateId_sourceUrl: {
            candidateId,
            sourceUrl: url,
          },
        },
        create: {
          candidateId,
          sourceUrl: url,
          sourceName,
          sourceType,
          sourcePriority: sourcePriority(sourceType),
          title,
          aboutSummary,
          ownWordsSummary,
          issues: toJson(issues),
          experienceSummary,
          financeContext,
          newsItems: toJson(newsItems),
          socialLinks: toJson(socialLinks),
          sourceAttribution: toJson([{ sourceName, sourceUrl: url, sourceType, extractionPolicy: isSocialSource ? "url_only_no_profile_text_scraping" : "source_text_extraction_pending_review" }]),
          confidenceScore,
          reviewStatus: errorLog ? ProfileEnrichmentReviewStatus.NEEDS_MORE_SOURCES : ProfileEnrichmentReviewStatus.PENDING_REVIEW,
          fetchedAt,
          lastUpdatedAt: fetchedAt,
          errorLog,
        },
        update: {
          sourceName,
          sourceType,
          sourcePriority: sourcePriority(sourceType),
          title,
          aboutSummary,
          ownWordsSummary,
          issues: toJson(issues),
          experienceSummary,
          financeContext,
          newsItems: toJson(newsItems),
          socialLinks: toJson(socialLinks),
          sourceAttribution: toJson([{ sourceName, sourceUrl: url, sourceType, extractionPolicy: isSocialSource ? "url_only_no_profile_text_scraping" : "source_text_extraction_pending_review" }]),
          confidenceScore,
          reviewStatus: errorLog ? ProfileEnrichmentReviewStatus.NEEDS_MORE_SOURCES : ProfileEnrichmentReviewStatus.PENDING_REVIEW,
          fetchedAt,
          lastUpdatedAt: fetchedAt,
          reviewedAt: null,
          reviewedByUserId: null,
          reviewNotes: null,
          errorLog,
        },
      }),
    );
  }

  return results;
}

export async function getApprovedCandidateKnowledge(candidateIds: string[]) {
  if (!candidateIds.length) return new Map<string, PublicCandidateKnowledgeSection[]>();

  const rows = await prisma.candidateKnowledgeEnrichment.findMany({
    where: {
      candidateId: { in: candidateIds },
      reviewStatus: { in: [ProfileEnrichmentReviewStatus.APPROVED, ProfileEnrichmentReviewStatus.VERIFIED] },
    },
    orderBy: [{ sourcePriority: "asc" }, { lastUpdatedAt: "desc" }],
  });

  const byCandidateId = new Map<string, PublicCandidateKnowledgeSection[]>();
  for (const row of rows) {
    const existing = byCandidateId.get(row.candidateId) ?? [];
    existing.push(mapKnowledgeRow(row));
    byCandidateId.set(row.candidateId, existing);
  }

  return byCandidateId;
}

export async function getAdminCandidateKnowledgeQueue(status?: string): Promise<AdminCandidateKnowledgeRow[]> {
  const where = status && status !== "all" ? { reviewStatus: status as ProfileEnrichmentReviewStatus } : undefined;
  const rows = await prisma.candidateKnowledgeEnrichment.findMany({
    where,
    include: {
      candidate: { select: { ballotName: true, fullName: true } },
    },
    orderBy: [{ reviewStatus: "asc" }, { sourcePriority: "asc" }, { fetchedAt: "desc" }],
    take: 100,
  });

  return rows.map((row) => ({
    ...mapKnowledgeRow(row),
    candidateId: row.candidateId,
    candidateName: row.candidate.ballotName ?? row.candidate.fullName,
    errorLog: row.errorLog,
    reviewNotes: row.reviewNotes,
    fetchedAt: row.fetchedAt,
  }));
}

export async function updateCandidateKnowledgeReviewStatus({
  enrichmentId,
  reviewStatus,
  reviewNotes,
  reviewerUserId,
}: {
  enrichmentId: string;
  reviewStatus: ProfileEnrichmentReviewStatus;
  reviewNotes?: string | null;
  reviewerUserId: string;
}) {
  return prisma.candidateKnowledgeEnrichment.update({
    where: { id: enrichmentId },
    data: {
      reviewStatus,
      reviewNotes,
      reviewedAt: new Date(),
      reviewedByUserId: reviewerUserId,
    },
  });
}
