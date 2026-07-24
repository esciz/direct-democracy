import { ProfileEnrichmentReviewStatus, ProfileEnrichmentStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getValidatedProfileImageUrl } from "@/lib/profile/media-validation";

const APPROVED_REVIEW_STATUSES: ProfileEnrichmentReviewStatus[] = [ProfileEnrichmentReviewStatus.APPROVED, ProfileEnrichmentReviewStatus.VERIFIED];

export type IncumbentOfficialMatch = {
  candidateId: string;
  candidateName: string;
  candidateOffice: string;
  candidateJurisdiction: string;
  officialId: string;
  officialName: string;
  officialOffice: string;
  officialJurisdiction: string;
  confidenceScore: number;
};

export type ApprovedOfficialGovernmentEnrichment = {
  id: string;
  sourceName: string;
  sourceUrl: string;
  officialWebsiteUrl: string | null;
  shortBio: string | null;
  headshotUrl: string | null;
  publicContactEmail: string | null;
  publicContactPhone: string | null;
  officeTitle: string | null;
  jurisdiction: string | null;
  officeResponsibilities: string | null;
  reviewStatus: string;
  lastEnrichedAt: Date | null;
};

export type IncumbentOfficialBioQaRow = {
  candidateId: string;
  candidateName: string;
  race: string;
  status: "matched_pending_review" | "possible_match" | "unmatched_incumbent" | "official_source_pending";
  officialId: string | null;
  officialName: string | null;
  officialSourceUrl: string | null;
  confidenceScore: number;
};

type CandidateForMatch = Prisma.CandidateGetPayload<{
  include: {
    office: { select: { title: true } };
    jurisdiction: { select: { name: true; slug: true } };
    district: { select: { name: true } };
    election: { select: { title: true } };
  };
}>;

type OfficialForMatch = Prisma.OfficialGetPayload<{
  include: {
    office: { select: { title: true } };
    jurisdiction: { select: { name: true; slug: true } };
    district: { select: { name: true } };
  };
}>;

function normalize(value?: string | null) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|city|county|state|of|department|dept)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value?: string | null) {
  return normalize(value)
    .replace(/\bjoe\b/g, "joseph")
    .replace(/\bmike\b/g, "michael")
    .replace(/\bgovernor\b/g, "")
    .split(" ")
    .filter((part) => part !== "michael")
    .sort()
    .join(" ");
}

function scoreMatch(candidate: CandidateForMatch, official: OfficialForMatch) {
  let score = 0;
  if (normalizeName(candidate.ballotName ?? candidate.fullName) === normalizeName(official.fullName)) score += 0.5;
  else {
    const candidateParts = new Set(normalize(candidate.ballotName ?? candidate.fullName).split(" ").filter((part) => part.length > 2));
    const officialParts = new Set(normalize(official.fullName).split(" ").filter((part) => part.length > 2));
    const overlap = [...candidateParts].filter((part) => officialParts.has(part)).length;
    if (overlap >= 2) score += 0.32;
  }
  if (candidate.jurisdictionId === official.jurisdictionId || candidate.jurisdiction.slug === official.jurisdiction.slug) score += 0.2;
  const candidateOffice = normalize(candidate.office?.title ?? candidate.election.title);
  const officialOffice = normalize(official.office.title);
  if (candidate.officeId === official.officeId) score += 0.2;
  else if (candidateOffice && officialOffice && (candidateOffice.includes(officialOffice) || officialOffice.includes(candidateOffice))) score += 0.14;
  if (candidate.districtId && candidate.districtId === official.districtId) score += 0.08;
  if (!candidate.districtId || !official.districtId || normalize(candidate.district?.name) === normalize(official.district?.name)) score += 0.02;
  return Math.min(0.98, score);
}

function safeUrl(value?: string | null, base?: string) {
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

function host(value: string) {
  return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
}

function isOfficialJurisdictionUrl(value: string) {
  const hostname = host(value);
  return hostname.endsWith(".gov") || hostname.includes("washoecounty.gov") || hostname.includes("reno.gov") || hostname.includes("carson.org") || hostname.includes("carsoncitynv.gov") || hostname.includes("nv.gov");
}

function stripHtml(value: string) {
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

function summarizeText(value: string, maxLength = 520) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const summary = text.match(/[^.!?]+[.!?]+/g)?.slice(0, 3).join(" ") ?? text;
  return summary.length > maxLength ? `${summary.slice(0, maxLength - 3).trimEnd()}...` : summary;
}

function extractMeta(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i").exec(html)?.[1] ?? null;
}

function extractImageUrl(html: string, sourceUrl: string) {
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
    .filter((candidate): candidate is { url: string; score: number } => Boolean(candidate))
    .sort((left, right) => right.score - left.score);

  const bestCandidate = candidates.find((candidate) => candidate.score > 0)?.url;
  const socialImage = safeUrl(extractMeta(html, "og:image") ?? extractMeta(html, "twitter:image"), sourceUrl);
  const socialIsUsable = socialImage && !/(seal|logo|icon|outline|svg|badge|banner|placeholder|default)/i.test(socialImage);
  return getValidatedProfileImageUrl(bestCandidate ?? (socialIsUsable ? socialImage : null));
}

function extractResponsibilities(text: string) {
  const match = /(responsibilities|duties|office|department|services|oversees|administers|responsible for)[^.]{40,420}[.]/i.exec(text);
  return match ? summarizeText(match[0], 420) : null;
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "DirectDemocracyBot/0.1 incumbent-official-bio-review",
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

function decodeSearchUrl(rawUrl: string) {
  const direct = safeUrl(rawUrl);
  if (!direct) return null;
  const url = new URL(direct);
  if (url.hostname.includes("duckduckgo.com") && url.pathname === "/l/") {
    return safeUrl(url.searchParams.get("uddg"));
  }
  return direct;
}

function jurisdictionSearchHint(jurisdictionSlug: string) {
  if (jurisdictionSlug === "washoe-county") return "site:washoecounty.gov";
  if (jurisdictionSlug === "reno") return "site:reno.gov";
  if (jurisdictionSlug === "carson-city") return "(site:carson.org OR site:carsoncitynv.gov)";
  if (jurisdictionSlug === "nevada") return "site:nv.gov";
  return "site:.gov";
}

async function discoverOfficialUrl(candidate: CandidateForMatch, official: OfficialForMatch) {
  const known = safeUrl(official.websiteUrl);
  if (known && isOfficialJurisdictionUrl(known)) return known;
  const query = `"${official.fullName}" "${official.office.title}" ${jurisdictionSearchHint(official.jurisdiction.slug)}`;
  const html = await fetchText(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  const matches = [...html.matchAll(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => decodeSearchUrl(match[1]))
    .filter((url): url is string => Boolean(url))
    .filter(isOfficialJurisdictionUrl);
  return matches[0] ?? safeUrl(candidate.sourceUrl);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function findIncumbentOfficialMatch(candidateId: string): Promise<IncumbentOfficialMatch | null> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      office: { select: { title: true } },
      jurisdiction: { select: { name: true, slug: true } },
      district: { select: { name: true } },
      election: { select: { title: true } },
    },
  });
  if (!candidate) return null;
  const officials = await prisma.official.findMany({
    where: { status: "CURRENT" },
    include: {
      office: { select: { title: true } },
      jurisdiction: { select: { name: true, slug: true } },
      district: { select: { name: true } },
    },
    take: 500,
  });
  const best = officials
    .map((official) => ({ official, score: scoreMatch(candidate, official) }))
    .sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 0.72) return null;
  return {
    candidateId: candidate.id,
    candidateName: candidate.ballotName ?? candidate.fullName,
    candidateOffice: candidate.office?.title ?? candidate.election.title,
    candidateJurisdiction: candidate.jurisdiction.name,
    officialId: best.official.id,
    officialName: best.official.fullName,
    officialOffice: best.official.office.title,
    officialJurisdiction: best.official.jurisdiction.name,
    confidenceScore: best.score,
  };
}

export async function getApprovedOfficialGovernmentEnrichment(targetType: "CANDIDATE" | "OFFICIAL", targetId: string): Promise<ApprovedOfficialGovernmentEnrichment | null> {
  const rows = await prisma.profileWebsiteEnrichment.findMany({
    where: {
      targetType,
      targetId,
      reviewStatus: { in: APPROVED_REVIEW_STATUSES },
    },
    orderBy: [{ reviewStatus: "desc" }, { lastEnrichedAt: "desc" }],
    take: 20,
  });
  const row = rows.find((candidate) => isOfficialJurisdictionUrl(candidate.sourceUrl));
  if (!row) return null;
  const proposed = row.proposedFields as Record<string, unknown>;
  return {
    id: row.id,
    sourceName: row.sourceName ?? "Official government source",
    sourceUrl: row.sourceUrl,
    officialWebsiteUrl: row.officialWebsiteUrl,
    shortBio: row.shortBio,
    headshotUrl: getValidatedProfileImageUrl(row.headshotUrl),
    publicContactEmail: row.publicContactEmail,
    publicContactPhone: row.publicContactPhone,
    officeTitle: typeof proposed.officeTitle === "string" ? proposed.officeTitle : null,
    jurisdiction: typeof proposed.districtOrJurisdiction === "string" ? proposed.districtOrJurisdiction : null,
    officeResponsibilities: typeof proposed.officeResponsibilities === "string" ? proposed.officeResponsibilities : null,
    reviewStatus: row.reviewStatus,
    lastEnrichedAt: row.lastEnrichedAt,
  };
}

export async function importIncumbentOfficialBios({ limit = 50 } = {}) {
  const candidates = await prisma.candidate.findMany({
    where: { OR: [{ isIncumbent: true }, { status: "FILED" }] },
    include: {
      office: { select: { title: true } },
      jurisdiction: { select: { name: true, slug: true } },
      district: { select: { name: true } },
      election: { select: { title: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
  });
  const diagnostics = { candidatesChecked: candidates.length, matchedIncumbents: 0, urlsFound: 0, recordsCreated: 0, recordsUpdated: 0, pendingReview: 0, unmatched: 0, failures: [] as Array<{ candidateId: string; name: string; error: string }> };

  for (const candidate of candidates) {
    try {
      const match = await findIncumbentOfficialMatch(candidate.id);
      if (!match) {
        diagnostics.unmatched += 1;
        continue;
      }
      diagnostics.matchedIncumbents += 1;
      const official = await prisma.official.findUnique({
        where: { id: match.officialId },
        include: { office: true, jurisdiction: true, district: true },
      });
      if (!official) continue;
      const sourceUrl = await discoverOfficialUrl(candidate, official);
      if (!sourceUrl || !isOfficialJurisdictionUrl(sourceUrl)) {
        diagnostics.unmatched += 1;
        continue;
      }
      diagnostics.urlsFound += 1;

      const fetchedAt = new Date();
      let html = "";
      let errorLog: string | null = null;
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
        incumbentMatchConfidence: match.confidenceScore,
      };
      const fieldSources = Object.fromEntries(Object.entries(proposedFields).filter(([, value]) => Boolean(value)).map(([key]) => [key, [sourceUrl]]));
      const confidenceScore = Math.min(0.96, 0.55 + (shortBio ? 0.14 : 0) + (headshotUrl ? 0.08 : 0) + (email || phone ? 0.06 : 0) + (officeResponsibilities ? 0.08 : 0) + match.confidenceScore * 0.08);

      for (const target of [
        { targetType: "CANDIDATE" as const, targetId: candidate.id, targetName: candidate.ballotName ?? candidate.fullName },
        { targetType: "OFFICIAL" as const, targetId: official.id, targetName: official.fullName },
      ]) {
        const existing = await prisma.profileWebsiteEnrichment.findUnique({
          where: { targetType_targetId_sourceUrl: { targetType: target.targetType, targetId: target.targetId, sourceUrl } },
          select: { id: true, reviewStatus: true },
        });
        if (existing && APPROVED_REVIEW_STATUSES.includes(existing.reviewStatus)) continue;
        await prisma.profileWebsiteEnrichment.upsert({
          where: { targetType_targetId_sourceUrl: { targetType: target.targetType, targetId: target.targetId, sourceUrl } },
          create: {
            targetType: target.targetType,
            targetId: target.targetId,
            targetName: target.targetName,
            sourceUrl,
            sourceName: "Official government source",
            campaignWebsiteUrl: null,
            officialWebsiteUrl: sourceUrl,
            headshotUrl,
            shortBio,
            longBioSourceUrl: shortBio ? sourceUrl : null,
            socialLinks: toJson([]),
            publicContactEmail: email,
            publicContactPhone: phone,
            lastEnrichedAt: fetchedAt,
            enrichmentStatus: errorLog ? ProfileEnrichmentStatus.ERROR : ProfileEnrichmentStatus.FETCHED,
            fetchedAt,
            proposedFields: toJson(proposedFields),
            fieldSources: toJson(fieldSources),
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
            proposedFields: toJson(proposedFields),
            fieldSources: toJson(fieldSources),
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
    } catch (error) {
      diagnostics.failures.push({ candidateId: candidate.id, name: candidate.fullName, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return diagnostics;
}

export async function getIncumbentOfficialBioQaRows(limit = 25): Promise<IncumbentOfficialBioQaRow[]> {
  const candidates = await prisma.candidate.findMany({
    include: {
      office: { select: { title: true } },
      jurisdiction: { select: { name: true, slug: true } },
      district: { select: { name: true } },
      election: { select: { title: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
  });
  const rows: IncumbentOfficialBioQaRow[] = [];
  for (const candidate of candidates) {
    const match = await findIncumbentOfficialMatch(candidate.id);
    if (!match) {
      rows.push({
        candidateId: candidate.id,
        candidateName: candidate.ballotName ?? candidate.fullName,
        race: `${candidate.office?.title ?? candidate.election.title} · ${candidate.jurisdiction.name}`,
        status: candidate.isIncumbent ? "unmatched_incumbent" : "possible_match",
        officialId: null,
        officialName: null,
        officialSourceUrl: null,
        confidenceScore: 0,
      });
      continue;
    }
    const pending = await prisma.profileWebsiteEnrichment.findFirst({
      where: { targetType: "CANDIDATE", targetId: candidate.id, sourceName: "Official government source" },
      orderBy: { fetchedAt: "desc" },
    });
    rows.push({
      candidateId: candidate.id,
      candidateName: match.candidateName,
      race: `${match.candidateOffice} · ${match.candidateJurisdiction}`,
      status: pending ? "matched_pending_review" : "official_source_pending",
      officialId: match.officialId,
      officialName: match.officialName,
      officialSourceUrl: pending?.sourceUrl ?? null,
      confidenceScore: match.confidenceScore,
    });
  }
  return rows;
}
