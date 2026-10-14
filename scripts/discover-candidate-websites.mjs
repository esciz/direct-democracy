#!/usr/bin/env node

import { PrismaClient, ProfileEnrichmentReviewStatus, ProfileEnrichmentStatus } from "@prisma/client";

const prisma = new PrismaClient();

const BLOCKED_PRIMARY_HOSTS = [
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

const KNOWN_CAMPAIGN_SITES = new Map([
  ["cannizzaro nicole jeanette", "https://www.nicolecannizzaro.com/"],
  ["conine zach", "https://www.zachconine.com/"],
  ["guzman fralick adriana", "https://www.adrianafornevada.com/"],
  ["guzmán fralick adriana", "https://www.adrianafornevada.com/"],
  ["tarkanian danny", "https://www.tarkfornevada.com/"],
]);

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

function host(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isBlockedPrimarySource(url) {
  const hostname = host(url);
  return !hostname || BLOCKED_PRIMARY_HOSTS.some((blocked) => hostname.includes(blocked));
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

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "DirectDemocracyBot/0.1 candidate-website-discovery-review",
        accept: "text/html, text/plain;q=0.8",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Fetch failed with ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function scoreCandidateUrl(candidate, url) {
  const hostname = host(url);
  const path = new URL(url).pathname.toLowerCase();
  const nameParts = normalizeName(candidate.ballotName ?? candidate.fullName)
    .split(/\s+/)
    .filter((part) => part.length > 2);
  let score = 0.35;
  if (hostname.includes("for") || hostname.includes("elect") || hostname.includes("campaign")) score += 0.15;
  if (path.includes("about") || path.includes("meet") || path.includes("issues")) score += 0.05;
  if (nameParts.some((part) => hostname.includes(part))) score += 0.25;
  if (nameParts.filter((part) => hostname.includes(part)).length >= 2) score += 0.15;
  return Math.min(0.92, score);
}

async function searchCandidate(candidate) {
  const known = KNOWN_CAMPAIGN_SITES.get(normalizeName(candidate.ballotName ?? candidate.fullName));
  if (known) return { url: known, confidenceScore: 0.88, method: "known_official_campaign_site" };

  const query = `${candidate.ballotName ?? candidate.fullName} ${candidate.office?.title ?? candidate.election.officeTitle} Nevada campaign website`;
  const html = await fetchText(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  const matches = [...html.matchAll(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => decodeSearchUrl(match[1]))
    .filter(Boolean)
    .filter((url) => !isBlockedPrimarySource(url));
  const url = matches[0] ?? null;
  return url ? { url, confidenceScore: scoreCandidateUrl(candidate, url), method: "duckduckgo_html_search" } : null;
}

async function main() {
  const limit = Math.max(1, Math.min(Number(argValue("limit", "25")) || 25, 100));
  const candidates = await prisma.candidate.findMany({
    where: {
      OR: [{ websiteUrl: null }, { websiteUrl: "" }],
    },
    include: {
      office: true,
      election: true,
      jurisdiction: true,
      profileWebsiteEnrichments: false,
    },
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
  }).catch(() =>
    prisma.candidate.findMany({
      where: {
        OR: [{ websiteUrl: null }, { websiteUrl: "" }],
      },
      include: {
        office: true,
        election: true,
        jurisdiction: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: limit,
    }),
  );

  const diagnostics = {
    candidatesChecked: candidates.length,
    websitesDiscovered: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    pendingReview: 0,
    failures: [],
  };

  for (const candidate of candidates) {
    try {
      const discovered = await searchCandidate(candidate);
      if (!discovered) {
        console.log(`no-site: ${candidate.fullName}`);
        continue;
      }

      const existing = await prisma.profileWebsiteEnrichment.findUnique({
        where: {
          targetType_targetId_sourceUrl: {
            targetType: "CANDIDATE",
            targetId: candidate.id,
            sourceUrl: discovered.url,
          },
        },
        select: { id: true },
      });

      await prisma.profileWebsiteEnrichment.upsert({
        where: {
          targetType_targetId_sourceUrl: {
            targetType: "CANDIDATE",
            targetId: candidate.id,
            sourceUrl: discovered.url,
          },
        },
        create: {
          targetType: "CANDIDATE",
          targetId: candidate.id,
          targetName: candidate.ballotName ?? candidate.fullName,
          sourceUrl: discovered.url,
          sourceName: "Discovered candidate campaign/official website",
          campaignWebsiteUrl: discovered.url,
          enrichmentStatus: ProfileEnrichmentStatus.DISCOVERED,
          fetchedAt: new Date(),
          proposedFields: { websiteUrl: discovered.url, discoveryMethod: discovered.method },
          fieldSources: { websiteUrl: [discovered.url] },
          confidenceScore: discovered.confidenceScore,
          reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
        },
        update: {
          targetName: candidate.ballotName ?? candidate.fullName,
          sourceName: "Discovered candidate campaign/official website",
          campaignWebsiteUrl: discovered.url,
          enrichmentStatus: ProfileEnrichmentStatus.DISCOVERED,
          fetchedAt: new Date(),
          proposedFields: { websiteUrl: discovered.url, discoveryMethod: discovered.method },
          fieldSources: { websiteUrl: [discovered.url] },
          confidenceScore: discovered.confidenceScore,
          reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
          errorLog: null,
        },
      });

      diagnostics.websitesDiscovered += 1;
      if (existing) diagnostics.recordsUpdated += 1;
      else diagnostics.recordsCreated += 1;
      diagnostics.pendingReview += 1;
      console.log(`pending_review: ${candidate.fullName} -> ${discovered.url}`);
    } catch (error) {
      diagnostics.failures.push({ candidateId: candidate.id, name: candidate.fullName, error: error instanceof Error ? error.message : String(error) });
      console.log(`failed: ${candidate.fullName}`);
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
