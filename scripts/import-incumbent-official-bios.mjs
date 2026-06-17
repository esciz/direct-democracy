#!/usr/bin/env node

import { PrismaClient, ProfileEnrichmentReviewStatus, ProfileEnrichmentStatus } from "@prisma/client";

const prisma = new PrismaClient();
const APPROVED = [ProfileEnrichmentReviewStatus.APPROVED, ProfileEnrichmentReviewStatus.VERIFIED];

function argValue(name, fallback = undefined) {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((arg) => arg === `--${name}` || arg.startsWith(prefix));
  if (!found) return fallback;
  return found === `--${name}` ? "true" : found.slice(prefix.length);
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|city|county|state|of|department|dept)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value) {
  return normalize(value)
    .replace(/\bjoe\b/g, "joseph")
    .replace(/\bmike\b/g, "michael")
    .replace(/\bgovernor\b/g, "")
    .split(" ")
    .filter((part) => part !== "michael")
    .sort()
    .join(" ");
}

function scoreMatch(candidate, official) {
  let score = 0;
  if (normalizeName(candidate.ballotName ?? candidate.fullName) === normalizeName(official.fullName)) score += 0.5;
  else {
    const cParts = new Set(normalize(candidate.ballotName ?? candidate.fullName).split(" ").filter((part) => part.length > 2));
    const oParts = new Set(normalize(official.fullName).split(" ").filter((part) => part.length > 2));
    if ([...cParts].filter((part) => oParts.has(part)).length >= 2) score += 0.32;
  }
  if (candidate.jurisdictionId === official.jurisdictionId || candidate.jurisdiction.slug === official.jurisdiction.slug) score += 0.2;
  const cOffice = normalize(candidate.office?.title ?? candidate.election.title);
  const oOffice = normalize(official.office.title);
  if (candidate.officeId === official.officeId) score += 0.2;
  else if (cOffice && oOffice && (cOffice.includes(oOffice) || oOffice.includes(cOffice))) score += 0.14;
  if (candidate.districtId && candidate.districtId === official.districtId) score += 0.08;
  if (!candidate.districtId || !official.districtId || normalize(candidate.district?.name) === normalize(official.district?.name)) score += 0.02;
  return Math.min(0.98, score);
}

function safeUrl(value, base) {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function isOfficialJurisdictionUrl(value) {
  const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  return hostname.endsWith(".gov") || hostname.includes("washoecounty.gov") || hostname.includes("reno.gov") || hostname.includes("carson.org") || hostname.includes("carsoncitynv.gov") || hostname.includes("nv.gov");
}

function stripHtml(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeText(value, maxLength = 520) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const summary = text.match(/[^.!?]+[.!?]+/g)?.slice(0, 3).join(" ") ?? text;
  return summary.length > maxLength ? `${summary.slice(0, maxLength - 3).trimEnd()}...` : summary;
}

function extractMeta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i").exec(html)?.[1] ?? null;
}

function extractImageUrl(html, sourceUrl) {
  const candidates = [...html.matchAll(/<img[^>]+>/gi)]
    .map((match) => {
      const tag = match[0];
      const src = /src=["']([^"']+)["']/i.exec(tag)?.[1] ?? null;
      const alt = /alt=["']([^"']*)["']/i.exec(tag)?.[1] ?? "";
      const title = /title=["']([^"']*)["']/i.exec(tag)?.[1] ?? "";
      const url = safeUrl(src, sourceUrl);
      if (!url) return null;
      const haystack = `${url} ${alt} ${title}`.toLowerCase();
      let score = 0;
      if (/(headshot|portrait|photo|official)/i.test(haystack)) score += 8;
      if (/(governor|mayor|council|commissioner|assessor|treasurer|sheriff|judge)/i.test(haystack)) score += 5;
      if (/(lombardo|ford|aguilar|anthony|cortez|masto)/i.test(haystack)) score += 4;
      if (/\.(jpe?g|png|webp)(?:[?#].*)?$/i.test(url)) score += 2;
      if (/(seal|logo|icon|outline|svg|badge|banner|placeholder|default|trout)/i.test(haystack)) score -= 12;
      return { url, score };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score);

  const bestCandidate = candidates.find((candidate) => candidate.score > 0)?.url;
  const socialImage = safeUrl(extractMeta(html, "og:image") ?? extractMeta(html, "twitter:image"), sourceUrl);
  const socialIsUsable = socialImage && !/(seal|logo|icon|outline|svg|badge|banner|placeholder|default)/i.test(socialImage);
  return bestCandidate ?? (socialIsUsable ? socialImage : null);
}

function extractResponsibilities(text) {
  const match = /(responsibilities|duties|office|department|services|oversees|administers|responsible for)[^.]{40,420}[.]/i.exec(text);
  return match ? summarizeText(match[0], 420) : null;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "DirectDemocracyBot/0.1 incumbent-official-bio-review", accept: "text/html, text/plain;q=0.8" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Fetch failed with ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function decodeSearchUrl(rawUrl) {
  const direct = safeUrl(rawUrl);
  if (!direct) return null;
  const url = new URL(direct);
  if (url.hostname.includes("duckduckgo.com") && url.pathname === "/l/") return safeUrl(url.searchParams.get("uddg"));
  return direct;
}

function jurisdictionSearchHint(slug) {
  if (slug === "washoe-county") return "site:washoecounty.gov";
  if (slug === "reno") return "site:reno.gov";
  if (slug === "carson-city") return "(site:carson.org OR site:carsoncitynv.gov)";
  if (slug === "nevada") return "site:nv.gov";
  return "site:.gov";
}

async function discoverOfficialUrl(candidate, official) {
  const known = safeUrl(official.websiteUrl);
  if (known && isOfficialJurisdictionUrl(known)) return known;
  const query = `"${official.fullName}" "${official.office.title}" ${jurisdictionSearchHint(official.jurisdiction.slug)}`;
  const html = await fetchText(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  const matches = [...html.matchAll(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => decodeSearchUrl(match[1]))
    .filter(Boolean)
    .filter(isOfficialJurisdictionUrl);
  return matches[0] ?? safeUrl(candidate.sourceUrl);
}

async function findMatch(candidate, officials) {
  const best = officials.map((official) => ({ official, score: scoreMatch(candidate, official) })).sort((a, b) => b.score - a.score)[0];
  return best && best.score >= 0.72 ? best : null;
}

async function main() {
  const limit = Math.max(1, Math.min(Number(argValue("limit", "50")) || 50, 200));
  const [candidates, officials] = await Promise.all([
    prisma.candidate.findMany({
      where: { OR: [{ isIncumbent: true }, { status: "FILED" }] },
      include: { office: true, jurisdiction: true, district: true, election: true },
      orderBy: [{ updatedAt: "desc" }],
      take: limit,
    }),
    prisma.official.findMany({
      where: { status: "CURRENT" },
      include: { office: true, jurisdiction: true, district: true },
      take: 700,
    }),
  ]);
  const diagnostics = { candidatesChecked: candidates.length, matchedIncumbents: 0, urlsFound: 0, recordsCreated: 0, recordsUpdated: 0, pendingReview: 0, unmatched: 0, failures: [] };

  for (const candidate of candidates) {
    try {
      const match = await findMatch(candidate, officials);
      if (!match) {
        diagnostics.unmatched += 1;
        continue;
      }
      const official = match.official;
      diagnostics.matchedIncumbents += 1;
      const sourceUrl = await discoverOfficialUrl(candidate, official);
      if (!sourceUrl || !isOfficialJurisdictionUrl(sourceUrl)) {
        diagnostics.unmatched += 1;
        continue;
      }
      diagnostics.urlsFound += 1;
      const fetchedAt = new Date();
      let html = "";
      let errorLog = null;
      try {
        html = await fetchText(sourceUrl);
      } catch (error) {
        errorLog = error instanceof Error ? error.message : String(error);
      }
      const text = html ? stripHtml(html) : "";
      const description = html ? extractMeta(html, "description") ?? extractMeta(html, "og:description") : null;
      const shortBio = description || text ? summarizeText(description ?? text) : null;
      const headshotUrl = html ? extractImageUrl(html, sourceUrl) : null;
      const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? official.email;
      const phone = text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/)?.[0] ?? official.phone;
      const officeResponsibilities = extractResponsibilities(text);
      const proposedFields = {
        shortBioSummary: shortBio,
        headshotImageUrl: headshotUrl,
        websiteUrl: sourceUrl,
        publicEmail: email,
        publicPhone: phone,
        officeTitle: official.office.title,
        districtOrJurisdiction: official.jurisdiction.name,
        officeResponsibilities,
        sourceType: "official_jurisdiction_website",
        incumbentOfficialId: official.id,
        incumbentMatchConfidence: match.score,
      };
      const fieldSources = Object.fromEntries(Object.entries(proposedFields).filter(([, value]) => Boolean(value)).map(([key]) => [key, [sourceUrl]]));
      const confidenceScore = Math.min(0.96, 0.55 + (shortBio ? 0.14 : 0) + (headshotUrl ? 0.08 : 0) + (email || phone ? 0.06 : 0) + (officeResponsibilities ? 0.08 : 0) + match.score * 0.08);

      for (const target of [
        { targetType: "CANDIDATE", targetId: candidate.id, targetName: candidate.ballotName ?? candidate.fullName },
        { targetType: "OFFICIAL", targetId: official.id, targetName: official.fullName },
      ]) {
        const existing = await prisma.profileWebsiteEnrichment.findUnique({
          where: { targetType_targetId_sourceUrl: { targetType: target.targetType, targetId: target.targetId, sourceUrl } },
          select: { id: true, reviewStatus: true },
        });
        if (existing && APPROVED.includes(existing.reviewStatus)) continue;
        await prisma.profileWebsiteEnrichment.upsert({
          where: { targetType_targetId_sourceUrl: { targetType: target.targetType, targetId: target.targetId, sourceUrl } },
          create: {
            ...target,
            sourceUrl,
            sourceName: "Official government source",
            campaignWebsiteUrl: null,
            officialWebsiteUrl: sourceUrl,
            headshotUrl,
            shortBio,
            longBioSourceUrl: shortBio ? sourceUrl : null,
            socialLinks: [],
            publicContactEmail: email,
            publicContactPhone: phone,
            lastEnrichedAt: fetchedAt,
            enrichmentStatus: errorLog ? ProfileEnrichmentStatus.ERROR : ProfileEnrichmentStatus.FETCHED,
            fetchedAt,
            proposedFields,
            fieldSources,
            confidenceScore,
            reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
            errorLog,
          },
          update: {
            targetName: target.targetName,
            sourceName: "Official government source",
            officialWebsiteUrl: sourceUrl,
            headshotUrl,
            shortBio,
            longBioSourceUrl: shortBio ? sourceUrl : null,
            publicContactEmail: email,
            publicContactPhone: phone,
            lastEnrichedAt: fetchedAt,
            enrichmentStatus: errorLog ? ProfileEnrichmentStatus.ERROR : ProfileEnrichmentStatus.FETCHED,
            fetchedAt,
            proposedFields,
            fieldSources,
            confidenceScore,
            reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
            errorLog,
            reviewedAt: null,
            reviewedByUserId: null,
            reviewNotes: null,
          },
        });
        if (existing) diagnostics.recordsUpdated += 1;
        else diagnostics.recordsCreated += 1;
        diagnostics.pendingReview += 1;
      }
      console.log(`pending_review_official_bio: ${candidate.fullName} -> ${official.fullName} -> ${sourceUrl}`);
    } catch (error) {
      diagnostics.failures.push({ candidateId: candidate.id, name: candidate.fullName, error: error instanceof Error ? error.message : String(error) });
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
