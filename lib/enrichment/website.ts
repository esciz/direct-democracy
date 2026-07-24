import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getValidatedProfileImageUrl } from "@/lib/profile/media-validation";

export type EnrichmentTargetType = "CANDIDATE" | "OFFICIAL";
export type EnrichmentReviewStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "NEEDS_MORE_SOURCES" | "VERIFIED";

type EnrichmentCandidateTarget = {
  targetType: "CANDIDATE";
  id: string;
  name: string;
  websiteUrl: string | null;
  sourceUrl: string | null;
  sourceWebsiteUrl: string | null;
};

type EnrichmentOfficialTarget = {
  targetType: "OFFICIAL";
  id: string;
  name: string;
  websiteUrl: string | null;
  sourceWebsiteUrl: string | null;
};

type EnrichmentTarget = EnrichmentCandidateTarget | EnrichmentOfficialTarget;

type ProposedProfileFields = {
  shortBioSummary?: string;
  headshotImageUrl?: string;
  websiteUrl?: string;
  socialLinks?: string[];
  publicEmail?: string;
  publicPhone?: string;
  officeTitle?: string;
  districtOrJurisdiction?: string;
  party?: string;
  keyIssues?: string[];
};

type FieldSources = Partial<Record<keyof ProposedProfileFields, string[]>>;

export type AdminEnrichmentRow = {
  id: string;
  targetType: string;
  targetId: string;
  targetName: string;
  sourceUrl: string;
  fetchedAt: Date;
  confidenceScore: number;
  reviewStatus: string;
  reviewNotes: string | null;
  proposedFields: ProposedProfileFields;
  fieldSources: FieldSources;
  errorLog: string | null;
  campaignWebsiteUrl: string | null;
  officialWebsiteUrl: string | null;
  headshotUrl: string | null;
  shortBio: string | null;
  longBioSourceUrl: string | null;
  socialLinks: string[];
  publicContactEmail: string | null;
  publicContactPhone: string | null;
  sourceName: string | null;
  lastEnrichedAt: Date | null;
  enrichmentStatus: string;
};

export type AdminEnrichmentTargetRow = {
  id: string;
  targetType: EnrichmentTargetType;
  name: string;
  officeOrRace: string;
  jurisdictionName: string;
  websiteUrl: string | null;
  sourceUrl: string | null;
  latestStatus: string | null;
};

const BLOCKED_HOST_PARTS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "threads.net",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "news",
  "reviewjournal.com",
  "nytimes.com",
  "washingtonpost.com",
];

const SOCIAL_HOST_PARTS = ["twitter.com", "x.com", "facebook.com", "instagram.com", "threads.net", "youtube.com", "tiktok.com"];
const RATE_LIMIT_MS = 900;
const FETCH_TIMEOUT_MS = 6500;
let lastFetchAt = 0;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripHtml(value: string) {
  return normalizeWhitespace(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"'),
  );
}

function summarizeText(value: string, maxLength = 360) {
  const text = normalizeWhitespace(value);
  if (!text) return null;
  const sentences = text.match(/[^.!?]+[.!?]+/g)?.map((sentence) => normalizeWhitespace(sentence)) ?? [text];
  const summary = sentences.slice(0, 2).join(" ");
  return summary.length > maxLength ? `${summary.slice(0, maxLength - 1).trimEnd()}...` : summary;
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

function isAllowedSourceUrl(urlValue: string) {
  const url = new URL(urlValue);
  const host = url.hostname.toLowerCase();
  return !BLOCKED_HOST_PARTS.some((blocked) => host.includes(blocked));
}

function isSocialUrl(urlValue: string) {
  try {
    const host = new URL(urlValue).hostname.toLowerCase();
    return SOCIAL_HOST_PARTS.some((part) => host.includes(part));
  } catch {
    return false;
  }
}

function uniqueValues<T>(values: T[]) {
  return [...new Set(values.filter(Boolean))];
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
        "user-agent": "DirectDemocracyBot/0.1 profile-enrichment-review",
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

async function isAllowedByRobots(urlValue: string) {
  const url = new URL(urlValue);
  const robotsUrl = `${url.origin}/robots.txt`;

  try {
    const robots = await fetchTextWithTimeout(robotsUrl);
    const lines = robots.split(/\r?\n/).map((line) => line.trim());
    let applies = false;

    for (const line of lines) {
      const [rawKey, ...rawValueParts] = line.split(":");
      const key = rawKey?.toLowerCase();
      const value = rawValueParts.join(":").trim();

      if (key === "user-agent") {
        applies = value === "*" || value.toLowerCase().includes("directdemocracybot");
      }

      if (applies && key === "disallow" && value && url.pathname.startsWith(value)) {
        return false;
      }
    }
  } catch {
    return true;
  }

  return true;
}

function extractMeta(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  return pattern.exec(html)?.[1] ?? null;
}

function extractImageUrl(html: string, sourceUrl: string) {
  const ogImage = extractMeta(html, "og:image");
  const twitterImage = extractMeta(html, "twitter:image");
  const imageSources = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);

  for (const candidate of [ogImage, twitterImage, ...imageSources]) {
    const resolvedUrl = safeUrl(candidate, sourceUrl);
    const validatedUrl = getValidatedProfileImageUrl(resolvedUrl);
    if (validatedUrl) return validatedUrl;
  }

  return null;
}

function extractLinks(html: string, sourceUrl: string) {
  const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => safeUrl(match[1], sourceUrl))
    .filter((url): url is string => Boolean(url));

  return uniqueValues(links);
}

function extractIssues(text: string) {
  const lower = text.toLowerCase();
  const issueLabels = [
    "housing",
    "public safety",
    "education",
    "schools",
    "water",
    "transportation",
    "infrastructure",
    "healthcare",
    "jobs",
    "economy",
    "transparency",
    "environment",
    "veterans",
  ];

  return issueLabels.filter((issue) => lower.includes(issue)).slice(0, 8);
}

function extractParty(text: string) {
  if (/\bnonpartisan\b/i.test(text)) return "Nonpartisan";
  if (/\bdemocratic\b|\bdemocrat\b/i.test(text)) return "Democratic";
  if (/\brepublican\b/i.test(text)) return "Republican";
  if (/\bindependent\b/i.test(text)) return "Independent";
  if (/\blibertarian\b/i.test(text)) return "Libertarian";
  return null;
}

function extractFields(html: string, sourceUrl: string): { proposedFields: ProposedProfileFields; fieldSources: FieldSources; confidenceScore: number } {
  const text = stripHtml(html);
  const description = extractMeta(html, "description") ?? extractMeta(html, "og:description");
  const title = extractMeta(html, "og:title") ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "";
  const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(text)?.[0] ?? null;
  const phone = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/.exec(text)?.[0] ?? null;
  const imageUrl = extractImageUrl(html, sourceUrl);
  const links = extractLinks(html, sourceUrl);
  const socialLinks = links.filter(isSocialUrl);
  const bioSourceText = description ?? text;
  const shortBioSummary = summarizeText(bioSourceText);
  const officeMatch = /(for|office|representing|representative|commissioner|mayor|council|senate|assembly|trustee)\s+([^.|,;]{3,90})/i.exec(`${title}. ${text}`);
  const jurisdictionMatch = /(district|ward|county|city|state)\s+([^.|,;]{1,80})/i.exec(text);
  const keyIssues = extractIssues(text);
  const party = extractParty(text);
  const proposedFields: ProposedProfileFields = {};
  const fieldSources: FieldSources = {};

  function setField<K extends keyof ProposedProfileFields>(key: K, value: ProposedProfileFields[K] | null | undefined) {
    if (Array.isArray(value) && value.length === 0) return;
    if (typeof value === "string" && !value.trim()) return;
    if (!value) return;
    proposedFields[key] = value;
    fieldSources[key] = [sourceUrl];
  }

  setField("shortBioSummary", shortBioSummary ?? undefined);
  setField("headshotImageUrl", imageUrl ?? undefined);
  setField("websiteUrl", sourceUrl);
  setField("socialLinks", socialLinks.slice(0, 4));
  setField("publicEmail", email ?? undefined);
  setField("publicPhone", phone ?? undefined);
  setField("officeTitle", officeMatch?.[2] ? normalizeWhitespace(officeMatch[2]) : undefined);
  setField("districtOrJurisdiction", jurisdictionMatch?.[0] ? normalizeWhitespace(jurisdictionMatch[0]) : undefined);
  setField("party", party ?? undefined);
  setField("keyIssues", keyIssues);

  const populated = Object.keys(proposedFields).length;
  const confidenceScore = Math.min(0.95, Math.max(0.2, populated / 10 + (shortBioSummary ? 0.15 : 0) + (imageUrl ? 0.1 : 0)));

  return { proposedFields, fieldSources, confidenceScore };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function getCandidateTarget(id: string): Promise<EnrichmentCandidateTarget | null> {
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      source: { select: { url: true } },
    },
  });

  if (!candidate) return null;

  return {
    targetType: "CANDIDATE",
    id: candidate.id,
    name: candidate.ballotName ?? candidate.fullName,
    websiteUrl: candidate.websiteUrl,
    sourceUrl: candidate.sourceUrl,
    sourceWebsiteUrl: candidate.source?.url ?? null,
  };
}

async function getOfficialTarget(id: string): Promise<EnrichmentOfficialTarget | null> {
  const official = await prisma.official.findUnique({
    where: { id },
    include: {
      source: { select: { url: true } },
    },
  });

  if (!official) return null;

  return {
    targetType: "OFFICIAL",
    id: official.id,
    name: official.fullName,
    websiteUrl: official.websiteUrl,
    sourceWebsiteUrl: official.source?.url ?? null,
  };
}

function pickSourceUrl(target: EnrichmentTarget, overrideUrl?: string | null) {
  const candidates = [overrideUrl, target.websiteUrl, "sourceUrl" in target ? target.sourceUrl : null, target.sourceWebsiteUrl]
    .map((url) => safeUrl(url))
    .filter((url): url is string => Boolean(url));

  return candidates.find(isAllowedSourceUrl) ?? null;
}

export async function runProfileWebsiteEnrichment({
  targetType,
  targetId,
  sourceUrl,
}: {
  targetType: EnrichmentTargetType;
  targetId: string;
  sourceUrl?: string | null;
}) {
  const target = targetType === "CANDIDATE" ? await getCandidateTarget(targetId) : await getOfficialTarget(targetId);

  if (!target) {
    throw new Error("Target was not found.");
  }

  const url = pickSourceUrl(target, sourceUrl);

  if (!url) {
    throw new Error("No allowed official, campaign, or election-office URL is available for enrichment.");
  }

  let proposedFields: ProposedProfileFields = {};
  let fieldSources: FieldSources = {};
  let confidenceScore = 0;
  let errorLog: string | null = null;
  const fetchedAt = new Date();

  try {
    if (!(await isAllowedByRobots(url))) {
      throw new Error("robots.txt disallows this path.");
    }

    const html = await fetchTextWithTimeout(url);
    const extracted = extractFields(html, url);
    proposedFields = extracted.proposedFields;
    fieldSources = extracted.fieldSources;
    confidenceScore = extracted.confidenceScore;
  } catch (error) {
    errorLog = error instanceof Error ? error.message : "Unknown enrichment error";
  }

  return prisma.profileWebsiteEnrichment.upsert({
    where: {
      targetType_targetId_sourceUrl: {
        targetType,
        targetId,
        sourceUrl: url,
      },
    },
    create: {
      targetType,
      targetId,
      targetName: target.name,
      sourceUrl: url,
      sourceName: targetType === "CANDIDATE" ? "Candidate campaign website" : "Official website",
      campaignWebsiteUrl: targetType === "CANDIDATE" ? proposedFields.websiteUrl ?? url : null,
      officialWebsiteUrl: targetType === "OFFICIAL" ? proposedFields.websiteUrl ?? url : null,
      headshotUrl: proposedFields.headshotImageUrl ?? null,
      shortBio: proposedFields.shortBioSummary ?? null,
      longBioSourceUrl: proposedFields.shortBioSummary ? url : null,
      socialLinks: toJson(proposedFields.socialLinks ?? []),
      publicContactEmail: proposedFields.publicEmail ?? null,
      publicContactPhone: proposedFields.publicPhone ?? null,
      lastEnrichedAt: fetchedAt,
      enrichmentStatus: errorLog ? "ERROR" : "FETCHED",
      fetchedAt,
      proposedFields: toJson(proposedFields),
      fieldSources: toJson(fieldSources),
      confidenceScore,
      reviewStatus: errorLog ? "NEEDS_MORE_SOURCES" : "PENDING_REVIEW",
      errorLog,
    },
    update: {
      targetName: target.name,
      sourceName: targetType === "CANDIDATE" ? "Candidate campaign website" : "Official website",
      campaignWebsiteUrl: targetType === "CANDIDATE" ? proposedFields.websiteUrl ?? url : null,
      officialWebsiteUrl: targetType === "OFFICIAL" ? proposedFields.websiteUrl ?? url : null,
      headshotUrl: proposedFields.headshotImageUrl ?? null,
      shortBio: proposedFields.shortBioSummary ?? null,
      longBioSourceUrl: proposedFields.shortBioSummary ? url : null,
      socialLinks: toJson(proposedFields.socialLinks ?? []),
      publicContactEmail: proposedFields.publicEmail ?? null,
      publicContactPhone: proposedFields.publicPhone ?? null,
      lastEnrichedAt: fetchedAt,
      enrichmentStatus: errorLog ? "ERROR" : "FETCHED",
      fetchedAt,
      proposedFields: toJson(proposedFields),
      fieldSources: toJson(fieldSources),
      confidenceScore,
      reviewStatus: errorLog ? "NEEDS_MORE_SOURCES" : "PENDING_REVIEW",
      errorLog,
      reviewNotes: null,
      reviewedAt: null,
      reviewedByUserId: null,
    },
  });
}

export async function getAdminEnrichmentQueue(status?: string): Promise<AdminEnrichmentRow[]> {
  const where = status && status !== "all" ? { reviewStatus: status as EnrichmentReviewStatus } : undefined;
  const rows = await prisma.profileWebsiteEnrichment.findMany({
    where,
    orderBy: [{ reviewStatus: "asc" }, { fetchedAt: "desc" }],
    take: 100,
  });

  return rows.map((row) => ({
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    targetName: row.targetName,
    sourceUrl: row.sourceUrl,
    fetchedAt: row.fetchedAt,
    confidenceScore: row.confidenceScore,
    reviewStatus: row.reviewStatus,
    reviewNotes: row.reviewNotes,
    proposedFields: row.proposedFields as ProposedProfileFields,
    fieldSources: row.fieldSources as FieldSources,
    errorLog: row.errorLog,
    campaignWebsiteUrl: row.campaignWebsiteUrl,
    officialWebsiteUrl: row.officialWebsiteUrl,
    headshotUrl: row.headshotUrl,
    shortBio: row.shortBio,
    longBioSourceUrl: row.longBioSourceUrl,
    socialLinks: Array.isArray(row.socialLinks) ? row.socialLinks.filter((link): link is string => typeof link === "string") : [],
    publicContactEmail: row.publicContactEmail,
    publicContactPhone: row.publicContactPhone,
    sourceName: row.sourceName,
    lastEnrichedAt: row.lastEnrichedAt,
    enrichmentStatus: row.enrichmentStatus,
  }));
}

export async function getAdminEnrichmentTargets(): Promise<AdminEnrichmentTargetRow[]> {
  const [candidates, officials, latestRows] = await Promise.all([
    prisma.candidate.findMany({
      include: {
        election: { select: { title: true } },
        office: { select: { title: true } },
        jurisdiction: { select: { name: true } },
        source: { select: { url: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
    prisma.official.findMany({
      include: {
        office: { select: { title: true } },
        jurisdiction: { select: { name: true } },
        source: { select: { url: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
    prisma.profileWebsiteEnrichment.findMany({
      orderBy: { fetchedAt: "desc" },
      take: 200,
    }),
  ]);
  const latestByTarget = new Map(latestRows.map((row) => [`${row.targetType}:${row.targetId}`, row.reviewStatus]));

  return [
    ...candidates.map((candidate) => ({
      id: candidate.id,
      targetType: "CANDIDATE" as const,
      name: candidate.ballotName ?? candidate.fullName,
      officeOrRace: candidate.office?.title ?? candidate.election.title,
      jurisdictionName: candidate.jurisdiction.name,
      websiteUrl: candidate.websiteUrl,
      sourceUrl: candidate.sourceUrl ?? candidate.source?.url ?? null,
      latestStatus: latestByTarget.get(`CANDIDATE:${candidate.id}`) ?? null,
    })),
    ...officials.map((official) => ({
      id: official.id,
      targetType: "OFFICIAL" as const,
      name: official.fullName,
      officeOrRace: official.office.title,
      jurisdictionName: official.jurisdiction.name,
      websiteUrl: official.websiteUrl,
      sourceUrl: official.source?.url ?? null,
      latestStatus: latestByTarget.get(`OFFICIAL:${official.id}`) ?? null,
    })),
  ];
}

export async function updateEnrichmentReviewStatus({
  enrichmentId,
  reviewStatus,
  reviewNotes,
  reviewerUserId,
}: {
  enrichmentId: string;
  reviewStatus: EnrichmentReviewStatus;
  reviewNotes?: string | null;
  reviewerUserId: string;
}) {
  return prisma.profileWebsiteEnrichment.update({
    where: { id: enrichmentId },
    data: {
      reviewStatus,
      reviewNotes,
      reviewedAt: new Date(),
      reviewedByUserId: reviewerUserId,
    },
  });
}
