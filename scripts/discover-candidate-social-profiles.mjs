#!/usr/bin/env node

import { CandidateKnowledgeSourceType, PrismaClient, ProfileEnrichmentReviewStatus } from "@prisma/client";

const prisma = new PrismaClient();

const SOCIAL_HOSTS = [
  "linkedin.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "instagram.com",
  "threads.net",
  "youtube.com",
  "tiktok.com",
];

const MIN_CONFIDENCE = 0.78;

function argValue(name, fallback = undefined) {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((arg) => arg === `--${name}` || arg.startsWith(prefix));
  if (!found) return fallback;
  return found === `--${name}` ? "true" : found.slice(prefix.length);
}

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeName(value) {
  return normalizeWhitespace(value)
    .replace(/,/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function nameParts(candidate) {
  return normalizeName(candidate.ballotName ?? candidate.fullName)
    .split(/\s+/)
    .filter((part) => part.length > 2);
}

function displayName(candidate) {
  return candidate.ballotName ?? candidate.fullName;
}

function safeUrl(value, base) {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (!["id"].includes(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return null;
  }
}

function host(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isSocialUrl(url) {
  const hostname = host(url);
  if (!SOCIAL_HOSTS.some((socialHost) => hostname === socialHost || hostname.endsWith(`.${socialHost}`))) return false;
  const parsed = new URL(url);
  const path = parsed.pathname.toLowerCase();
  if (path === "/" || path.includes("/share") || path.includes("/search") || path.includes("/login")) return false;
  return true;
}

function decodeSearchUrl(rawUrl) {
  const direct = safeUrl(rawUrl);
  if (!direct) return null;
  const url = new URL(direct);
  if (url.hostname.includes("duckduckgo.com") && url.pathname === "/l/") {
    return safeUrl(url.searchParams.get("uddg"));
  }
  return direct;
}

async function fetchSearchHtml(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        "user-agent": "DirectDemocracyBot/0.1 candidate-social-url-discovery",
        accept: "text/html",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Search failed with ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function extractResultUrls(html) {
  return [...html.matchAll(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => decodeSearchUrl(match[1]))
    .filter(Boolean)
    .filter(isSocialUrl);
}

function socialSourceType(url) {
  const hostname = host(url);
  return hostname.includes("linkedin.com") ? CandidateKnowledgeSourceType.SOCIAL_PROFILE : CandidateKnowledgeSourceType.SOCIAL_PROFILE;
}

function scoreSocialUrl(candidate, url) {
  const parts = nameParts(candidate);
  const parsed = new URL(url);
  const haystack = normalizeName(`${parsed.hostname} ${parsed.pathname}`);
  const office = normalizeName(candidate.office?.title ?? candidate.election.officeTitle ?? candidate.election.title);
  const jurisdiction = normalizeName(candidate.jurisdiction?.name ?? "");
  let score = 0.35;
  const matchedNameParts = parts.filter((part) => haystack.includes(part));
  if (matchedNameParts.length >= Math.min(2, parts.length)) score += 0.32;
  if (matchedNameParts.length >= 3) score += 0.08;
  if (host(url).includes("linkedin.com") && parsed.pathname.toLowerCase().startsWith("/in/")) score += 0.08;
  if (host(url).includes("facebook.com") && parsed.pathname.toLowerCase().includes("for")) score += 0.08;
  if (office.includes("judge") && haystack.includes("judge")) score += 0.05;
  if (office.includes("council") && haystack.includes("council")) score += 0.05;
  if (office.includes("senate") && haystack.includes("senate")) score += 0.05;
  if (office.includes("assembly") && haystack.includes("assembly")) score += 0.05;
  if (jurisdiction.includes("nevada") || jurisdiction.includes("washoe") || jurisdiction.includes("reno") || jurisdiction.includes("sparks")) score += 0.05;
  if (haystack.includes("nevada") || haystack.includes("reno") || haystack.includes("sparks") || haystack.includes("washo")) score += 0.05;
  return Math.min(0.94, score);
}

function buildQueries(candidate) {
  const name = displayName(candidate);
  const office = candidate.office?.title ?? candidate.election.officeTitle ?? candidate.election.title;
  return [
    `"${name}" Nevada LinkedIn`,
    `"${name}" "${office}" LinkedIn`,
    `"${name}" Nevada campaign Facebook`,
    `"${name}" "${office}" campaign social`,
  ];
}

async function discoverSocialProfile(candidate) {
  const seen = new Set();
  const candidates = [];

  for (const query of buildQueries(candidate)) {
    const html = await fetchSearchHtml(query);
    for (const url of extractResultUrls(html)) {
      if (seen.has(url)) continue;
      seen.add(url);
      const confidenceScore = scoreSocialUrl(candidate, url);
      candidates.push({
        url,
        confidenceScore,
        matchedQuery: query,
        matchedTerms: nameParts(candidate),
      });
    }
  }

  return candidates
    .filter((item) => item.confidenceScore >= MIN_CONFIDENCE)
    .sort((a, b) => b.confidenceScore - a.confidenceScore)[0] ?? null;
}

async function main() {
  const limit = Math.max(1, Math.min(Number(argValue("limit", "25")) || 25, 100));
  const candidates = await prisma.candidate.findMany({
    where: {
      knowledgeEnrichments: {
        none: {
          sourceType: { in: [CandidateKnowledgeSourceType.SOCIAL_PROFILE, CandidateKnowledgeSourceType.OFFICIAL_SOCIAL] },
          reviewStatus: { in: [ProfileEnrichmentReviewStatus.PENDING_REVIEW, ProfileEnrichmentReviewStatus.APPROVED, ProfileEnrichmentReviewStatus.VERIFIED] },
        },
      },
    },
    include: {
      office: true,
      election: true,
      jurisdiction: true,
    },
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
  });

  const diagnostics = {
    candidatesChecked: candidates.length,
    socialProfilesDiscovered: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    pendingReview: 0,
    skippedLowConfidence: 0,
    failures: [],
  };

  for (const candidate of candidates) {
    try {
      const discovered = await discoverSocialProfile(candidate);
      if (!discovered) {
        diagnostics.skippedLowConfidence += 1;
        console.log(`no-high-confidence-social: ${candidate.fullName}`);
        continue;
      }

      const sourceType = socialSourceType(discovered.url);
      const existing = await prisma.candidateKnowledgeEnrichment.findUnique({
        where: {
          candidateId_sourceUrl: {
            candidateId: candidate.id,
            sourceUrl: discovered.url,
          },
        },
        select: { id: true, reviewStatus: true },
      });
      const protectReviewed = [ProfileEnrichmentReviewStatus.APPROVED, ProfileEnrichmentReviewStatus.VERIFIED].includes(existing?.reviewStatus);
      if (protectReviewed) {
        console.log(`protected-reviewed-social: ${candidate.fullName} -> ${discovered.url}`);
        continue;
      }

      const fetchedAt = new Date();
      await prisma.candidateKnowledgeEnrichment.upsert({
        where: {
          candidateId_sourceUrl: {
            candidateId: candidate.id,
            sourceUrl: discovered.url,
          },
        },
        create: {
          candidateId: candidate.id,
          sourceUrl: discovered.url,
          sourceName: "Discovered public social profile",
          sourceType,
          sourcePriority: 7,
          title: `${displayName(candidate)} public social profile`,
          aboutSummary: null,
          ownWordsSummary: null,
          issues: [],
          experienceSummary: null,
          financeContext: null,
          newsItems: [],
          socialLinks: [discovered.url],
          sourceAttribution: {
            sourceName: "Discovered public social profile",
            sourceUrl: discovered.url,
            sourceType,
            matchedQuery: discovered.matchedQuery,
            matchedTerms: discovered.matchedTerms,
            confidenceScore: discovered.confidenceScore,
            extractionPolicy: "url_only_no_linkedin_or_social_profile_text_scraping",
          },
          confidenceScore: discovered.confidenceScore,
          reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
          fetchedAt,
          lastUpdatedAt: fetchedAt,
        },
        update: {
          sourceName: "Discovered public social profile",
          sourceType,
          sourcePriority: 7,
          title: `${displayName(candidate)} public social profile`,
          aboutSummary: null,
          ownWordsSummary: null,
          issues: [],
          experienceSummary: null,
          financeContext: null,
          newsItems: [],
          socialLinks: [discovered.url],
          sourceAttribution: {
            sourceName: "Discovered public social profile",
            sourceUrl: discovered.url,
            sourceType,
            matchedQuery: discovered.matchedQuery,
            matchedTerms: discovered.matchedTerms,
            confidenceScore: discovered.confidenceScore,
            extractionPolicy: "url_only_no_linkedin_or_social_profile_text_scraping",
          },
          confidenceScore: discovered.confidenceScore,
          reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
          fetchedAt,
          lastUpdatedAt: fetchedAt,
          reviewedAt: null,
          reviewedByUserId: null,
          reviewNotes: null,
          errorLog: null,
        },
      });

      diagnostics.socialProfilesDiscovered += 1;
      if (existing) diagnostics.recordsUpdated += 1;
      else diagnostics.recordsCreated += 1;
      diagnostics.pendingReview += 1;
      console.log(`pending_review_social: ${candidate.fullName} -> ${discovered.url} (${Math.round(discovered.confidenceScore * 100)}%)`);
    } catch (error) {
      diagnostics.failures.push({ candidateId: candidate.id, name: candidate.fullName, error: error instanceof Error ? error.message : String(error) });
      console.log(`failed-social: ${candidate.fullName}`);
    }
  }

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
