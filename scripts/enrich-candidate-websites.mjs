#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
  "wikipedia.org",
  "ballotpedia.org",
  "news",
  "reviewjournal.com",
  "nytimes.com",
  "washingtonpost.com",
  "kolotv.com",
  "fox5vegas.com",
  "ktnv.com",
  "kunr.org",
  "nevadacurrent.com",
];
const SOCIAL_HOST_PARTS = ["twitter.com", "x.com", "facebook.com", "instagram.com", "threads.net", "youtube.com", "tiktok.com"];
const KNOWN_CAMPAIGN_SITES = new Map([
  ["cannizzaro nicole jeanette", "https://www.nicolecannizzaro.com/"],
  ["conine zach", "https://www.zachconine.com/"],
  ["guzman fralick adriana", "https://www.adrianafornevada.com/"],
  ["guzmán fralick adriana", "https://www.adrianafornevada.com/"],
  ["tarkanian danny", "https://www.tarkfornevada.com/"],
]);
const RATE_LIMIT_MS = 1200;
const FETCH_TIMEOUT_MS = 8000;
let lastFetchAt = 0;

function getArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCandidateName(value) {
  return normalizeWhitespace(
    value
    .replace(/,/g, " ")
    .toLowerCase()
    .normalize("NFD")
      .replace(/\p{Diacritic}/gu, ""),
  );
}

function stripHtml(value) {
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

function summarizeText(value, maxLength = 420) {
  const text = normalizeWhitespace(value);
  if (!text) return null;
  const sentences = text.match(/[^.!?]+[.!?]+/g)?.map((sentence) => normalizeWhitespace(sentence)) ?? [text];
  const summary = sentences.slice(0, 3).join(" ");
  return summary.length > maxLength ? `${summary.slice(0, maxLength - 1).trimEnd()}...` : summary;
}

function safeUrl(value, base) {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isBlockedPrimarySource(urlValue) {
  try {
    const host = new URL(urlValue).hostname.toLowerCase();
    return BLOCKED_HOST_PARTS.some((blocked) => host.includes(blocked));
  } catch {
    return true;
  }
}

function isSocialUrl(urlValue) {
  try {
    const host = new URL(urlValue).hostname.toLowerCase();
    return SOCIAL_HOST_PARTS.some((part) => host.includes(part));
  } catch {
    return false;
  }
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

async function waitForRateLimit() {
  const elapsed = Date.now() - lastFetchAt;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }
  lastFetchAt = Date.now();
}

async function fetchText(url, accept = "text/html, text/plain;q=0.8") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    await waitForRateLimit();
    const response = await fetch(url, {
      headers: {
        "user-agent": "DirectDemocracyBot/0.1 candidate-website-enrichment-review",
        accept,
      },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Fetch failed with ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function isAllowedByRobots(urlValue) {
  const url = new URL(urlValue);
  const robotsUrl = `${url.origin}/robots.txt`;

  try {
    const robots = await fetchText(robotsUrl, "text/plain, text/html;q=0.4");
    const lines = robots.split(/\r?\n/).map((line) => line.trim());
    let applies = false;

    for (const line of lines) {
      const [rawKey, ...rawValueParts] = line.split(":");
      const key = rawKey?.toLowerCase();
      const value = rawValueParts.join(":").trim();

      if (key === "user-agent") applies = value === "*" || value.toLowerCase().includes("directdemocracybot");
      if (applies && key === "disallow" && value && url.pathname.startsWith(value)) return false;
    }
  } catch {
    return true;
  }

  return true;
}

function extractMeta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  return pattern.exec(html)?.[1] ?? null;
}

function extractImageUrl(html, sourceUrl) {
  const ogImage = extractMeta(html, "og:image");
  const twitterImage = extractMeta(html, "twitter:image");
  const firstImage = /<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/i.exec(html)?.[1] ?? null;
  return safeUrl(ogImage ?? twitterImage ?? firstImage, sourceUrl);
}

function extractLinks(html, sourceUrl) {
  return uniqueValues(
    [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)]
      .map((match) => safeUrl(match[1], sourceUrl))
      .filter(Boolean),
  );
}

function extractIssues(text) {
  const lower = text.toLowerCase();
  const issueLabels = [
    "public safety",
    "law enforcement",
    "election integrity",
    "voting rights",
    "reproductive rights",
    "workers' rights",
    "lgbtq rights",
    "clean air",
    "clean water",
    "consumer protection",
    "fraud",
    "immigration",
    "constitution",
    "crime",
  ];

  return issueLabels.filter((issue) => lower.includes(issue)).slice(0, 8);
}

function extractProfileFields(html, sourceUrl) {
  const text = stripHtml(html);
  const description = extractMeta(html, "description") ?? extractMeta(html, "og:description");
  const links = extractLinks(html, sourceUrl);
  const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(text)?.[0] ?? null;
  const phone = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/.exec(text)?.[0] ?? null;
  const sourceText = description && description.length > 80 ? description : text;
  const shortBio = summarizeText(sourceText);
  const socialLinks = links.filter(isSocialUrl).slice(0, 8);
  const headshotUrl = extractImageUrl(html, sourceUrl);
  const keyIssues = extractIssues(text);

  return {
    campaignWebsiteUrl: sourceUrl,
    headshotUrl,
    shortBio,
    longBioSourceUrl: sourceUrl,
    socialLinks,
    publicContactEmail: email,
    publicContactPhone: phone,
    keyIssues,
  };
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

async function searchCandidateWebsite(candidate) {
  const query = `${candidate.ballotName ?? candidate.fullName} ${candidate.office?.title ?? ""} Nevada campaign website`;
  const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchText(searchUrl);
  const matches = [...html.matchAll(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => decodeSearchUrl(match[1]))
    .filter(Boolean)
    .filter((url) => !isBlockedPrimarySource(url));

  return matches[0] ?? null;
}

async function discoverCandidateWebsite(candidate) {
  const searchedUrl = await searchCandidateWebsite(candidate).catch(() => null);
  if (searchedUrl) return searchedUrl;

  const normalized = normalizeCandidateName(candidate.ballotName ?? candidate.fullName);
  return KNOWN_CAMPAIGN_SITES.get(normalized) ?? null;
}

async function enrichCandidate(candidate, options) {
  const discoveredUrl = options.sourceUrl ?? (await discoverCandidateWebsite(candidate));

  if (!discoveredUrl || isBlockedPrimarySource(discoveredUrl)) {
    console.log(`skip ${candidate.fullName}: no allowed campaign/official website discovered`);
    return null;
  }

  if (!(await isAllowedByRobots(discoveredUrl))) {
    console.log(`skip ${candidate.fullName}: robots.txt disallows ${discoveredUrl}`);
    return null;
  }

  const html = await fetchText(discoveredUrl);
  const fields = extractProfileFields(html, discoveredUrl);
  const proposedFields = {
    shortBioSummary: fields.shortBio ?? undefined,
    headshotImageUrl: fields.headshotUrl ?? undefined,
    websiteUrl: fields.campaignWebsiteUrl,
    socialLinks: fields.socialLinks,
    publicEmail: fields.publicContactEmail ?? undefined,
    publicPhone: fields.publicContactPhone ?? undefined,
    officeTitle: candidate.office?.title ?? undefined,
    districtOrJurisdiction: candidate.jurisdiction.name,
    party: candidate.partyText ?? undefined,
    keyIssues: fields.keyIssues,
  };
  const fieldSources = Object.fromEntries(Object.keys(proposedFields).map((key) => [key, [discoveredUrl]]));
  const fetchedAt = new Date();

  return prisma.profileWebsiteEnrichment.upsert({
    where: {
      targetType_targetId_sourceUrl: {
        targetType: "CANDIDATE",
        targetId: candidate.id,
        sourceUrl: discoveredUrl,
      },
    },
    create: {
      targetType: "CANDIDATE",
      targetId: candidate.id,
      targetName: candidate.ballotName ?? candidate.fullName,
      sourceUrl: discoveredUrl,
      sourceName: "Candidate campaign website",
      campaignWebsiteUrl: fields.campaignWebsiteUrl,
      headshotUrl: fields.headshotUrl,
      shortBio: fields.shortBio,
      longBioSourceUrl: fields.longBioSourceUrl,
      socialLinks: fields.socialLinks,
      publicContactEmail: fields.publicContactEmail,
      publicContactPhone: fields.publicContactPhone,
      lastEnrichedAt: fetchedAt,
      enrichmentStatus: "FETCHED",
      fetchedAt,
      proposedFields,
      fieldSources,
      confidenceScore: fields.shortBio && fields.campaignWebsiteUrl ? 0.88 : 0.68,
      reviewStatus: options.reviewStatus,
    },
    update: {
      targetName: candidate.ballotName ?? candidate.fullName,
      sourceName: "Candidate campaign website",
      campaignWebsiteUrl: fields.campaignWebsiteUrl,
      headshotUrl: fields.headshotUrl,
      shortBio: fields.shortBio,
      longBioSourceUrl: fields.longBioSourceUrl,
      socialLinks: fields.socialLinks,
      publicContactEmail: fields.publicContactEmail,
      publicContactPhone: fields.publicContactPhone,
      lastEnrichedAt: fetchedAt,
      enrichmentStatus: "FETCHED",
      fetchedAt,
      proposedFields,
      fieldSources,
      confidenceScore: fields.shortBio && fields.campaignWebsiteUrl ? 0.88 : 0.68,
      reviewStatus: options.reviewStatus,
      errorLog: null,
    },
  });
}

async function main() {
  const candidateName = getArg("candidate");
  const office = getArg("office");
  const sourceUrl = getArg("source-url");
  const reviewStatus = getArg("review-status", "PENDING_REVIEW");
  const limit = Number(getArg("limit", "20"));
  const approveKnown = hasFlag("approve-known-official-sites");
  const finalReviewStatus = approveKnown ? "APPROVED" : reviewStatus;

  if (!["PENDING_REVIEW", "APPROVED", "VERIFIED", "REJECTED", "NEEDS_MORE_SOURCES"].includes(finalReviewStatus)) {
    throw new Error(`Unsupported review status: ${finalReviewStatus}`);
  }

  const candidates = await prisma.candidate.findMany({
    where: {
      ...(candidateName ? { fullName: { contains: candidateName, mode: "insensitive" } } : {}),
      ...(office ? { office: { title: { contains: office, mode: "insensitive" } } } : {}),
    },
    include: {
      office: true,
      jurisdiction: true,
      election: true,
    },
    orderBy: [{ isIncumbent: "desc" }, { election: { electionDate: "desc" } }, { fullName: "asc" }],
    take: limit,
  });

  for (const candidate of candidates) {
    const row = await enrichCandidate(candidate, { sourceUrl, reviewStatus: finalReviewStatus }).catch(async (error) => {
      const url = sourceUrl ?? KNOWN_CAMPAIGN_SITES.get(normalizeCandidateName(candidate.ballotName ?? candidate.fullName)) ?? candidate.websiteUrl ?? candidate.sourceUrl ?? "about:blank";
      if (url === "about:blank") return null;

      return prisma.profileWebsiteEnrichment.upsert({
        where: {
          targetType_targetId_sourceUrl: {
            targetType: "CANDIDATE",
            targetId: candidate.id,
            sourceUrl: url,
          },
        },
        create: {
          targetType: "CANDIDATE",
          targetId: candidate.id,
          targetName: candidate.ballotName ?? candidate.fullName,
          sourceUrl: url,
          sourceName: "Candidate campaign website",
          fetchedAt: new Date(),
          proposedFields: {},
          fieldSources: {},
          confidenceScore: 0,
          reviewStatus: "NEEDS_MORE_SOURCES",
          enrichmentStatus: "ERROR",
          errorLog: error instanceof Error ? error.message : "Unknown enrichment error",
        },
        update: {
          fetchedAt: new Date(),
          reviewStatus: "NEEDS_MORE_SOURCES",
          enrichmentStatus: "ERROR",
          errorLog: error instanceof Error ? error.message : "Unknown enrichment error",
        },
      });
    });

    if (row) {
      console.log(`${row.reviewStatus}: ${candidate.fullName} -> ${row.sourceUrl}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
