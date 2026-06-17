#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { CandidateKnowledgeSourceType, PrismaClient, ProfileEnrichmentReviewStatus } from "@prisma/client";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const SOURCE_URL =
  "https://www.nvsos.gov/elections/election-information/2026-election-information/2026-candidate-public-media-information";
const SOURCE_NAME = "Nevada Secretary of State Candidate Public Media Information";
const DEFAULT_IMPORT_DIR = "data/imports/nvsos-candidate-media";
const SOCIAL_HOST_PARTS = ["x.com", "twitter.com", "facebook.com", "instagram.com", "threads.net", "youtube.com", "tiktok.com", "linkedin.com"];
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
    String(value ?? "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/gi, '"'),
  );
}

function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function toJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function sourcePriority(sourceType) {
  return sourceType === CandidateKnowledgeSourceType.SOS_PUBLIC_MEDIA ? 2 : 8;
}

function titleCaseName(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_match, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
    .replace(/\bIi\b/g, "II")
    .replace(/\bIii\b/g, "III")
    .replace(/\bIv\b/g, "IV");
}

function normalizeName(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "")
    .replace(/[^a-z,\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function reorderCommaName(value) {
  const normalized = normalizeName(value);
  if (!normalized.includes(",")) return normalized;
  const [last, ...rest] = normalized.split(",");
  return normalizeWhitespace(`${rest.join(" ").trim()} ${last}`).toLowerCase();
}

function nameKeys(value) {
  const normalized = normalizeName(value);
  return [...new Set([normalized, reorderCommaName(value)].filter(Boolean))];
}

function summarizeText(value, maxLength = 700) {
  const text = normalizeWhitespace(value);
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trimEnd()}...` : text;
}

function extractBetweenLabels(text, labels, stopLabels, maxLength = 900) {
  const clean = normalizeWhitespace(text);
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`(?:^|\\b)${escaped}\\s*[:\\-]?\\s+(.{12,4000})`, "i").exec(clean);
    if (!match) continue;
    let value = match[1];
    for (const stop of stopLabels) {
      const stopMatch = new RegExp(`\\b${stop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:\\-]`, "i").exec(value);
      if (stopMatch?.index) value = value.slice(0, stopMatch.index);
    }
    const summary = summarizeText(value, maxLength);
    if (summary) return summary;
  }
  return null;
}

function extractUrls(text) {
  return [...new Set((text.match(/https?:\/\/[^\s<>)"']+/gi) ?? []).map((url) => url.replace(/[),.;]+$/g, "")))];
}

function extractEmail(text) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
}

function extractPhone(text) {
  return text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0] ?? null;
}

function extractSocialLinks(text) {
  return extractUrls(text).filter((url) => {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return SOCIAL_HOST_PARTS.some((part) => host.includes(part));
    } catch {
      return false;
    }
  });
}

function extractCampaignWebsite(text) {
  const labeled = extractBetweenLabels(text, ["Campaign Website", "Website", "Web Site"], ["Email", "Phone", "Facebook", "Twitter", "Biography"], 260);
  return (
    labeled?.match(/https?:\/\/[^\s]+/i)?.[0] ??
    extractUrls(text).find((url) => {
      try {
        const host = new URL(url).hostname.toLowerCase();
        return !host.includes("nvsos.gov") && !SOCIAL_HOST_PARTS.some((part) => host.includes(part));
      } catch {
        return false;
      }
    }) ??
    null
  );
}

function extractIssues(text, sourceUrl) {
  const priorities = extractBetweenLabels(
    text,
    ["Issues", "Priorities", "Top Priorities", "Platform", "Candidate Statement"],
    ["Biography", "Occupation", "Experience", "Website", "Email", "Phone"],
    1100,
  );
  if (!priorities) return [];
  const chunks = priorities
    .split(/(?:\s+[•*]\s+|\s+\d+[.)]\s+|;\s+)/)
    .map((value) => normalizeWhitespace(value))
    .filter((value) => value.length > 12)
    .slice(0, 6);
  return (chunks.length ? chunks : [priorities]).map((summary, index) => ({
    label: index === 0 ? "Candidate priorities" : `Candidate priority ${index + 1}`,
    summary,
    sourceUrl,
  }));
}

function inferCandidateNameFromFileName(fileName) {
  const cleaned = path
    .basename(fileName)
    .replace(/\.(pdf|txt|text|html|htm)$/i, "")
    .replace(/candidate|public|media|information|2026|form|final/gi, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? titleCaseName(cleaned) : null;
}

function inferCandidateName(text, fileName, linkText) {
  const labeled = extractBetweenLabels(text, ["Candidate Name", "Name of Candidate", "Name"], ["Office", "Party", "Website", "Email"], 140);
  if (labeled && labeled.length <= 140) return titleCaseName(labeled.replace(/^candidate\s+/i, ""));
  const linkName = normalizeWhitespace(linkText).replace(/\.(pdf|txt|text|html|htm)$/i, "");
  if (linkName && !/candidate public media|click here|pdf|document/i.test(linkName) && linkName.length <= 140) return titleCaseName(linkName);
  return inferCandidateNameFromFileName(fileName);
}

function parseOffice(text, metadataText) {
  return (
    extractBetweenLabels(text, ["Office Sought", "Office", "Race"], ["Party", "Website", "Email", "Phone", "Biography"], 180) ??
    extractBetweenLabels(metadataText, ["Office", "Race"], ["Party"], 160)
  );
}

function parseParty(text, metadataText) {
  const value =
    extractBetweenLabels(text, ["Political Party", "Party", "Affiliation"], ["Office", "Website", "Email", "Phone", "Biography"], 80) ??
    extractBetweenLabels(metadataText, ["Party"], ["Office", "Race"], 80);
  return value ? value.replace(/\bparty\b/gi, "").trim() : null;
}

async function parseLocalFile(filePath) {
  const buffer = await fs.readFile(filePath);
  if (/\.pdf$/i.test(filePath)) {
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      return normalizeWhitespace(parsed.text);
    } finally {
      await parser.destroy();
    }
  }
  if (/\.(txt|text|html|htm)$/i.test(filePath)) {
    return stripHtml(buffer.toString("utf8"));
  }
  throw new Error("Unsupported local file type. Supported: .pdf, .txt, .html, .htm");
}

async function collectLocalFiles(importDir) {
  await fs.mkdir(importDir, { recursive: true });
  const entries = await fs.readdir(importDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(pdf|txt|text|html|htm)$/i.test(entry.name))
    .map((entry) => path.join(importDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

async function loadManifest(importDir) {
  const manifestPath = path.join(importDir, "manifest.json");
  try {
    const parsed = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const entries = Array.isArray(parsed) ? parsed : Array.isArray(parsed.documents) ? parsed.documents : [];
    return new Map(
      entries
        .filter((entry) => entry && typeof entry.fileName === "string")
        .map((entry) => [
          entry.fileName,
          {
            candidateName: typeof entry.candidateName === "string" ? entry.candidateName.trim() : null,
            office: typeof entry.office === "string" ? entry.office.trim() : null,
            party: typeof entry.party === "string" ? entry.party.trim() : null,
            sourceUrl: safeUrl(entry.sourceUrl),
            linkText: typeof entry.linkText === "string" ? entry.linkText.trim() : null,
          },
        ]),
    );
  } catch (error) {
    if (error?.code === "ENOENT") return new Map();
    throw error;
  }
}

function sourceUrlForLocalFile(relativePath, manifestEntry) {
  return manifestEntry?.sourceUrl ?? `${SOURCE_URL}#${encodeURIComponent(relativePath.replaceAll(path.sep, "/"))}`;
}

function parseCandidateMediaDocument({ sourceUrl, fileName, linkText, metadataText, text, fetchedAt, manifestEntry }) {
  const candidateName = manifestEntry?.candidateName ?? inferCandidateName(text, fileName, linkText);
  const office = manifestEntry?.office ?? parseOffice(text, metadataText);
  const party = manifestEntry?.party ?? parseParty(text, metadataText);
  const biography =
    extractBetweenLabels(text, ["Biography", "Bio", "Biographical Information"], ["Candidate Statement", "Issues", "Priorities", "Website", "Email", "Phone"], 900) ??
    extractBetweenLabels(text, ["Candidate Statement", "Statement"], ["Issues", "Priorities", "Website", "Email", "Phone"], 900);
  const ownWords = extractBetweenLabels(text, ["Candidate Statement", "Statement", "Why are you running"], ["Biography", "Occupation", "Experience", "Website", "Email", "Phone"], 900) ?? biography;
  const experience = extractBetweenLabels(text, ["Occupation", "Experience", "Background", "Education"], ["Issues", "Priorities", "Website", "Email", "Phone"], 700);
  const campaignWebsite = extractCampaignWebsite(text);
  const email = extractEmail(text);
  const phone = extractPhone(text);
  const socialLinks = extractSocialLinks(text);

  return {
    candidateName,
    office,
    party,
    documentUrl: sourceUrl,
    localFileName: fileName,
    sourceName: SOURCE_NAME,
    fetchedAt,
    biography,
    ownWords,
    experience,
    campaignWebsite,
    email,
    phone,
    socialLinks,
    issues: extractIssues(text, sourceUrl),
    textHash: createHash("sha256").update(text).digest("hex"),
  };
}

async function parseLocalDocuments(importDir, limit) {
  const [files, manifest] = await Promise.all([collectLocalFiles(importDir), loadManifest(importDir)]);
  const selectedFiles = limit > 0 ? files.slice(0, limit) : files;
  const documents = [];
  const parseErrors = [];

  for (const filePath of selectedFiles) {
    const fileName = path.basename(filePath);
    const relativePath = path.relative(process.cwd(), filePath);
    const manifestEntry = manifest.get(fileName) ?? manifest.get(relativePath);
    const sourceUrl = sourceUrlForLocalFile(relativePath, manifestEntry);

    try {
      const text = await parseLocalFile(filePath);
      documents.push(
        parseCandidateMediaDocument({
          sourceUrl,
          fileName,
          linkText: manifestEntry?.linkText ?? fileName,
          metadataText: [manifestEntry?.candidateName, manifestEntry?.office, manifestEntry?.party, fileName].filter(Boolean).join(" "),
          text,
          fetchedAt: new Date(),
          manifestEntry,
        }),
      );
    } catch (error) {
      parseErrors.push({
        candidateName: manifestEntry?.candidateName ?? null,
        office: manifestEntry?.office ?? null,
        documentUrl: sourceUrl,
        localFileName: fileName,
        error: error instanceof Error ? error.message : "Unknown local document parse error.",
      });
    }
  }

  return { files: selectedFiles, documents, parseErrors };
}

async function loadCandidateIndex() {
  const candidates = await prisma.candidate.findMany({
    include: {
      election: { select: { title: true, officeTitle: true } },
      office: { select: { title: true } },
      jurisdiction: { select: { name: true } },
    },
  });
  return candidates.map((candidate) => ({
    id: candidate.id,
    fullName: candidate.fullName,
    ballotName: candidate.ballotName,
    partyText: candidate.partyText,
    officeTitle: candidate.office?.title ?? candidate.election.officeTitle,
    electionTitle: candidate.election.title,
    jurisdictionName: candidate.jurisdiction.name,
    nameKeys: nameKeys(candidate.ballotName ?? candidate.fullName).concat(nameKeys(candidate.fullName)),
  }));
}

function scoreCandidateMatch(document, candidate) {
  if (!document.candidateName) return 0;
  const docKeys = nameKeys(document.candidateName);
  const nameScore = docKeys.some((key) => candidate.nameKeys.includes(key)) ? 0.72 : 0;
  if (!nameScore) return 0;
  const officeText = `${document.office ?? ""}`.toLowerCase();
  const candidateOffice = `${candidate.officeTitle ?? ""} ${candidate.electionTitle ?? ""}`.toLowerCase();
  const officeScore = officeText && candidateOffice.includes(officeText.slice(0, 24)) ? 0.16 : 0;
  const partyScore = document.party && candidate.partyText && document.party.toLowerCase().includes(candidate.partyText.toLowerCase().slice(0, 3)) ? 0.04 : 0;
  return Math.min(0.96, nameScore + officeScore + partyScore);
}

function findCandidateMatch(document, candidates) {
  const matches = candidates
    .map((candidate) => ({ candidate, score: scoreCandidateMatch(document, candidate) }))
    .filter((match) => match.score >= 0.72)
    .sort((left, right) => right.score - left.score);
  return matches[0] ?? null;
}

async function upsertCandidateKnowledge(document, match) {
  const sourceAttribution = [
    {
      sourceName: SOURCE_NAME,
      sourceUrl: document.documentUrl,
      sourceType: CandidateKnowledgeSourceType.SOS_PUBLIC_MEDIA,
      fetchedAt: document.fetchedAt.toISOString(),
      candidateName: document.candidateName,
      office: document.office,
      party: document.party,
      localFileName: document.localFileName,
      campaignWebsite: document.campaignWebsite,
      email: document.email,
      phone: document.phone,
      textHash: document.textHash,
      matchConfidence: match.score,
    },
  ];
  const existing = await prisma.candidateKnowledgeEnrichment.findUnique({
    where: { candidateId_sourceUrl: { candidateId: match.candidate.id, sourceUrl: document.documentUrl } },
    select: { reviewStatus: true },
  });
  const protectReviewed =
    existing?.reviewStatus === ProfileEnrichmentReviewStatus.APPROVED ||
    existing?.reviewStatus === ProfileEnrichmentReviewStatus.VERIFIED;
  const data = {
    sourceName: SOURCE_NAME,
    sourceType: CandidateKnowledgeSourceType.SOS_PUBLIC_MEDIA,
    sourcePriority: sourcePriority(CandidateKnowledgeSourceType.SOS_PUBLIC_MEDIA),
    title: document.candidateName ? `${document.candidateName} candidate public media information` : "Candidate public media information",
    aboutSummary: document.biography,
    ownWordsSummary: document.ownWords,
    issues: toJson(document.issues),
    experienceSummary: document.experience,
    financeContext: null,
    newsItems: toJson([]),
    socialLinks: toJson(document.socialLinks),
    sourceAttribution: toJson(sourceAttribution),
    confidenceScore: match.score,
    fetchedAt: document.fetchedAt,
    lastUpdatedAt: document.fetchedAt,
    errorLog: null,
  };

  if (protectReviewed) {
    return {
      row: await prisma.candidateKnowledgeEnrichment.update({
        where: { candidateId_sourceUrl: { candidateId: match.candidate.id, sourceUrl: document.documentUrl } },
        data: {
          fetchedAt: document.fetchedAt,
          lastUpdatedAt: document.fetchedAt,
          sourceAttribution: data.sourceAttribution,
          confidenceScore: Math.max(match.score, 0.5),
        },
      }),
      created: false,
      protected: true,
    };
  }

  const created = !existing;
  return {
    row: await prisma.candidateKnowledgeEnrichment.upsert({
      where: { candidateId_sourceUrl: { candidateId: match.candidate.id, sourceUrl: document.documentUrl } },
      create: {
        candidateId: match.candidate.id,
        sourceUrl: document.documentUrl,
        ...data,
        reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
      },
      update: {
        ...data,
        reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
        reviewedAt: null,
        reviewedByUserId: null,
        reviewNotes: null,
      },
    }),
    created,
    protected: false,
  };
}

async function main() {
  const limit = Number(argValue("limit", "0"));
  const importDir = path.resolve(argValue("dir", DEFAULT_IMPORT_DIR));
  const diagnostics = {
    sourceUrl: SOURCE_URL,
    importMode: "manual_local_files",
    importDir,
    documentsFound: 0,
    documentsParsed: 0,
    candidatesMatched: 0,
    unmatchedDocuments: [],
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsProtected: 0,
    recordsPendingReview: 0,
    lastError: null,
  };

  try {
    const [{ files, documents, parseErrors }, candidates] = await Promise.all([parseLocalDocuments(importDir, limit), loadCandidateIndex()]);
    diagnostics.documentsFound = files.length;
    diagnostics.documentsParsed = documents.length;
    diagnostics.unmatchedDocuments.push(...parseErrors);

    for (const document of documents) {
      const match = findCandidateMatch(document, candidates);
      if (!match) {
        diagnostics.unmatchedDocuments.push({
          candidateName: document.candidateName,
          office: document.office,
          documentUrl: document.documentUrl,
          localFileName: document.localFileName,
        });
        continue;
      }

      diagnostics.candidatesMatched += 1;
      const result = await upsertCandidateKnowledge(document, match);
      if (result.created) diagnostics.recordsCreated += 1;
      else diagnostics.recordsUpdated += 1;
      if (result.protected) diagnostics.recordsProtected += 1;
      if (result.row.reviewStatus === ProfileEnrichmentReviewStatus.PENDING_REVIEW) diagnostics.recordsPendingReview += 1;
    }
  } catch (error) {
    diagnostics.lastError = error instanceof Error ? error.message : "Unknown Nevada SOS candidate media import error.";
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
