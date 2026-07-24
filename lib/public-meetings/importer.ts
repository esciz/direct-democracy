import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { writePublicCivicCaseArtifacts } from "@/lib/public-cases/public-civic-cases";
import {
  PUBLIC_MEETING_OUTPUT_FILES,
  PUBLIC_MEETING_PATHS,
  absolutePublicMeetingPath,
  inferPolicyArea,
  normalizeTextLines,
  normalizeWhitespace,
  safeUrl,
  seedToBodyId,
  slugify,
  stripHtml,
  summarizeText,
} from "@/lib/public-meetings/shared";
import { applyOfficialActionMatches, loadOfficialActionMatchCandidates } from "@/lib/public-meetings/official-action-matcher";
import { importPublicMeetingOfficialRosters } from "@/lib/public-meetings/official-rosters";
import { extractOfficialActionsForItem, extractTopicOutcome, itemHasUnnamedVoteOutcome } from "@/lib/public-meetings/official-actions";
import { buildMeetingVotingCards } from "@/lib/public-meetings/voting-cards";
import { writePublicMeetingRuntimeArtifacts } from "@/lib/public-meetings/runtime-artifacts";
import type {
  CitizenVoteQuestionRecord,
  MeetingIngestionStatus,
  MeetingItemType,
  OfficialMeetingActionRecord,
  PublicBodyRecord,
  PublicMeetingDocumentType,
  PublicMeetingExtractionMethod,
  PublicMeetingImportDocument,
  PublicMeetingIngestionReport,
  PublicMeetingItemRecord,
  PublicMeetingProviderReport,
  PublicMeetingRecord,
  PublicMeetingSourceSeed,
  VoteChoice,
  VoteRecord,
} from "@/lib/public-meetings/types";

type ExtractedDocument = {
  importDocument: PublicMeetingImportDocument;
  body: PublicBodyRecord | null;
  text: string;
  hash: string | null;
  cachedTextPath: string | null;
  rawPath: string | null;
  method: PublicMeetingExtractionMethod;
  status: MeetingIngestionStatus;
  error: string | null;
};

type ParsedItemDraft = {
  itemNumber: string | null;
  title: string;
  sourceText: string;
  confidence: number;
};

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".txt", ".text", ".html", ".htm"]);
const MANIFEST_NAMES = new Set(["manifest.json"]);
const HISTORICAL_BACKFILL_START = Date.parse("2024-01-01T00:00:00-08:00");
const UPCOMING_DISCOVERY_END = new Date(new Date().setMonth(new Date().getMonth() + 18)).getTime();

type ArchiveMeetingDraft = {
  id: string;
  sourceId: string;
  publicBodyName: string;
  jurisdiction: string;
  level: PublicMeetingSourceSeed["level"];
  meetingDate: string;
  meetingType: string | null;
  title: string;
  agendaUrl: string | null;
  minutesUrl: string | null;
  packetUrl: string | null;
  videoUrl: string | null;
  sourceUrl: string | null;
  sourceUrls: string[];
  sourceDocumentCount: number;
  meetingSummary: string | null;
  itemHints?: ParsedItemDraft[];
};

type ArchiveDiscoveryResult = {
  drafts: ArchiveMeetingDraft[];
  providerReports: PublicMeetingProviderReport[];
  errors: PublicMeetingIngestionReport["errors"];
};

function hashBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isMeetingDateInDiscoveryWindow(meetingDate: string | null): meetingDate is string {
  if (!meetingDate) return false;
  const timestamp = Date.parse(meetingDate);
  return Number.isFinite(timestamp) && timestamp >= HISTORICAL_BACKFILL_START && timestamp <= UPCOMING_DISCOVERY_END;
}

async function readJsonFile<T>(relativePath: string, fallback: T): Promise<T> {
  const filePath = absolutePublicMeetingPath(relativePath);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function writeJsonFile(relativePath: string, value: unknown) {
  const filePath = absolutePublicMeetingPath(relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function decodeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function absolutizeUrl(url: string | null | undefined, baseUrl: string) {
  const cleaned = decodeHtml(url).trim();
  if (!cleaned || /^javascript:/i.test(cleaned)) return null;
  try {
    return new URL(cleaned, baseUrl).toString();
  } catch {
    return null;
  }
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Direct Democracy civic meeting archive backfill; source-attribution research crawler",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} for ${url}`);
  }
  return response.text();
}

async function fetchBuffer(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Direct Democracy civic meeting document parser; source-attribution research crawler",
      accept: "application/pdf,text/html,application/xhtml+xml,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} for ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function parseArchiveDate(value: string) {
  const normalized = decodeHtml(value).replace(/\s+/g, " ").trim();
  const match = normalized.match(/\b([A-Z][a-z]{2,8})\s+(\d{1,2}),\s+(20\d{2})(?:\s+-\s+(\d{1,2}):(\d{2})\s*(AM|PM))?/);
  if (!match) return null;
  const month = match[1];
  const day = match[2];
  const year = match[3];
  const hour = match[4] ?? "8";
  const minute = match[5] ?? "30";
  const meridiem = match[6] ?? "AM";
  const fallback = Date.parse(`${month} ${day}, ${year} ${hour}:${minute} ${meridiem} GMT-0700`);
  return Number.isFinite(fallback) ? new Date(fallback).toISOString() : null;
}

function parseUsDate(value: string) {
  const match = normalizeWhitespace(value).match(/\b(0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])[-/](20\d{2})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?/i);
  if (!match) return null;
  const hour = match[4] ?? "8";
  const minute = match[5] ?? "30";
  const meridiem = match[6] ?? "AM";
  const parsed = Date.parse(`${match[1]}/${match[2]}/${match[3]} ${hour}:${minute} ${meridiem} GMT-0700`);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function parseCells(rowHtml: string) {
  return [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
}

function cellText(cellHtml: string) {
  return normalizeWhitespace(stripHtml(decodeHtml(cellHtml)));
}

function extractCellLinks(cellHtml: string, baseUrl: string) {
  const links: Array<{ label: string; href: string }> = [];
  for (const match of cellHtml.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = match[1];
    const label = cellText(match[2]);
    const hrefMatch = attrs.match(/\bhref=["']([^"']+)["']/i);
    const onClickMatch = attrs.match(/window\.open\(["']([^"']+)["']/i);
    const href = absolutizeUrl(onClickMatch?.[1] ?? hrefMatch?.[1], baseUrl);
    if (href) links.push({ label, href });
  }
  return links;
}

function inferMeetingTypeFromTitle(title: string) {
  const value = title.toLowerCase();
  if (value.includes("special")) return "Special meeting";
  if (value.includes("work session")) return "Work session";
  if (value.includes("joint")) return "Joint meeting";
  if (value.includes("hearing")) return "Public hearing";
  return "Regular meeting";
}

function makeProviderReport(seed: PublicMeetingSourceSeed, drafts: ArchiveMeetingDraft[], options?: { supported?: boolean; failures?: number; notes?: string | null }): PublicMeetingProviderReport {
  const dates = drafts.map((draft) => draft.meetingDate).filter(Boolean).sort();
  return {
    source_id: seed.id,
    provider_name: seed.name,
    jurisdiction: seed.jurisdiction,
    scraper_type: seed.scraperType,
    historical_ingestion_supported: options?.supported ?? drafts.length > 0,
    meetings_discovered: drafts.length,
    meetings_parsed: drafts.length,
    minutes_parsed: drafts.filter((draft) => Boolean(draft.minutesUrl)).length,
    agenda_packets_parsed: drafts.filter((draft) => Boolean(draft.packetUrl)).length,
    failures: options?.failures ?? 0,
    oldest_meeting_found: dates[0] ?? null,
    newest_meeting_found: dates.at(-1) ?? null,
    notes: options?.notes ?? null,
  };
}

function extractPlainLanguage(title: string, sourceText: string) {
  const summary = summarizeText(title.replace(/^(?:item\s+)?(?:\d{1,3}[a-z]?|[A-Z])[\.)]\s+/i, ""), 220) || "Meeting topic";
  const policyArea = inferPolicyArea(`${title} ${sourceText}`);
  const fiscalImpact = extractFiscalImpact(sourceText);
  const voteOutcome = extractVoteResult(sourceText);
  return {
    oneSentenceSummary: summary.endsWith(".") ? summary : `${summary}.`,
    plainEnglishExplanation: summarizeText(`This agenda topic concerns ${summary.charAt(0).toLowerCase()}${summary.slice(1)}${policyArea !== "Other" ? ` It is classified under ${policyArea}.` : ""}`, 520),
    whyItMatters: summarizeText(
      fiscalImpact
        ? `It may affect public spending or services because the materials mention ${fiscalImpact}.`
        : `It may affect residents, services, rules, or public resources connected to ${policyArea === "Other" ? "local government operations" : policyArea.toLowerCase()}.`,
      420,
    ),
    affectedGroups: inferAffectedGroups(`${title} ${sourceText}`),
    financialImpact: fiscalImpact,
    voteOutcome,
  };
}

function inferAffectedGroups(text: string) {
  const value = text.toLowerCase();
  const groups = new Set<string>();
  if (/\bresident|neighborhood|community|public comment\b/.test(value)) groups.add("Residents");
  if (/\bstudent|school|teacher|trustee|district\b/.test(value)) groups.add("Students and schools");
  if (/\bbusiness|vendor|contract|license|permit\b/.test(value)) groups.add("Businesses and vendors");
  if (/\bdeveloper|zoning|parcel|land use|subdivision|planning\b/.test(value)) groups.add("Property owners and developers");
  if (/\bsheriff|police|fire|emergency|public safety\b/.test(value)) groups.add("Public safety agencies");
  if (/\broad|street|transportation|transit|sidewalk\b/.test(value)) groups.add("Drivers, riders, and pedestrians");
  if (/\bwater|utility|sewer|environment\b/.test(value)) groups.add("Utility customers and environmental stakeholders");
  return [...groups].slice(0, 6);
}

function extractOfficialNames(text: string) {
  const names = new Set<string>();
  for (const match of text.matchAll(/\b(?:Commissioner|Councilmember|Mayor|Supervisor|Trustee|Senator|Assembly(?:woman|man|member)?)\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})/g)) {
    names.add(match[1]);
  }
  return [...names].slice(0, 12);
}

function extractOrganizationNames(text: string) {
  const names = new Set<string>();
  for (const match of text.matchAll(/\b([A-Z][A-Za-z0-9&.'-]+(?:\s+[A-Z][A-Za-z0-9&.'-]+){1,6})\s+(?:LLC|Inc\.?|Corporation|Department|District|Authority|Commission|Board|Committee)\b/g)) {
    names.add(match[0]);
  }
  return [...names].slice(0, 12);
}

function extractAgendaItemHintsFromDetail(text: string): ParsedItemDraft[] {
  const normalized = normalizeWhitespace(text);
  const hints: ParsedItemDraft[] = [];
  const itemPattern = /\b(TMP-\d+)\s+\d+\s+([0-9A-Z]+(?:\.[0-9A-Z]+)*)\.?\s+([A-Za-z][A-Za-z /-]{2,40})\s+([\s\S]*?)(?=\s+TMP-\d+\s+\d+\s+[0-9A-Z]+(?:\.[0-9A-Z]+)*\.?\s+[A-Za-z]|\s+Adjournment\b|$)/g;
  for (const match of normalized.matchAll(itemPattern)) {
    const itemNumber = match[2] ?? null;
    const itemType = normalizeWhitespace(match[3]);
    const body = normalizeWhitespace(match[4]);
    if (!body || body.length < 24) continue;
    const title = summarizeText(`${itemNumber ? `${itemNumber}. ` : ""}${itemType}: ${body}`, 180);
    hints.push({
      itemNumber,
      title,
      sourceText: summarizeText(`${match[1]} ${itemType} ${body}`, 1800),
      confidence: 0.72,
    });
  }
  return hints.slice(0, 120);
}

function parseMeetingDateFromDetail(text: string) {
  const match = text.match(/\bMeeting date\/time:\s*(\d{1,2}\/\d{1,2}\/20\d{2}\s+\d{1,2}:\d{2}\s*(?:AM|PM))/i);
  if (!match) return null;
  const parsed = Date.parse(`${match[1]} GMT-0700`);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function pickDetailLink(links: Array<{ label: string; href: string }>, labelPattern: RegExp, hrefPattern?: RegExp) {
  return links.find((link) => labelPattern.test(link.label) || (hrefPattern ? hrefPattern.test(link.href) : false))?.href ?? null;
}

function archiveBodyId(seedId: string, bodyName: string) {
  return `body-${seedId}-${slugify(bodyName)}`;
}

function buildArchiveBody(seed: PublicMeetingSourceSeed, bodyName: string, now: string): PublicBodyRecord {
  return {
    id: archiveBodyId(seed.id, bodyName),
    name: bodyName,
    jurisdiction: seed.jurisdiction,
    level: seed.level,
    website: seed.website ?? null,
    source_url: seed.sourceUrl ?? seed.meetingIndexUrl ?? null,
    meeting_index_url: seed.meetingIndexUrl ?? null,
    scraper_type: seed.scraperType,
    active: true,
    seed_source_id: seed.id,
    notes: `Discovered from the official ${seed.name} meeting calendar and archive.`,
    created_at: now,
    updated_at: now,
  };
}

async function discoverCarsonGranicusArchive(seed: PublicMeetingSourceSeed): Promise<ArchiveMeetingDraft[]> {
  const archiveUrl = "https://carsoncity.granicus.com/ViewPublisher.php?view_id=2";
  const html = await fetchText(archiveUrl);
  const rawPath = path.join(PUBLIC_MEETING_PATHS.rawRoot, "archive-indexes", `${seed.id}-granicus.html`);
  await mkdir(path.dirname(absolutePublicMeetingPath(rawPath)), { recursive: true });
  await writeFile(absolutePublicMeetingPath(rawPath), html, "utf8");

  const mapped: Array<ArchiveMeetingDraft | null> = [...html.matchAll(/<tr class="listingRow">([\s\S]*?)<\/tr>/gi)]
    .map((match): ArchiveMeetingDraft | null => {
      const cells = parseCells(match[1]);
      if (cells.length < 3) return null;
      const publicBodyName = cellText(cells[0]);
      const meetingDate = parseArchiveDate(cellText(cells[1]));
      if (!publicBodyName || !isMeetingDateInDiscoveryWindow(meetingDate)) {
        return null;
      }
      const links = cells.flatMap((cell) => extractCellLinks(cell, archiveUrl));
      const findLink = (pattern: RegExp) => links.find((link) => pattern.test(`${link.label} ${link.href}`))?.href ?? null;
      const agendaUrl = findLink(/\bagenda\b/i);
      const minutesUrl = findLink(/\bminutes?\b/i);
      const packetUrl = findLink(/\bpacket\b/i);
      const videoUrl = findLink(/\bvideo|mediaplayer\b/i);
      const sourceUrls = [...new Set([agendaUrl, minutesUrl, packetUrl, videoUrl, archiveUrl].filter((url): url is string => Boolean(url)))];
      const title = `${publicBodyName} - ${inferMeetingTypeFromTitle(publicBodyName)}`;
      const id = `meeting-${seed.id}-${slugify(publicBodyName)}-${meetingDate.slice(0, 10)}-${hashText(`${publicBodyName}:${meetingDate}:${sourceUrls.join("|")}`).slice(0, 8)}`;
      return {
        id,
        sourceId: seed.id,
        publicBodyName,
        jurisdiction: seed.jurisdiction,
        level: seed.level,
        meetingDate,
        meetingType: inferMeetingTypeFromTitle(publicBodyName),
        title,
        agendaUrl,
        minutesUrl,
        packetUrl,
        videoUrl,
        sourceUrl: agendaUrl ?? minutesUrl ?? packetUrl ?? videoUrl ?? archiveUrl,
        sourceUrls,
        sourceDocumentCount: [agendaUrl, minutesUrl, packetUrl, videoUrl].filter(Boolean).length,
        meetingSummary: minutesUrl
          ? `${publicBodyName} meeting record discovered from the official Carson City Granicus calendar with minutes available for civic intelligence processing.`
          : `${publicBodyName} meeting record discovered from the official Carson City Granicus calendar.`,
      } satisfies ArchiveMeetingDraft;
    });
  return mapped.filter((draft): draft is ArchiveMeetingDraft => Boolean(draft));
}

async function discoverGenericHtmlArchive(seed: PublicMeetingSourceSeed): Promise<ArchiveMeetingDraft[]> {
  const urls = [
    seed.meetingIndexUrl,
    seed.agendaArchiveUrl,
    seed.minutesArchiveUrl,
    seed.packetArchiveUrl,
    seed.sourceUrl,
  ].filter((url, index, urls): url is string => Boolean(url) && urls.indexOf(url) === index);
  const drafts = new Map<string, ArchiveMeetingDraft>();

  for (const url of urls.slice(0, 3)) {
    if (/primegov|boarddocs|legistar/i.test(url)) continue;
    let html = "";
    try {
      html = await fetchText(url);
    } catch {
      continue;
    }
    const rawPath = path.join(PUBLIC_MEETING_PATHS.rawRoot, "archive-indexes", `${seed.id}-${hashText(url).slice(0, 8)}.html`);
    await mkdir(path.dirname(absolutePublicMeetingPath(rawPath)), { recursive: true });
    await writeFile(absolutePublicMeetingPath(rawPath), html, "utf8");
    const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((match) => {
      const attrs = match[1];
      const label = cellText(match[2]);
      const href = absolutizeUrl(attrs.match(/\bhref=["']([^"']+)["']/i)?.[1], url);
      return href ? { label, href } : null;
    }).filter((link): link is { label: string; href: string } => Boolean(link));

    for (const link of links) {
      const dateText = link.label.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+20\d{2}\b/i)?.[0];
      const meetingDate = parseArchiveDate(dateText ?? link.label);
      if (!isMeetingDateInDiscoveryWindow(meetingDate)) continue;
      if (!/\bagenda|minutes?|packet|meeting|hearing|commission|board|council\b/i.test(`${link.label} ${link.href}`)) continue;
      const lower = `${link.label} ${link.href}`.toLowerCase();
      const existingKey = `${seed.id}:${meetingDate.slice(0, 10)}:${slugify(seed.name)}`;
      const existing = drafts.get(existingKey);
      const agendaUrl = lower.includes("agenda") ? link.href : existing?.agendaUrl ?? null;
      const minutesUrl = lower.includes("minute") ? link.href : existing?.minutesUrl ?? null;
      const packetUrl = lower.includes("packet") ? link.href : existing?.packetUrl ?? null;
      const sourceUrls = [...new Set([existing?.sourceUrls ?? [], link.href, url].flat().filter(Boolean) as string[])];
      drafts.set(existingKey, {
        id: `meeting-${seed.id}-${meetingDate.slice(0, 10)}-${hashText(existingKey).slice(0, 8)}`,
        sourceId: seed.id,
        publicBodyName: seed.name,
        jurisdiction: seed.jurisdiction,
        level: seed.level,
        meetingDate,
        meetingType: inferMeetingTypeFromTitle(link.label),
        title: `${seed.name} - ${inferMeetingTypeFromTitle(link.label)}`,
        agendaUrl,
        minutesUrl,
        packetUrl,
        videoUrl: existing?.videoUrl ?? seed.videoArchiveUrl ?? null,
        sourceUrl: agendaUrl ?? minutesUrl ?? packetUrl ?? link.href,
        sourceUrls,
        sourceDocumentCount: [agendaUrl, minutesUrl, packetUrl, existing?.videoUrl ?? seed.videoArchiveUrl ?? null].filter(Boolean).length,
        meetingSummary: `${seed.name} meeting record discovered from its official calendar or archive.`,
      });
    }
  }

  return [...drafts.values()];
}

async function discoverLegistarArchive(seed: PublicMeetingSourceSeed): Promise<ArchiveMeetingDraft[]> {
  if (!seed.meetingIndexUrl) return [];
  const years = Array.from(
    { length: new Date().getFullYear() - 2024 + 2 },
    (_, index) => 2024 + index,
  );
  const drafts = new Map<string, ArchiveMeetingDraft>();

  for (const year of years) {
    const calendarUrl = `${seed.meetingIndexUrl.replace(/\/$/, "")}/Calendar.aspx?From=01/01/${year}&To=12/31/${year}`;
    const html = await fetchText(calendarUrl);
    const rawPath = path.join(PUBLIC_MEETING_PATHS.rawRoot, "archive-indexes", `${seed.id}-legistar-${year}.html`);
    await mkdir(path.dirname(absolutePublicMeetingPath(rawPath)), { recursive: true });
    await writeFile(absolutePublicMeetingPath(rawPath), html, "utf8");
    const rows = [...html.matchAll(/<tr\b[\s\S]*?MeetingDetail\.aspx[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
    for (const row of rows) {
      const text = cellText(row);
      const href = row.match(/href=["']([^"']*MeetingDetail\.aspx[^"']+)["']/i)?.[1];
      const detailUrl = absolutizeUrl(href, calendarUrl);
      const titleMatch = text.match(/\b(Board of County Commissioners|Concurrent Meeting|Truckee Meadows|Citizens Advisory Board|Planning Commission|[A-Z][A-Za-z /&-]+(?:Board|Commission|Committee|Council))\b/);
      const dateMatch = text.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},\s+20\d{2}(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM))?/i);
      const meetingDate = parseArchiveDate(dateMatch?.[0] ?? text);
      if (!detailUrl || !isMeetingDateInDiscoveryWindow(meetingDate)) continue;
      const publicBodyName = titleMatch?.[0] ?? seed.name;
      let agendaUrl: string | null = null;
      let packetUrl: string | null = null;
      let minutesUrl: string | null = null;
      let videoUrl: string | null = null;
      let detailText = "";
      try {
        const detail = await fetchText(detailUrl);
        detailText = cellText(detail);
        const detailLinks = extractCellLinks(detail, detailUrl);
        agendaUrl = detailLinks.find((link) => /M=A(?:&|$)|agenda/i.test(`${link.label} ${link.href}`))?.href ?? null;
        packetUrl = detailLinks.find((link) => /M=AADA|packet|attachment/i.test(`${link.label} ${link.href}`))?.href ?? null;
        minutesUrl = detailLinks.find((link) => /M=M|minutes/i.test(`${link.label} ${link.href}`))?.href ?? null;
        videoUrl = detailLinks.find((link) => /video|media/i.test(`${link.label} ${link.href}`))?.href ?? null;
      } catch {
        // Keep the meeting shell with the detail URL as source.
      }
      const sourceUrls = [...new Set([agendaUrl, minutesUrl, packetUrl, videoUrl, detailUrl].filter((url): url is string => Boolean(url)))];
      const id = `meeting-${seed.id}-${slugify(publicBodyName)}-${meetingDate.slice(0, 10)}-${hashText(`${detailUrl}:${meetingDate}`).slice(0, 8)}`;
      drafts.set(id, {
        id,
        sourceId: seed.id,
        publicBodyName,
        jurisdiction: seed.jurisdiction,
        level: seed.level,
        meetingDate,
        meetingType: inferMeetingTypeFromTitle(publicBodyName),
        title: `${publicBodyName} - ${inferMeetingTypeFromTitle(publicBodyName)}`,
        agendaUrl,
        minutesUrl,
        packetUrl,
        videoUrl,
        sourceUrl: detailUrl,
        sourceUrls,
        sourceDocumentCount: [agendaUrl, minutesUrl, packetUrl, videoUrl].filter(Boolean).length,
        meetingSummary: `${publicBodyName} meeting record discovered from the official Legistar calendar.${detailText ? ` ${summarizeText(detailText, 240)}` : ""}`,
      });
    }
  }

  if (seed.id === "washoe-county-commission") {
    const detailDrafts = await discoverWashoeLegistarDetailPages(seed);
    for (const draft of detailDrafts) drafts.set(draft.id, draft);
  }

  return [...drafts.values()];
}

async function discoverWashoeLegistarDetailPages(seed: PublicMeetingSourceSeed): Promise<ArchiveMeetingDraft[]> {
  const verifiedDetailUrls = [
    "https://washoe-nv.legistar.com/MeetingDetail.aspx?GUID=C076565D-0936-4546-9AB0-AB0314A3FEED&ID=1134961&Search=",
    "https://washoe-nv.legistar.com/MeetingDetail.aspx?GUID=2B4CAABF-0D0D-485A-846F-7F840DAA56D3&ID=1134970&Search=",
    "https://washoe-nv.legistar.com/MeetingDetail.aspx?GUID=8A2D1E74-23B0-4988-8954-B59EC06F0C53&ID=1134980&Options=info%7C&Search=",
    "https://washoe-nv.legistar.com/MeetingDetail.aspx?From=RSS&GUID=908642B6-423B-4517-92F4-6D129CADDCC5&ID=1134982",
    "https://washoe-nv.legistar.com/MeetingDetail.aspx?GUID=21C0127D-F86C-437C-86EA-A17D9692CF11&ID=1134988&Search=",
    "https://washoe-nv.legistar.com/MeetingDetail.aspx?GUID=DC096042-24D0-409A-BDBC-B942081FACD6&ID=1134990&Search=",
    "https://washoe-nv.legistar.com/MeetingDetail.aspx?GUID=AEDDA8BC-D21E-49F1-A52D-2CAF00679D0D&ID=1134991&Search=",
    "https://washoe-nv.legistar.com/MeetingDetail.aspx?GUID=8231C4C3-2F16-449F-8582-09821F36297E&ID=1134992&Search=",
    "https://washoe-nv.legistar.com/MeetingDetail.aspx?GUID=88A75381-7676-4B04-960C-891684394CCA&ID=1245061&Search=",
    "https://washoe-nv.legistar.com/MeetingDetail.aspx?GUID=10CF2148-E307-42F7-B138-8A22DAE05C7F&ID=1245064&Search=",
    "https://washoe-nv.legistar.com/MeetingDetail.aspx?From=RSS&GUID=15933512-43DE-4CB6-B1AB-6781D6AF42FF&ID=1245065",
    "https://washoe-nv.legistar.com/MeetingDetail.aspx?GUID=95260B24-2C6A-46FF-A868-1576786DEB36&ID=1245066&Search=",
    "https://washoe-nv.legistar.com/MeetingDetail.aspx?GUID=78C9A59F-AE47-45D5-A700-D1C8B6CCCA11&ID=1245075&Options=info%7C&Search=",
    "https://washoe-nv.legistar.com/MeetingDetail.aspx?GUID=E8B2C559-A10E-4E2F-946E-C3FC916409FE&ID=1245080&Options=info%7C&Search=",
    "https://washoe-nv.legistar.com/MeetingDetail.aspx?GUID=FFDD3420-F957-4B40-A60E-E852CD56D5C8&ID=1245081&Options=&Search=",
    "https://washoe-nv.legistar.com/MeetingDetail.aspx?GUID=6E9E0511-006E-4399-A4EC-5C8C7286692B&ID=1245085&Search=",
    "https://washoe-nv.legistar.com/MeetingDetail.aspx?GUID=E6A3DAF3-5735-4CFF-B40F-8727651BE849&ID=1347265&Search=",
  ];
  const drafts = new Map<string, ArchiveMeetingDraft>();

  for (const detailUrl of verifiedDetailUrls) {
      let html = "";
      try {
        html = await fetchText(detailUrl);
      } catch {
        continue;
      }
      const text = normalizeTextLines(stripHtml(html));
      if (!/\bMeeting Name:\s*Board of County Commissioners\b/i.test(text)) continue;
      const meetingDate = parseMeetingDateFromDetail(text);
      if (!isMeetingDateInDiscoveryWindow(meetingDate)) continue;
      const links = extractCellLinks(html, detailUrl);
      const agendaUrl = pickDetailLink(links, /^Agenda$/i, /M=A(?:&|$)/i);
      const minutesUrl = pickDetailLink(links, /^Minutes$/i, /M=M(?:&|$)/i);
      const packetUrl = pickDetailLink(links, /packet/i, /M=AADA/i);
      const videoUrl = pickDetailLink(links, /^Video$/i, /video|media/i);
      const itemHints = extractAgendaItemHintsFromDetail(text);
      const sourceUrls = [...new Set([agendaUrl, minutesUrl, packetUrl, videoUrl, detailUrl].filter((url): url is string => Boolean(url)))];
      const meetingType = /special/i.test(text) ? "Special meeting" : "Regular meeting";
      const draftId = `meeting-${seed.id}-board-of-county-commissioners-${meetingDate.slice(0, 10)}-${hashText(`${detailUrl}:${meetingDate}`).slice(0, 8)}`;
      drafts.set(draftId, {
        id: draftId,
        sourceId: seed.id,
        publicBodyName: "Board of County Commissioners",
        jurisdiction: seed.jurisdiction,
        level: seed.level,
        meetingDate,
        meetingType,
        title: `Board of County Commissioners - ${meetingType}`,
        agendaUrl,
        minutesUrl,
        packetUrl,
        videoUrl,
        sourceUrl: detailUrl,
        sourceUrls,
        sourceDocumentCount: sourceUrls.length,
        meetingSummary: `Washoe County Board of County Commissioners meeting imported from the official Legistar record with ${itemHints.length} agenda item records parsed.`,
        itemHints,
      });
  }

  return [...drafts.values()];
}

async function discoverNevadaLegislatureArchive(seed: PublicMeetingSourceSeed): Promise<ArchiveMeetingDraft[]> {
  const urls = ["https://www.leg.state.nv.us/App/Calendar/A/"];
  const drafts = new Map<string, ArchiveMeetingDraft>();
  for (const url of urls) {
    const html = await fetchText(url);
    const rawPath = path.join(PUBLIC_MEETING_PATHS.rawRoot, "archive-indexes", `${seed.id}-calendar.html`);
    await mkdir(path.dirname(absolutePublicMeetingPath(rawPath)), { recursive: true });
    await writeFile(absolutePublicMeetingPath(rawPath), html, "utf8");
    const blocks = html.split(/<div class="BGazure fBold">/g).slice(1);
    for (const block of blocks) {
      const dateLabel = cellText(block.split(/<hr/i)[0] ?? "");
      const dayMatch = dateLabel.match(/\b[A-Z][a-z]+,\s+[A-Z][a-z]+\s+\d{1,2},\s+20\d{2}\b/);
      if (!dayMatch) continue;
      for (const row of block.matchAll(/<div class="row padTop padBottom">([\s\S]*?)(?=<div class="row padTop padBottom">|<div class='gradient'|$)/gi)) {
        const rowHtml = row[1];
        const time = cellText(rowHtml).match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/i)?.[0] ?? "8:30 AM";
        const meetingDate = parseArchiveDate(`${dayMatch[0]} - ${time}`);
        if (!isMeetingDateInDiscoveryWindow(meetingDate) || /\bcancelled\b/i.test(cellText(rowHtml))) continue;
        const links = extractCellLinks(rowHtml, url);
        const meetingLink = links.find((link) => /\/Meeting\/\d+/.test(link.href));
        if (!meetingLink) continue;
        const title = meetingLink.label || "Nevada Legislature meeting";
        const location = cellText(rowHtml).match(/Room [^.]+\.?/i)?.[0] ?? null;
        const id = `meeting-${seed.id}-${slugify(title)}-${meetingDate.slice(0, 10)}-${hashText(`${meetingLink.href}:${meetingDate}`).slice(0, 8)}`;
        drafts.set(id, {
          id,
          sourceId: seed.id,
          publicBodyName: title,
          jurisdiction: seed.jurisdiction,
          level: seed.level,
          meetingDate,
          meetingType: title.includes("Assembly") ? "Assembly committee meeting" : title.includes("Senate") ? "Senate committee meeting" : "Legislative committee meeting",
          title,
          agendaUrl: meetingLink.href,
          minutesUrl: null,
          packetUrl: null,
          videoUrl: seed.videoArchiveUrl ?? null,
          sourceUrl: meetingLink.href,
          sourceUrls: [...new Set([meetingLink.href, seed.videoArchiveUrl].filter(Boolean) as string[])],
          sourceDocumentCount: 1,
          meetingSummary: `Nevada legislative meeting discovered from the Legislature calendar.${location ? ` Location: ${location}` : ""}`,
        });
      }
    }
  }
  return [...drafts.values()];
}

async function discoverWashoeSchoolsArchive(seed: PublicMeetingSourceSeed): Promise<ArchiveMeetingDraft[]> {
  const years = Array.from(
    { length: new Date().getFullYear() - 2024 + 2 },
    (_, index) => 2024 + index,
  );
  const drafts = new Map<string, ArchiveMeetingDraft>();
  for (const year of years) {
    const url = `https://www.washoeschools.net/trustees/board-of-trustees/board-meeting-archive/${year}-board-archive`;
    let html = "";
    try {
      html = await fetchText(url);
    } catch {
      continue;
    }
    const rawPath = path.join(PUBLIC_MEETING_PATHS.rawRoot, "archive-indexes", `${seed.id}-${year}.html`);
    await mkdir(path.dirname(absolutePublicMeetingPath(rawPath)), { recursive: true });
    await writeFile(absolutePublicMeetingPath(rawPath), html, "utf8");
    const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
      .map((match) => {
        const href = absolutizeUrl(match[1].match(/\bhref=["']([^"']+)["']/i)?.[1], url);
        const label = cellText(match[2]);
        return href ? { href, label } : null;
      })
      .filter((link): link is { href: string; label: string } => Boolean(link))
      .filter((link) => /MeetingInformation\.aspx/i.test(link.href) && /\b\d{2}-\d{2}-20\d{2}\b/.test(link.label));
    for (const link of links) {
      const meetingDate = parseUsDate(link.label);
      if (!isMeetingDateInDiscoveryWindow(meetingDate)) continue;
      const meetingType = inferMeetingTypeFromTitle(link.label);
      const id = `meeting-${seed.id}-${meetingDate.slice(0, 10)}-${hashText(link.href).slice(0, 8)}`;
      drafts.set(id, {
        id,
        sourceId: seed.id,
        publicBodyName: seed.name,
        jurisdiction: seed.jurisdiction,
        level: seed.level,
        meetingDate,
        meetingType,
        title: `${seed.name} - ${meetingType}`,
        agendaUrl: link.href,
        minutesUrl: link.href,
        packetUrl: link.href,
        videoUrl: seed.videoArchiveUrl ?? null,
        sourceUrl: link.href,
        sourceUrls: [...new Set([link.href, seed.videoArchiveUrl].filter(Boolean) as string[])],
        sourceDocumentCount: 1,
        meetingSummary: `Washoe County School District Board meeting discovered from the official ${year} board calendar or archive.`,
      });
    }
  }
  return [...drafts.values()];
}

async function collectHistoricalArchiveMeetings(seeds: PublicMeetingSourceSeed[]): Promise<ArchiveDiscoveryResult> {
  const drafts: ArchiveMeetingDraft[] = [];
  const errors: PublicMeetingIngestionReport["errors"] = [];
  const providerReports: PublicMeetingProviderReport[] = [];
  for (const seed of seeds.filter((entry) => entry.active)) {
    try {
      let providerDrafts: ArchiveMeetingDraft[] = [];
      let notes: string | null = null;
      if (seed.id === "carson-city-board-of-supervisors") {
        providerDrafts = await discoverCarsonGranicusArchive(seed);
      } else if (seed.scraperType === "legistar") {
        providerDrafts = await discoverLegistarArchive(seed);
      } else if (seed.id === "nv-legislature") {
        providerDrafts = await discoverNevadaLegislatureArchive(seed);
      } else if (seed.id === "washoe-county-school-district") {
        providerDrafts = await discoverWashoeSchoolsArchive(seed);
      } else if (/primegov|boarddocs/i.test([seed.meetingIndexUrl, seed.agendaArchiveUrl, seed.sourceUrl].filter(Boolean).join(" "))) {
        notes = "Historical archive requires a JavaScript/API adapter; source registered but not parsed in this pass.";
      } else {
        providerDrafts = await discoverGenericHtmlArchive(seed);
      }
      drafts.push(...providerDrafts);
      providerReports.push(makeProviderReport(seed, providerDrafts, { supported: providerDrafts.length > 0, notes }));
    } catch (error) {
      errors.push({ document_id: seed.id, message: error instanceof Error ? error.message : String(error) });
      providerReports.push(makeProviderReport(seed, [], { supported: false, failures: 1, notes: error instanceof Error ? error.message : String(error) }));
    }
  }
  return { drafts: dedupeById(drafts), providerReports, errors };
}

function archiveDraftToMeeting(draft: ArchiveMeetingDraft): PublicMeetingRecord {
  const sourceUrls = [...new Set(draft.sourceUrls.filter(Boolean))];
  return {
    id: draft.id,
    public_body_id: archiveBodyId(draft.sourceId, draft.publicBodyName),
    meeting_date: draft.meetingDate,
    meeting_type: draft.meetingType,
    title: draft.title,
    agenda_url: draft.agendaUrl,
    minutes_url: draft.minutesUrl,
    packet_url: draft.packetUrl,
    video_url: draft.videoUrl,
    transcript_url: null,
    meeting_summary: draft.meetingSummary,
    key_actions: [],
    vote_results: [],
    source_document_count: draft.sourceDocumentCount,
    source_urls: sourceUrls,
    ingestion_status: draft.minutesUrl ? "needs_review" : "parsed",
    document_hashes: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function ensureOutputDirs() {
  await Promise.all([
    mkdir(absolutePublicMeetingPath(PUBLIC_MEETING_PATHS.importRoot), { recursive: true }),
    mkdir(absolutePublicMeetingPath(PUBLIC_MEETING_PATHS.uploadRoot), { recursive: true }),
    mkdir(absolutePublicMeetingPath(PUBLIC_MEETING_PATHS.rawRoot), { recursive: true }),
    mkdir(absolutePublicMeetingPath(PUBLIC_MEETING_PATHS.textRoot), { recursive: true }),
    mkdir(absolutePublicMeetingPath("data/generated"), { recursive: true }),
  ]);
}

function normalizeDocumentType(value: string | null | undefined, filePath?: string | null): PublicMeetingDocumentType {
  const normalized = normalizeWhitespace(value).toLowerCase().replace(/[\s-]+/g, "_");
  const allowed = new Set<PublicMeetingDocumentType>([
    "agenda",
    "minutes",
    "staff_report",
    "board_packet",
    "ordinance",
    "resolution",
    "consent_agenda",
    "public_comment",
    "transcript",
    "roll_call_vote",
    "attachment",
    "exhibit",
    "other",
  ]);
  if (allowed.has(normalized as PublicMeetingDocumentType)) return normalized as PublicMeetingDocumentType;
  const lower = `${filePath ?? ""} ${value ?? ""}`.toLowerCase();
  if (lower.includes("agenda")) return "agenda";
  if (lower.includes("minute")) return "minutes";
  if (lower.includes("staff")) return "staff_report";
  if (lower.includes("packet")) return "board_packet";
  if (lower.includes("ordinance")) return "ordinance";
  if (lower.includes("resolution")) return "resolution";
  if (lower.includes("comment")) return "public_comment";
  if (lower.includes("transcript")) return "transcript";
  if (lower.includes("vote")) return "roll_call_vote";
  return "other";
}

function normalizeManifestEntry(raw: Record<string, unknown>, fallbackId: string): PublicMeetingImportDocument {
  const stringValue = (key: string) => {
    const value = raw[key];
    return typeof value === "string" ? normalizeWhitespace(value) || null : value == null ? null : normalizeWhitespace(String(value)) || null;
  };
  const localFilePath = stringValue("local_file_path") ?? stringValue("localFilePath");
  return {
    id: stringValue("id") ?? stringValue("document_id") ?? fallbackId,
    source_id: stringValue("source_id") ?? stringValue("sourceId"),
    public_body_id: stringValue("public_body_id") ?? stringValue("publicBodyId"),
    public_body_name: stringValue("public_body_name") ?? stringValue("publicBodyName") ?? stringValue("body_name"),
    meeting_date: stringValue("meeting_date") ?? stringValue("meetingDate"),
    meeting_type: stringValue("meeting_type") ?? stringValue("meetingType"),
    title: stringValue("title"),
    document_type: normalizeDocumentType(stringValue("document_type") ?? stringValue("documentType"), localFilePath),
    local_file_path: localFilePath,
    source_url: safeUrl(stringValue("source_url") ?? stringValue("sourceUrl")),
    agenda_url: safeUrl(stringValue("agenda_url") ?? stringValue("agendaUrl")),
    minutes_url: safeUrl(stringValue("minutes_url") ?? stringValue("minutesUrl")),
    packet_url: safeUrl(stringValue("packet_url") ?? stringValue("packetUrl")),
    video_url: safeUrl(stringValue("video_url") ?? stringValue("videoUrl")),
    transcript_url: safeUrl(stringValue("transcript_url") ?? stringValue("transcriptUrl")),
    notes: stringValue("notes"),
  };
}

async function listFilesRecursive(relativeDir: string): Promise<string[]> {
  const root = absolutePublicMeetingPath(relativeDir);
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(relativePath)));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

async function collectManualDocuments(): Promise<PublicMeetingImportDocument[]> {
  const manifest = await readJsonFile<unknown>(PUBLIC_MEETING_PATHS.importManifest, []);
  const manifestEntries = Array.isArray(manifest) ? manifest : typeof manifest === "object" && manifest && "documents" in manifest ? (manifest as { documents?: unknown[] }).documents ?? [] : [];
  const normalizedManifestEntries = manifestEntries
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry, index) => normalizeManifestEntry(entry, `manifest-${index + 1}`));
  const manifestLocalPaths = new Set(normalizedManifestEntries.map((entry) => entry.local_file_path).filter(Boolean));
  const discoveredFiles = (await listFilesRecursive(PUBLIC_MEETING_PATHS.importRoot))
    .filter((file) => SUPPORTED_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .filter((file) => !MANIFEST_NAMES.has(path.basename(file).toLowerCase()))
    .filter((file) => !manifestLocalPaths.has(file));
  const discoveredEntries = discoveredFiles.map((file) => ({
    id: `file-${slugify(file)}-${hashText(file).slice(0, 8)}`,
    source_id: null,
    public_body_id: null,
    public_body_name: null,
    meeting_date: inferDateFromText(file),
    meeting_type: null,
    title: path.basename(file, path.extname(file)).replace(/[_-]+/g, " "),
    document_type: normalizeDocumentType(null, file),
    local_file_path: file,
    source_url: null,
    agenda_url: null,
    minutes_url: null,
    packet_url: null,
    video_url: null,
    transcript_url: null,
    notes: "Discovered from meeting-records import directory without manifest metadata.",
  }));
  return [...normalizedManifestEntries, ...discoveredEntries];
}

async function extractPdfText(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return normalizeTextLines(result.text ?? "");
}

async function extractDocumentText(document: PublicMeetingImportDocument, bodiesById: Map<string, PublicBodyRecord>, bodiesBySeedId: Map<string, PublicBodyRecord>): Promise<ExtractedDocument> {
  const body =
    (document.public_body_id ? bodiesById.get(document.public_body_id) : null) ??
    (document.source_id ? bodiesBySeedId.get(document.source_id) : null) ??
    null;
  if (!document.local_file_path) {
    return {
      importDocument: document,
      body,
      text: "",
      hash: null,
      cachedTextPath: null,
      rawPath: null,
      method: "manual_review",
      status: "needs_review",
      error: "Document has no local_file_path. Add a file or source crawler before parsing.",
    };
  }
  const absolutePath = absolutePublicMeetingPath(document.local_file_path);
  if (!existsSync(absolutePath)) {
    return {
      importDocument: document,
      body,
      text: "",
      hash: null,
      cachedTextPath: null,
      rawPath: null,
      method: "manual_review",
      status: "error",
      error: `Local file not found: ${document.local_file_path}`,
    };
  }
  const buffer = await readFile(absolutePath);
  const hash = hashBuffer(buffer);
  const extension = path.extname(document.local_file_path).toLowerCase();
  const rawPath = path.join(PUBLIC_MEETING_PATHS.rawRoot, `${hash}${extension || ".bin"}`);
  let text = "";
  let method: PublicMeetingExtractionMethod = "unsupported";
  try {
    if (extension === ".pdf") {
      text = await extractPdfText(buffer);
      method = text.length >= 120 ? "pdf_text" : "ocr_needed";
    } else if (extension === ".html" || extension === ".htm") {
      text = stripHtml(buffer.toString("utf8"));
      method = "html_text";
    } else if (extension === ".txt" || extension === ".text") {
      text = normalizeTextLines(buffer.toString("utf8"));
      method = "plain_text";
    }
  } catch (error) {
    return {
      importDocument: document,
      body,
      text: "",
      hash,
      cachedTextPath: null,
      rawPath,
      method: "manual_review",
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
  await copyFile(absolutePath, absolutePublicMeetingPath(rawPath)).catch(() => undefined);
  const cachedTextPath = text ? path.join(PUBLIC_MEETING_PATHS.textRoot, `${hash}.txt`) : null;
  if (cachedTextPath) await writeFile(absolutePublicMeetingPath(cachedTextPath), `${text}\n`, "utf8");
  return {
    importDocument: document,
    body,
    text,
    hash,
    cachedTextPath,
    rawPath,
    method,
    status: text ? "text_extracted" : method === "ocr_needed" ? "needs_review" : "error",
    error: text ? null : method === "ocr_needed" ? "PDF appears to need OCR before parsing." : "No extractable text found.",
  };
}

function inferDateFromText(value: string | null | undefined) {
  const text = String(value ?? "");
  const iso = text.match(/\b(20\d{2})[-_/](0?[1-9]|1[0-2])[-_/](0?[1-9]|[12]\d|3[01])\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const us = text.match(/\b(0?[1-9]|1[0-2])[-_/](0?[1-9]|[12]\d|3[01])[-_/](20\d{2})\b/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return null;
}

function buildMeeting(extracted: ExtractedDocument): PublicMeetingRecord {
  const document = extracted.importDocument;
  const bodyId = extracted.body?.id ?? document.public_body_id ?? "body-unmatched";
  const meetingDate = document.meeting_date ?? inferDateFromText(document.title) ?? inferDateFromText(document.local_file_path);
  const meetingType = document.meeting_type ?? (document.document_type === "minutes" ? "Regular meeting" : null);
  const sourceUrls = [
    document.source_url,
    document.agenda_url,
    document.minutes_url,
    document.packet_url,
    document.video_url,
    document.transcript_url,
  ].filter((url): url is string => Boolean(url));
  const title =
    document.title ??
    [extracted.body?.name ?? document.public_body_name ?? "Public meeting", meetingType, meetingDate].filter(Boolean).join(" - ");
  const id = `meeting-${slugify(`${bodyId}-${meetingDate ?? "undated"}-${meetingType ?? document.document_type}-${title}`)}-${hashText(`${bodyId}:${meetingDate}:${title}`).slice(0, 8)}`;
  return {
    id,
    public_body_id: bodyId,
    meeting_date: meetingDate,
    meeting_type: meetingType,
    title,
    agenda_url: document.agenda_url ?? (document.document_type === "agenda" ? document.source_url : null),
    minutes_url: document.minutes_url ?? (document.document_type === "minutes" ? document.source_url : null),
    packet_url: document.packet_url ?? (document.document_type === "board_packet" ? document.source_url : null),
    video_url: document.video_url,
    transcript_url: document.transcript_url ?? (document.document_type === "transcript" ? document.source_url : null),
    meeting_summary: extracted.text ? summarizeText(extracted.text, 900) : null,
    key_actions: [],
    vote_results: [],
    source_document_count: sourceUrls.length,
    source_urls: sourceUrls,
    ingestion_status: extracted.text ? "parsed" : extracted.status,
    document_hashes: extracted.hash ? [extracted.hash] : [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function looksLikeItemHeading(line: string) {
  const value = normalizeWhitespace(line);
  if (value.length < 8 || value.length > 260) return false;
  return (
    /^(?:item\s+)?(?:\d{1,3}[a-z]?|[A-Z])[\.)]\s+.{6,}/i.test(value) ||
    /^(?:agenda\s+item|public\s+hearing|ordinance|resolution|consent\s+agenda|new\s+business|old\s+business|action\s+item)\b/i.test(value)
  );
}

function parseItemNumber(title: string) {
  const match = title.match(/^(?:item\s+)?((?:\d{1,3}[a-z]?)|[A-Z])[\.)]\s+/i);
  return match?.[1] ?? null;
}

function splitMeetingItems(text: string, method: PublicMeetingExtractionMethod): ParsedItemDraft[] {
  const lines = normalizeTextLines(text).split("\n").filter(Boolean);
  const drafts: ParsedItemDraft[] = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    if (looksLikeItemHeading(line)) {
      if (current) {
        drafts.push({
          itemNumber: parseItemNumber(current.title),
          title: summarizeText(current.title, 180),
          sourceText: summarizeText([current.title, ...current.lines].join("\n"), 1800),
          confidence: method === "ocr_needed" ? 0.25 : 0.64,
        });
      }
      current = { title: normalizeWhitespace(line), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }

  if (current) {
    drafts.push({
      itemNumber: parseItemNumber(current.title),
      title: summarizeText(current.title, 180),
      sourceText: summarizeText([current.title, ...current.lines].join("\n"), 1800),
      confidence: method === "ocr_needed" ? 0.25 : 0.64,
    });
  }

  if (!drafts.length && normalizeWhitespace(text).length > 120) {
    drafts.push({
      itemNumber: null,
      title: "Document review needed",
      sourceText: summarizeText(text, 1800),
      confidence: method === "ocr_needed" ? 0.2 : 0.34,
    });
  }

  return drafts.slice(0, 120);
}

function inferItemType(text: string): MeetingItemType {
  const value = text.toLowerCase();
  if (/\bclosed session|executive session\b/.test(value)) return "closed_session";
  if (/\bpublic comment\b/.test(value)) return "public_comment";
  if (/\bconsent agenda|consent item\b/.test(value)) return "consent";
  if (/\bpublic hearing\b/.test(value)) return "public_hearing";
  if (/\bord(inance)?\b/.test(value)) return "ordinance";
  if (/\bresolution\b/.test(value)) return "resolution";
  if (/\bpresentation|proclamation|recognition\b/.test(value)) return "presentation";
  if (/\b(approve|adopt|authorize|award|accept|amend|contract|agreement|appoint|purchase|expenditure|not to exceed)\b/.test(value)) return "action";
  return "other";
}

function extractStaffRecommendation(text: string) {
  const match = text.match(/\b(?:staff\s+recommend(?:s|ation)?|recommendation)\s*[:\-]\s*([^.\n]+(?:\.[^.\n]+)?)/i);
  return match ? summarizeText(match[1], 360) : null;
}

function extractFiscalImpact(text: string) {
  const fiscal = text.match(/\b(?:fiscal|financial|budget)\s+impact\s*[:\-]\s*([^.\n]+(?:\.[^.\n]+)?)/i);
  if (fiscal) return summarizeText(fiscal[1], 360);
  const dollars = text.match(/(?:not\s+to\s+exceed|amount\s+of|contract\s+for|grant\s+of|expenditure\s+of)?\s*(\$[0-9][0-9,]*(?:\.\d{2})?)([^.\n]{0,160})/i);
  return dollars ? summarizeText(`${dollars[1]}${dollars[2] ?? ""}`, 360) : null;
}

function buildItems(meeting: PublicMeetingRecord, extracted: ExtractedDocument): PublicMeetingItemRecord[] {
  return splitMeetingItems(extracted.text, extracted.method).map((draft, index) => {
    const itemType = inferItemType(draft.sourceText);
    const id = `item-${meeting.id}-${draft.itemNumber ?? index + 1}-${hashText(draft.sourceText).slice(0, 10)}`;
    const translation = extractPlainLanguage(draft.title, draft.sourceText);
    return {
      id,
      meeting_id: meeting.id,
      item_number: draft.itemNumber,
      title: draft.title,
      description: summarizeText(draft.sourceText, 520),
      one_sentence_summary: translation.oneSentenceSummary,
      plain_english_explanation: translation.plainEnglishExplanation,
      why_it_matters: translation.whyItMatters,
      affected_groups: translation.affectedGroups,
      financial_impact: translation.financialImpact,
      vote_outcome: translation.voteOutcome,
      related_official_names: extractOfficialNames(draft.sourceText),
      related_organization_names: extractOrganizationNames(draft.sourceText),
      agenda_section: null,
      item_type: itemType,
      staff_recommendation: extractStaffRecommendation(draft.sourceText),
      fiscal_impact_summary: extractFiscalImpact(draft.sourceText),
      policy_area: inferPolicyArea(draft.sourceText),
      source_page: null,
      source_text: draft.sourceText,
      source_url: extracted.importDocument.source_url ?? meeting.source_urls[0] ?? null,
      source_document_hash: extracted.hash,
      cached_text_path: extracted.cachedTextPath,
      confidence_score: Number(draft.confidence.toFixed(2)),
    };
  });
}

function buildArchiveItems(meeting: PublicMeetingRecord, draft: ArchiveMeetingDraft): PublicMeetingItemRecord[] {
  const hints = draft.itemHints ?? [];
  if (!hints.length) return [];

  return hints.slice(0, 80).map((hint, index) => {
    const sourceText = hint.sourceText || hint.title;
    const itemType = inferItemType(sourceText);
    const translation = extractPlainLanguage(hint.title, sourceText);
    return {
      id: `item-${meeting.id}-${hint.itemNumber ?? index + 1}-${hashText(sourceText).slice(0, 10)}`,
      meeting_id: meeting.id,
      item_number: hint.itemNumber,
      title: hint.title,
      description: summarizeText(sourceText, 520),
      one_sentence_summary: translation.oneSentenceSummary,
      plain_english_explanation: translation.plainEnglishExplanation,
      why_it_matters: translation.whyItMatters,
      affected_groups: translation.affectedGroups,
      financial_impact: translation.financialImpact,
      vote_outcome: translation.voteOutcome,
      related_official_names: extractOfficialNames(sourceText),
      related_organization_names: extractOrganizationNames(sourceText),
      agenda_section: null,
      item_type: itemType,
      staff_recommendation: extractStaffRecommendation(sourceText),
      fiscal_impact_summary: extractFiscalImpact(sourceText),
      policy_area: inferPolicyArea(sourceText),
      source_page: null,
      source_text: sourceText,
      source_url: draft.agendaUrl ?? draft.minutesUrl ?? draft.sourceUrl,
      source_document_hash: null,
      cached_text_path: null,
      confidence_score: Number(hint.confidence.toFixed(2)),
    };
  });
}

function normalizeVoteChoice(value: string): VoteChoice {
  const normalized = value.toLowerCase();
  if (["yes", "yea", "aye", "ayes", "approved"].includes(normalized)) return "yes";
  if (["no", "nay", "nays"].includes(normalized)) return "no";
  if (normalized.startsWith("abstain")) return "abstain";
  if (normalized.startsWith("absent")) return "absent";
  if (normalized.startsWith("recus")) return "recused";
  return "unknown";
}

function extractMotion(text: string) {
  const motion = text.match(/\bmotion\s+(?:made\s+)?(?:by\s+[^.:\n]+)?(?:to|for)?\s*([^.\n]+)\./i);
  return motion ? summarizeText(motion[0], 360) : null;
}

function extractVoteResult(text: string) {
  const result = text.match(/\b(motion\s+(?:carried|passed|failed)|approved|adopted|denied|continued)\b[^.\n]*/i);
  return result ? summarizeText(result[0], 220) : null;
}

function buildVotesForItem(item: PublicMeetingItemRecord): VoteRecord[] {
  const lines = item.source_text.split(/\n|;/).map(normalizeWhitespace).filter(Boolean);
  const votes: VoteRecord[] = [];
  const votePattern = /^([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,4})\s*[:\-]\s*(yes|yea|aye|no|nay|abstain(?:ed)?|absent|recused|unknown)\b/i;
  for (const line of lines) {
    const match = line.match(votePattern);
    if (!match) continue;
    const officialName = normalizeWhitespace(match[1]);
    if (!officialName || /^(motion|vote|result|staff|public)$/i.test(officialName)) continue;
    votes.push({
      id: `vote-${item.id}-${slugify(officialName)}-${votes.length + 1}`,
      meeting_item_id: item.id,
      official_id: null,
      official_name: officialName,
      motion: extractMotion(item.source_text),
      vote: normalizeVoteChoice(match[2]),
      result: extractVoteResult(item.source_text),
      vote_text: line,
      confidence_score: 0.72,
      source_url: item.source_url,
      source_page: item.source_page,
    });
  }
  return votes;
}

function isQuestionEligible(item: PublicMeetingItemRecord) {
  if (item.confidence_score < 0.5) return false;
  if (["presentation", "public_comment", "closed_session", "other"].includes(item.item_type)) return false;
  if (item.item_type === "consent" && !/\b(separate|individual|pulled)\b/i.test(item.source_text)) return false;
  return /\b(approve|adopt|authorize|award|accept|amend|contract|agreement|appoint|purchase|expenditure|not to exceed|ordinance|resolution)\b/i.test(item.source_text);
}

function questionVerb(item: PublicMeetingItemRecord) {
  if (item.item_type === "ordinance") return "adopt";
  if (item.item_type === "resolution") return "approve";
  if (/\bauthoriz/.test(item.source_text.toLowerCase())) return "authorize";
  if (/\baward\b/.test(item.source_text.toLowerCase())) return "award";
  return "approve";
}

function buildCitizenQuestion(item: PublicMeetingItemRecord, meeting: PublicMeetingRecord, body: PublicBodyRecord | null): CitizenVoteQuestionRecord | null {
  if (!isQuestionEligible(item)) return null;
  const action = item.title.replace(/^(?:item\s+)?(?:\d{1,3}[a-z]?|[A-Z])[\.)]\s+/i, "").replace(/\?+$/g, "").trim();
  const questionText = `Would you ${questionVerb(item)} ${action.charAt(0).toLowerCase()}${action.slice(1)}?`;
  return {
    id: `question-${item.id}`,
    meeting_item_id: item.id,
    jurisdiction: body?.jurisdiction ?? "Unknown jurisdiction",
    question_text: summarizeText(questionText, 260),
    short_summary: summarizeText(action, 240),
    neutral_context: summarizeText(item.source_text, 700),
    fiscal_impact: item.fiscal_impact_summary,
    arguments_for: [],
    arguments_against: [],
    affected_groups: [],
    policy_area: item.policy_area,
    status: "draft",
    source_urls: [item.source_url, ...meeting.source_urls].filter((url, index, urls): url is string => Boolean(url) && urls.indexOf(url) === index),
    confidence_score: Number(Math.min(0.78, item.confidence_score).toFixed(2)),
  };
}

function buildBodies(seeds: PublicMeetingSourceSeed[]): PublicBodyRecord[] {
  const now = new Date().toISOString();
  return seeds.map((seed) => ({
    id: seedToBodyId(seed),
    name: seed.name,
    jurisdiction: seed.jurisdiction,
    level: seed.level,
    website: seed.website ?? null,
    source_url: seed.sourceUrl ?? seed.meetingIndexUrl ?? null,
    meeting_index_url: seed.meetingIndexUrl ?? null,
    scraper_type: seed.scraperType,
    active: seed.active,
    seed_source_id: seed.id,
    notes: seed.notes ?? null,
    created_at: now,
    updated_at: now,
  }));
}

function dedupeById<T extends { id: string }>(records: T[]) {
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

export async function runPublicMeetingImport(): Promise<PublicMeetingIngestionReport> {
  await ensureOutputDirs();
  await importPublicMeetingOfficialRosters();
  const seeds = await readJsonFile<PublicMeetingSourceSeed[]>(PUBLIC_MEETING_PATHS.seedSources, []);
  const archiveDiscovery = await collectHistoricalArchiveMeetings(seeds);
  const archiveBodies = dedupeById(archiveDiscovery.drafts.map((draft) => buildArchiveBody({
    id: draft.sourceId,
    name: draft.publicBodyName,
    jurisdiction: draft.jurisdiction,
    level: draft.level,
    website: null,
    sourceUrl: draft.sourceUrl,
    meetingIndexUrl: draft.sourceUrl,
    agendaArchiveUrl: draft.agendaUrl,
    minutesArchiveUrl: draft.minutesUrl,
    packetArchiveUrl: draft.packetUrl,
    videoArchiveUrl: draft.videoUrl,
    scraperType: "html",
    active: true,
    notes: null,
  }, draft.publicBodyName, new Date().toISOString())));
  const bodies = dedupeById([...buildBodies(seeds), ...archiveBodies]);
  const bodiesById = new Map(bodies.map((body) => [body.id, body]));
  const bodiesBySeedId = new Map(bodies.map((body) => [body.seed_source_id, body]));
  const manualDocuments = await collectManualDocuments();
  const extractedDocuments = await Promise.all(manualDocuments.map((document) => extractDocumentText(document, bodiesById, bodiesBySeedId)));
  const meetings: PublicMeetingRecord[] = [];
  const items: PublicMeetingItemRecord[] = [];
  const votes: VoteRecord[] = [];
  const officialActions: OfficialMeetingActionRecord[] = [];
  const questions: CitizenVoteQuestionRecord[] = [];
  const errors: PublicMeetingIngestionReport["errors"] = [...archiveDiscovery.errors];

  for (const extracted of extractedDocuments) {
    if (extracted.error) errors.push({ document_id: extracted.importDocument.id, message: extracted.error });
    if (!extracted.text) continue;
    const meeting = buildMeeting(extracted);
    meetings.push(meeting);
    const meetingItems = buildItems(meeting, extracted);
    for (const item of meetingItems) {
      item.vote_outcome = item.vote_outcome ?? extractTopicOutcome(item.source_text);
      if (itemHasUnnamedVoteOutcome(item) && item.roll_call_status !== "parsed") item.roll_call_status = "needs_roll_call_review";
    }
    items.push(...meetingItems);
    votes.push(...meetingItems.flatMap(buildVotesForItem));
    officialActions.push(...meetingItems.flatMap((item) => extractOfficialActionsForItem(item, { meeting, body: extracted.body })));
    for (const item of meetingItems) {
      const question = buildCitizenQuestion(item, meeting, extracted.body);
      if (question) questions.push(question);
    }
  }

  const archiveMeetings = archiveDiscovery.drafts.map(archiveDraftToMeeting);
  const archiveMeetingById = new Map(archiveMeetings.map((meeting) => [meeting.id, meeting]));
  const archiveItems = archiveDiscovery.drafts.flatMap((draft) => {
    const meeting = archiveMeetingById.get(draft.id);
    return meeting ? buildArchiveItems(meeting, draft) : [];
  });
  items.push(...archiveItems);
  for (const item of archiveItems) {
    item.vote_outcome = item.vote_outcome ?? extractTopicOutcome(item.source_text);
    if (itemHasUnnamedVoteOutcome(item) && item.roll_call_status !== "parsed") item.roll_call_status = "needs_roll_call_review";
  }
  votes.push(...archiveItems.flatMap(buildVotesForItem));
  officialActions.push(
    ...archiveItems.flatMap((item) => {
      const meeting = archiveMeetingById.get(item.meeting_id);
      const body = meeting ? bodiesById.get(meeting.public_body_id) ?? null : null;
      return meeting ? extractOfficialActionsForItem(item, { meeting, body }) : [];
    }),
  );
  for (const item of archiveItems) {
    const meeting = archiveMeetingById.get(item.meeting_id);
    const body = meeting ? bodiesById.get(meeting.public_body_id) ?? null : null;
    if (!meeting) continue;
    const question = buildCitizenQuestion(item, meeting, body);
    if (question) questions.push(question);
  }

  const dedupedMeetings = dedupeById([...meetings, ...archiveMeetings]);
  const dedupedItems = dedupeById(items);
  const dedupedVotes = dedupeById(votes);
  const officialMatchCandidates = await loadOfficialActionMatchCandidates();
  const dedupedOfficialActions = applyOfficialActionMatches(dedupeById(officialActions), {
    meetings: dedupedMeetings,
    bodies,
    candidates: officialMatchCandidates,
  });
  const dedupedMeetingVotingCards = buildMeetingVotingCards({
    meetings: dedupedMeetings,
    bodies,
    items: dedupedItems,
    officialActions: dedupedOfficialActions,
  });
  const dedupedQuestions = dedupeById(questions);

  await Promise.all([
    writeJsonFile(PUBLIC_MEETING_PATHS.bodies, bodies),
    writeJsonFile(PUBLIC_MEETING_PATHS.meetings, dedupedMeetings),
    writeJsonFile(PUBLIC_MEETING_PATHS.meetingItems, dedupedItems),
    writeJsonFile(PUBLIC_MEETING_PATHS.voteRecords, dedupedVotes),
    writeJsonFile(PUBLIC_MEETING_PATHS.officialActions, dedupedOfficialActions),
    writeJsonFile(PUBLIC_MEETING_PATHS.meetingVotingCards, dedupedMeetingVotingCards),
    writeJsonFile(PUBLIC_MEETING_PATHS.citizenQuestions, dedupedQuestions),
    writeJsonFile(PUBLIC_MEETING_PATHS.providerReport, archiveDiscovery.providerReports),
  ]);
  await writePublicMeetingRuntimeArtifacts({
    bodies,
    meetings: dedupedMeetings,
    votingCards: dedupedMeetingVotingCards,
    officialActions: dedupedOfficialActions,
  });
  await writePublicCivicCaseArtifacts({
    bodies,
    meetings: dedupedMeetings,
    items: dedupedItems,
    votingCards: dedupedMeetingVotingCards,
  });

  const report: PublicMeetingIngestionReport = {
    generated_at: new Date().toISOString(),
    seed_sources: seeds.length,
    public_bodies: bodies.length,
    manual_documents_found: manualDocuments.length,
    manual_documents_parsed: extractedDocuments.filter((document) => document.text).length,
    meetings: dedupedMeetings.length,
    meeting_items: dedupedItems.length,
    vote_records: dedupedVotes.length,
    official_actions: dedupedOfficialActions.length,
    meeting_voting_cards: dedupedMeetingVotingCards.length,
    citizen_vote_questions: dedupedQuestions.length,
    low_confidence_items: dedupedItems.filter((item) => item.confidence_score < 0.5).length,
    ocr_needed_documents: extractedDocuments.filter((document) => document.method === "ocr_needed").length,
    errors,
    provider_reports: archiveDiscovery.providerReports,
    output_files: PUBLIC_MEETING_OUTPUT_FILES,
  };
  await writeJsonFile(PUBLIC_MEETING_PATHS.ingestionReport, report);
  return report;
}
