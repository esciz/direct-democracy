#!/usr/bin/env node

import {
  CandidateKnowledgeSourceType,
  ProfileEnrichmentReviewStatus,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();

function argValue(name, fallback = undefined) {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((arg) => arg === `--${name}` || arg.startsWith(prefix));
  if (!found) return fallback;
  return found === `--${name}` ? "true" : found.slice(prefix.length);
}

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function stripHtml(value) {
  return normalizeWhitespace(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/gi, '"'),
  );
}

function summarizeText(value, maxLength = 620) {
  const text = normalizeWhitespace(value);
  if (!text) return null;
  const sentences = text.match(/[^.!?]+[.!?]+/g)?.map((sentence) => normalizeWhitespace(sentence)) ?? [text];
  const summary = sentences.slice(0, 3).join(" ");
  return summary.length > maxLength ? `${summary.slice(0, maxLength - 3).trimEnd()}...` : summary;
}

function safeUrl(value, base) {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function sourcePriority(sourceType) {
  switch (sourceType) {
    case CandidateKnowledgeSourceType.SOS_PUBLIC_MEDIA:
      return 1;
    case CandidateKnowledgeSourceType.CAMPAIGN_WEBSITE:
      return 2;
    case CandidateKnowledgeSourceType.OFFICIAL_WEBSITE:
      return 3;
    case CandidateKnowledgeSourceType.BALLOTPEDIA:
      return 4;
    case CandidateKnowledgeSourceType.NEWS_ARTICLE:
      return 5;
    case CandidateKnowledgeSourceType.FILING_RECORD:
      return 6;
    default:
      return 8;
  }
}

function classifyUrl(urlValue) {
  const url = new URL(urlValue);
  const host = url.hostname.toLowerCase();
  if (["linkedin.com", "x.com", "twitter.com", "facebook.com", "instagram.com", "threads.net", "youtube.com", "tiktok.com"].some((part) => host.includes(part))) {
    return CandidateKnowledgeSourceType.SOCIAL_PROFILE;
  }
  if (host.includes("nvsos.gov")) return CandidateKnowledgeSourceType.SOS_PUBLIC_MEDIA;
  if (host.includes("ballotpedia.org")) return CandidateKnowledgeSourceType.BALLOTPEDIA;
  if (host.includes("leg.state.nv.us") || host.includes(".gov")) return CandidateKnowledgeSourceType.OFFICIAL_WEBSITE;
  return CandidateKnowledgeSourceType.CAMPAIGN_WEBSITE;
}

function extractMeta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  return pattern.exec(html)?.[1] ?? null;
}

function extractTitle(html) {
  return normalizeWhitespace(extractMeta(html, "og:title") ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
}

function extractLinks(html, sourceUrl) {
  return [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => safeUrl(match[1], sourceUrl))
    .filter(Boolean);
}

function extractIssues(text, sourceUrl) {
  const labels = ["housing", "public safety", "education", "water", "transportation", "infrastructure", "healthcare", "jobs", "economy", "transparency", "veterans", "public lands"];
  const lower = text.toLowerCase();
  return labels
    .filter((label) => lower.includes(label))
    .slice(0, 6)
    .map((label) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      summary: `This approved source mentions ${label} in candidate context.`,
      sourceUrl,
    }));
}

function extractExperience(text) {
  const match = /(experience|background|served|worked|owned|teacher|attorney|veteran|commissioner|council|assembly|senate)[^.]{20,260}[.]/i.exec(text);
  return match ? summarizeText(match[0], 340) : null;
}

function extractSocialLinks(html, sourceUrl) {
  const socialHostParts = ["x.com", "twitter.com", "facebook.com", "instagram.com", "threads.net", "youtube.com", "tiktok.com"];
  return extractLinks(html, sourceUrl)
    .filter((link) => socialHostParts.some((host) => new URL(link).hostname.toLowerCase().includes(host)))
    .slice(0, 6);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "DirectDemocracyBot/0.1 candidate-knowledge-ladder-review",
        accept: "text/html, text/plain;q=0.8",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Fetch failed with ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error(`Unsupported content type: ${contentType || "unknown"}`);
    }
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function approvedSourceUrls(candidate) {
  const rows = await prisma.profileWebsiteEnrichment.findMany({
    where: {
      targetType: "CANDIDATE",
      targetId: candidate.id,
      reviewStatus: { in: [ProfileEnrichmentReviewStatus.APPROVED, ProfileEnrichmentReviewStatus.VERIFIED] },
    },
    orderBy: [{ confidenceScore: "desc" }, { fetchedAt: "desc" }],
  });
  return rows
    .map((row) => row.campaignWebsiteUrl ?? row.officialWebsiteUrl ?? row.sourceUrl)
    .filter(Boolean)
    .map((url) => safeUrl(url))
    .filter(Boolean);
}

async function upsertExtractedKnowledge(candidate, sourceUrl) {
  const sourceType = classifyUrl(sourceUrl);
  const fetchedAt = new Date();
  let data;

  try {
    if (sourceType === CandidateKnowledgeSourceType.SOCIAL_PROFILE || sourceType === CandidateKnowledgeSourceType.OFFICIAL_SOCIAL) {
      data = {
        sourceName: "Approved public social profile",
        sourceType,
        sourcePriority: sourcePriority(sourceType),
        title: `${candidate.ballotName ?? candidate.fullName} public social profile`,
        aboutSummary: null,
        ownWordsSummary: null,
        issues: [],
        experienceSummary: null,
        financeContext: null,
        newsItems: [],
        socialLinks: [sourceUrl],
        sourceAttribution: [{ sourceName: "Approved public social profile", sourceUrl, sourceType, extractionPolicy: "url_only_no_linkedin_or_social_profile_text_scraping" }],
        confidenceScore: 0.78,
        reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
        fetchedAt,
        lastUpdatedAt: fetchedAt,
        errorLog: null,
      };
    } else {
      const html = await fetchText(sourceUrl);
      const text = stripHtml(html);
      const description = extractMeta(html, "description") ?? extractMeta(html, "og:description");
      const sourceText = description && description.length > 80 ? description : text;
      data = {
        sourceName: sourceType === CandidateKnowledgeSourceType.OFFICIAL_WEBSITE ? "Official government profile" : "Approved candidate source URL",
        sourceType,
        sourcePriority: sourcePriority(sourceType),
        title: extractTitle(html) || `${candidate.ballotName ?? candidate.fullName} source`,
        aboutSummary: summarizeText(sourceText),
        ownWordsSummary: [CandidateKnowledgeSourceType.CAMPAIGN_WEBSITE, CandidateKnowledgeSourceType.SOS_PUBLIC_MEDIA].includes(sourceType) ? summarizeText(sourceText, 520) : null,
        issues: extractIssues(text, sourceUrl),
        experienceSummary: extractExperience(text),
        financeContext: null,
        newsItems: [],
        socialLinks: extractSocialLinks(html, sourceUrl),
        sourceAttribution: [{ sourceName: "Approved candidate source URL", sourceUrl, sourceType }],
        confidenceScore: 0.45 + (description ? 0.15 : 0) + (text.length > 600 ? 0.15 : 0),
        reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
        fetchedAt,
        lastUpdatedAt: fetchedAt,
        errorLog: null,
      };
    }
  } catch (error) {
    data = {
      sourceName: "Approved candidate source URL",
      sourceType,
      sourcePriority: sourcePriority(sourceType),
      title: `${candidate.ballotName ?? candidate.fullName} source`,
      aboutSummary: null,
      ownWordsSummary: null,
      issues: [],
      experienceSummary: null,
      financeContext: null,
      newsItems: [],
      socialLinks: [],
      sourceAttribution: [{ sourceName: "Approved candidate source URL", sourceUrl, sourceType }],
      confidenceScore: 0,
      reviewStatus: ProfileEnrichmentReviewStatus.NEEDS_MORE_SOURCES,
      fetchedAt,
      lastUpdatedAt: fetchedAt,
      errorLog: error instanceof Error ? error.message : String(error),
    };
  }

  const existing = await prisma.candidateKnowledgeEnrichment.findUnique({
    where: { candidateId_sourceUrl: { candidateId: candidate.id, sourceUrl } },
    select: { id: true, reviewStatus: true },
  });
  const protectReviewed = [ProfileEnrichmentReviewStatus.APPROVED, ProfileEnrichmentReviewStatus.VERIFIED].includes(existing?.reviewStatus);
  if (protectReviewed) return { created: false, updated: false, protected: true, extractedBio: Boolean(data.aboutSummary) };

  await prisma.candidateKnowledgeEnrichment.upsert({
    where: { candidateId_sourceUrl: { candidateId: candidate.id, sourceUrl } },
    create: { candidateId: candidate.id, sourceUrl, ...data },
    update: { ...data, reviewedAt: null, reviewedByUserId: null, reviewNotes: null },
  });
  return { created: !existing, updated: Boolean(existing), protected: false, extractedBio: Boolean(data.aboutSummary) };
}

async function upsertFilingFallback(candidate) {
  const sourceUrl = candidate.sourceUrl ?? candidate.source?.url;
  if (!sourceUrl) return null;
  const fetchedAt = new Date();
  const existing = await prisma.candidateKnowledgeEnrichment.findUnique({
    where: { candidateId_sourceUrl: { candidateId: candidate.id, sourceUrl } },
    select: { id: true, reviewStatus: true },
  });
  const protectReviewed = [ProfileEnrichmentReviewStatus.APPROVED, ProfileEnrichmentReviewStatus.VERIFIED].includes(existing?.reviewStatus);
  if (protectReviewed) return { created: false, updated: false, protected: true, extractedBio: false };

  await prisma.candidateKnowledgeEnrichment.upsert({
    where: { candidateId_sourceUrl: { candidateId: candidate.id, sourceUrl } },
    create: {
      candidateId: candidate.id,
      sourceUrl,
      sourceName: candidate.source?.name ?? "Candidate filing record",
      sourceType: CandidateKnowledgeSourceType.FILING_RECORD,
      sourcePriority: sourcePriority(CandidateKnowledgeSourceType.FILING_RECORD),
      title: `${candidate.ballotName ?? candidate.fullName} filing record`,
      aboutSummary: null,
      ownWordsSummary: null,
      issues: [],
      experienceSummary: null,
      financeContext: null,
      newsItems: [],
      socialLinks: [],
      sourceAttribution: [{
        sourceName: candidate.source?.name ?? "Candidate filing record",
        sourceUrl,
        sourceType: CandidateKnowledgeSourceType.FILING_RECORD,
        fallbackText: "Candidate filing record imported. Bio source not found yet.",
      }],
      confidenceScore: 0.65,
      reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
      fetchedAt,
      lastUpdatedAt: fetchedAt,
    },
    update: {
      sourceName: candidate.source?.name ?? "Candidate filing record",
      sourceType: CandidateKnowledgeSourceType.FILING_RECORD,
      sourcePriority: sourcePriority(CandidateKnowledgeSourceType.FILING_RECORD),
      title: `${candidate.ballotName ?? candidate.fullName} filing record`,
      sourceAttribution: [{
        sourceName: candidate.source?.name ?? "Candidate filing record",
        sourceUrl,
        sourceType: CandidateKnowledgeSourceType.FILING_RECORD,
        fallbackText: "Candidate filing record imported. Bio source not found yet.",
      }],
      confidenceScore: 0.65,
      reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
      fetchedAt,
      lastUpdatedAt: fetchedAt,
      reviewedAt: null,
      reviewedByUserId: null,
      reviewNotes: null,
      errorLog: null,
    },
  });
  return { created: !existing, updated: Boolean(existing), protected: false, extractedBio: false };
}

async function main() {
  const limit = Math.max(1, Math.min(Number(argValue("limit", "25")) || 25, 100));
  const candidateName = argValue("candidate");
  const candidateId = argValue("candidate-id");
  const candidates = await prisma.candidate.findMany({
    where: {
      ...(candidateId ? { id: candidateId } : {}),
      ...(candidateName
        ? {
            OR: [
              { fullName: { contains: candidateName, mode: "insensitive" } },
              { ballotName: { contains: candidateName, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      source: true,
      knowledgeEnrichments: true,
      election: true,
      office: true,
    },
    orderBy: [{ isIncumbent: "desc" }, { election: { electionDate: "desc" } }, { fullName: "asc" }],
    take: limit,
  });
  const diagnostics = {
    candidatesChecked: candidates.length,
    approvedSourcesRead: 0,
    biosExtracted: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsProtected: 0,
    fallbackRowsCreatedOrUpdated: 0,
    recordsPendingReview: 0,
    failures: [],
  };

  for (const candidate of candidates) {
    const urls = await approvedSourceUrls(candidate);
    diagnostics.approvedSourcesRead += urls.length;
    let sawBio = candidate.knowledgeEnrichments.some((row) => ["APPROVED", "VERIFIED"].includes(row.reviewStatus) && row.aboutSummary);

    for (const url of urls) {
      const result = await upsertExtractedKnowledge(candidate, url).catch((error) => {
        diagnostics.failures.push({ candidateId: candidate.id, name: candidate.fullName, sourceUrl: url, error: error instanceof Error ? error.message : String(error) });
        return null;
      });
      if (!result) continue;
      if (result.created) diagnostics.recordsCreated += 1;
      if (result.updated) diagnostics.recordsUpdated += 1;
      if (result.protected) diagnostics.recordsProtected += 1;
      if (result.extractedBio) {
        diagnostics.biosExtracted += 1;
        sawBio = true;
      }
    }

    if (!sawBio) {
      const fallback = await upsertFilingFallback(candidate);
      if (fallback) {
        if (fallback.created) diagnostics.recordsCreated += 1;
        if (fallback.updated) diagnostics.recordsUpdated += 1;
        if (fallback.protected) diagnostics.recordsProtected += 1;
        diagnostics.fallbackRowsCreatedOrUpdated += fallback.created || fallback.updated ? 1 : 0;
      }
    }
  }

  diagnostics.recordsPendingReview = await prisma.candidateKnowledgeEnrichment.count({
    where: { reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW },
  });
  console.log(JSON.stringify(diagnostics, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
