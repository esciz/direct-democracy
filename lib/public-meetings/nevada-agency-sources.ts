import { createHash } from "node:crypto";

import { normalizeWhitespace, slugify, stripHtml } from "@/lib/public-meetings/shared";
import type { PublicMeetingSourceSeed } from "@/lib/public-meetings/types";

export type NevadaAgencyMeeting = {
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
  meetingStatus: "scheduled" | "cancelled" | "rescheduled";
  meetingTimeKnown: boolean;
  location: string | null;
  meetingCategory?: "government" | "parent_organization";
};

type SourceLink = { label: string; href: string };
type FetchHtml = (url: string) => Promise<string>;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_DATE = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?[\s_-]+(\d{1,2})(?:\s*[-–]\s*\d{1,2})?(?:,[\s_-]*|[\s_-]+)(20\d{2})\b/i;

function text(html: string) {
  return normalizeWhitespace(stripHtml(html).replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code))).replace(/&#x([a-f\d]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16))));
}

function safeHttpUrl(value: string, baseUrl: string) {
  try {
    const url = new URL(value.trim().replace(/&amp;/g, "&"), baseUrl);
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function sourceLinks(html: string, baseUrl: string): SourceLink[] {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].flatMap((match) => {
    const raw = match[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    const href = raw && !raw.startsWith("#") ? safeHttpUrl(raw, baseUrl) : null;
    return href ? [{ href, label: text(match[2]) }] : [];
  });
}

/** Read a document's own date, never its upload directory or "Date Posted". */
export function nevadaMeetingDate(value: string): string | null {
  const clean = text(value);
  const month = clean.match(MONTH_DATE);
  const iso = clean.match(/\b(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})\b/);
  const numeric = clean.match(/\b(\d{1,2})[.\/-](\d{1,2})(?:\s*[-–]\s*\d{1,2})?[.\/-](20\d{2}|\d{2})\b/);
  let year: number;
  let monthNumber: number;
  let day: number;
  if (month) {
    year = Number(month[3]); monthNumber = MONTHS.indexOf(month[1].slice(0, 3).toLowerCase()) + 1; day = Number(month[2]);
  } else if (iso) {
    year = Number(iso[1]); monthNumber = Number(iso[2]); day = Number(iso[3]);
  } else if (numeric) {
    year = Number(numeric[3]) + (numeric[3].length === 2 ? 2000 : 0); monthNumber = Number(numeric[1]); day = Number(numeric[2]);
  } else return null;
  const date = new Date(Date.UTC(year, monthNumber - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== monthNumber - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function meetingTime(date: string, sourceText: string) {
  const match = text(sourceText).match(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\b/i);
  if (!match) return { meetingDate: date, meetingTimeKnown: false };
  const hour = Number(match[1]); const minute = Number(match[2] ?? "00");
  if (hour < 1 || hour > 12 || minute > 59) return { meetingDate: date, meetingTimeKnown: false };
  const wallTime = `${date}T${String(hour % 12 + (match[3].toLowerCase() === "p" ? 12 : 0)).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  // Nevada source calendars use Pacific time; resolve daylight saving with Intl.
  const noon = new Date(`${date}T20:00:00Z`);
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "shortOffset" }).formatToParts(noon).find((part) => part.type === "timeZoneName")?.value;
  const offset = zone === "GMT-7" ? "-07:00" : "-08:00";
  return { meetingDate: new Date(`${wallTime}${offset}`).toISOString(), meetingTimeKnown: true };
}

function documentKind(link: SourceLink): "agendaUrl" | "minutesUrl" | "packetUrl" | "videoUrl" | null {
  const value = `${link.label} ${link.href.split("/").at(-1)}`;
  if (/\bminutes?\b/i.test(value)) return "minutesUrl";
  if (/\bpacket\b|support materials/i.test(value)) return "packetUrl";
  if (/\bagenda\b/i.test(value)) return "agendaUrl";
  if (/live\s*stream|video|recording|youtu(?:\.be|be\.com)/i.test(value)) return "videoUrl";
  return null;
}

function recordKey(bodyName: string, date: string) { return `${bodyName}:${date}`; }

function getMeeting(map: Map<string, NevadaAgencyMeeting>, seed: PublicMeetingSourceSeed, bodyName: string, date: string, indexUrl: string, occurrence?: string) {
  const key = recordKey(bodyName, date) + (occurrence ? `:${occurrence}` : "");
  let result = map.get(key);
  if (result) return result;
  const idKey = `${seed.id}:${key}`;
  result = {
    id: `meeting-${seed.id}-${date}-${createHash("sha256").update(idKey).digest("hex").slice(0, 12)}`,
    sourceId: seed.id, publicBodyName: bodyName, jurisdiction: seed.jurisdiction, level: seed.level,
    meetingDate: date, meetingType: "Public meeting", title: `${bodyName} — ${date}`,
    agendaUrl: null, minutesUrl: null, packetUrl: null, videoUrl: null,
    sourceUrl: indexUrl, sourceUrls: [indexUrl], sourceDocumentCount: 0,
    meetingSummary: "Meeting listed by its official public body. Consult the linked notice for attendance and public comment instructions.",
    meetingStatus: "scheduled", meetingTimeKnown: false, location: null,
  };
  map.set(key, result);
  return result;
}

function minutesDate(link: SourceLink) {
  const filename = decodeURIComponent(new URL(link.href).pathname.split("/").at(-1) ?? "");
  // Only a standalone suffix in a minutes filename is a compact date, never an upload path or document ID.
  const compact = /minutes/i.test(filename) ? filename.match(/(?:^|[-_])(\d{2})(\d{2})(20\d{2}|\d{2})(?=[-_\.]|$)/i) : null;
  return nevadaMeetingDate(link.label) ?? nevadaMeetingDate(filename)
    ?? (compact ? nevadaMeetingDate(`${compact[1]}.${compact[2]}.${compact[3]}`) : null);
}

function addLinks(map: Map<string, NevadaAgencyMeeting>, record: NevadaAgencyMeeting, links: SourceLink[], seed: PublicMeetingSourceSeed, indexUrl: string) {
  for (const link of links) {
    const kind = documentKind(link);
    let target = record;
    if (kind === "minutesUrl") {
      // Meeting packets routinely include approval of the PREVIOUS meeting's minutes.
      const ownDate = minutesDate(link);
      const ownBody = seed.id === "nv-cannabis-public-meetings" && /\bworkshop\b/i.test(`${link.label} ${link.href.split("/").at(-1)}`)
        ? "Nevada Cannabis Compliance Board — Regulation Workshops" : record.publicBodyName;
      if (ownDate && (ownDate !== record.meetingDate.slice(0, 10) || ownBody !== record.publicBodyName)) target = getMeeting(map, seed, ownBody, ownDate, indexUrl);
    }
    if (kind && (!target[kind] || /amended|revised|approved/i.test(link.label + link.href))) target[kind] = link.href;
    if (!target.sourceUrls.includes(link.href)) target.sourceUrls.push(link.href);
  }
}

function finalize(map: Map<string, NevadaAgencyMeeting>) {
  return [...map.values()].map((record) => ({
    ...record,
    sourceUrl: record.agendaUrl ?? record.minutesUrl ?? record.sourceUrl,
    sourceDocumentCount: record.sourceUrls.filter((url) => /\.pdf(?:$|\?)/i.test(url) || /drive\.google\.com\/uc\?export=download&id=/i.test(url)).length,
  })).sort((a, b) => b.meetingDate.localeCompare(a.meetingDate) || a.id.localeCompare(b.id));
}

function firstList(html: string) {
  const start = html.search(/<ul\b/i);
  if (start < 0) return "";
  let depth = 0;
  for (const token of html.slice(start).matchAll(/<\/?ul\b[^>]*>/gi)) {
    depth += /^<\//.test(token[0]) ? -1 : 1;
    if (depth === 0) return html.slice(start, start + token.index! + token[0].length);
  }
  return "";
}

/** Table rows preserve the commission/subcommittee identity and notices without agendas. */
export function parseCannabisMeetings(html: string, seed: PublicMeetingSourceSeed, indexUrl: string): NevadaAgencyMeeting[] {
  const map = new Map<string, NevadaAgencyMeeting>();
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]);
    if (cells.length < 4) continue;
    const date = nevadaMeetingDate(cells[0]);
    const kind = text(cells[1]);
    if (!date || !/meeting|commission|subcommittee|workshop|solicitation of input/i.test(kind)) continue;
    const bodyName = /subcommittee/i.test(kind) ? `Nevada Cannabis Advisory Commission — ${kind}`
      : /commission/i.test(kind) ? "Nevada Cannabis Advisory Commission"
        : /workshop/i.test(kind) ? "Nevada Cannabis Compliance Board — Regulation Workshops" : "Nevada Cannabis Compliance Board";
    const record = getMeeting(map, seed, bodyName, date, indexUrl);
    Object.assign(record, meetingTime(date, cells[0]));
    record.meetingType = kind;
    record.location = text(cells[3].replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, "")) || null;
    record.meetingStatus = /cancelled|canceled/i.test(cells[0]) ? "cancelled" : /rescheduled|postponed/i.test(cells[0]) ? "rescheduled" : "scheduled";
    if (record.meetingStatus !== "scheduled") record.meetingSummary = `${text(cells[0])}. Consult the official source for the replacement notice.`;
    addLinks(map, record, cells.slice(2).flatMap((cell) => sourceLinks(cell, indexUrl)), seed, indexUrl);
  }
  return finalize(map);
}

/** Each Taxation archive section belongs to its own board, never a generic department vote. */
export function parseTaxationMeetings(html: string, seed: PublicMeetingSourceSeed, indexUrl: string): NevadaAgencyMeeting[] {
  const map = new Map<string, NevadaAgencyMeeting>();
  const headings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)];
  for (let i = 0; i < headings.length; i += 1) {
    const bodyName = text(headings[i][1]).replace(/\s*\((?:NTC|SBE|MOAC|CLGF)\)$/, "");
    if (!/^(Nevada Tax Commission|State Board of Equalization|Mining Oversight and Accountability Commission|Committee on Local Government Finance|Appraiser Certification Board)$/.test(bodyName)) continue;
    const section = html.slice(headings[i].index! + headings[i][0].length, headings[i + 1]?.index ?? html.length);
    const groups = [...section.matchAll(/<p\b[^>]*>\s*<(?:strong|b)\b[^>]*>([^<]+)<\/(?:strong|b)>\s*<\/p>/gi)].filter((match) => nevadaMeetingDate(match[1]));
    for (let j = 0; j < groups.length; j += 1) {
      const date = nevadaMeetingDate(groups[j][1])!;
      const content = section.slice(groups[j].index! + groups[j][0].length, groups[j + 1]?.index ?? section.length);
      const links = sourceLinks(firstList(content), indexUrl);
      // Avoid considering undated lists of member bios or appeals guidance meetings.
      if (!links.some((link) => /agenda|minutes|packet/i.test(link.label))) continue;
      const agenda = links.find((link) => documentKind(link) === "agendaUrl");
      const identityText = `${groups[j][1]} ${agenda?.label ?? ""} ${agenda?.href.split("/").at(-1) ?? ""}`;
      const subcommittee = bodyName === "Committee on Local Government Finance" && /subcommittee/i.test(identityText);
      // These two notices name the jurisdiction inside the PDF, rather than in the archive label.
      // Exact official agenda URLs prevent extending that attribution to unrelated future sessions.
      const publishedAgendaBodies: Record<string, { name: string; time: string; location: string }> = {
        "https://tax.nv.gov/wp-content/uploads/2026/03/CLGF-SUBCOMMITTEE-Agenda-March-27-2026-1.pdf": { name: "Douglas County School District", time: "9:00 a.m.", location: "Nevada Department of Taxation, 9850 Double R Blvd., Suite 101, Reno, Nevada 89521" },
        "https://tax.nv.gov/wp-content/uploads/2025/03/20250404-CLGF-SUBCOMMITTEE-Agenda.pdf": { name: "Incline Village Improvement District", time: "9:30 a.m.", location: "Nevada Division of Public and Behavioral Health, 4150 Technology Way, Suite 303, Carson City, Nevada 89706" },
      };
      const publishedAgenda = publishedAgendaBodies[agenda?.href ?? ""];
      const subcommitteeName = subcommittee ? publishedAgenda?.name
        ?? (/\b(?:CCSD|Clark County School District)\b/i.test(identityText) ? "Clark County School District"
          : /\b(?:IVGID|Incline Village (?:General )?Improvement District)\b/i.test(identityText) ? "Incline Village Improvement District"
            : /\b(?:DCSD|Douglas County School District)\b/i.test(identityText) ? "Douglas County School District" : null) : null;
      const name = `Nevada ${bodyName.replace(/^Nevada /, "")}${subcommittee ? ` — ${subcommitteeName ? `${subcommitteeName} ` : ""}Subcommittee` : ""}`;
      const record = getMeeting(map, seed, name, date, indexUrl, subcommittee && !subcommitteeName ? agenda?.href : undefined);
      Object.assign(record, meetingTime(date, publishedAgenda?.time ?? groups[j][1]));
      if (publishedAgenda) record.location = publishedAgenda.location;
      record.meetingType = subcommittee ? "Subcommittee meeting" : links.some((link) => /workshop/i.test(link.label)) ? "Regulation workshop" : "Public meeting";
      addLinks(map, record, links, seed, indexUrl);
    }
  }
  return finalize(map);
}

/** Education uses date headings followed by a subcommittee heading and document links. */
export function parseEducationMeetings(html: string, seed: PublicMeetingSourceSeed, indexUrl: string): NevadaAgencyMeeting[] {
  const map = new Map<string, NevadaAgencyMeeting>();
  const clean = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const headings = [...clean.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)].filter((heading) => nevadaMeetingDate(heading[1]));
  for (let i = 0; i < headings.length; i += 1) {
    const date = nevadaMeetingDate(headings[i][1])!;
    const section = clean.slice(headings[i].index! + headings[i][0].length, headings[i + 1]?.index ?? clean.length);
    const kind = text(section.match(/^\s*<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? "State Board of Education Meeting");
    const bodyName = /subcommittee/i.test(kind) ? `Nevada State Board of Education — ${kind}` : "Nevada State Board of Education";
    const record = getMeeting(map, seed, bodyName, date, indexUrl);
    Object.assign(record, meetingTime(date, section.match(/(?:Workshop )?Time:\s*[^<\n]+/i)?.[0] ?? ""));
    record.meetingType = kind;
    record.meetingStatus = /cancelled|canceled/i.test(headings[i][1]) ? "cancelled" : /postponed|rescheduled/i.test(headings[i][1]) ? "rescheduled" : "scheduled";
    // Footer navigation is outside the meeting's first list; avoid treating it as evidence.
    const cutoff = section.search(/<h[12]\b|<h3\b[^>]*>\s*(?:Annual|Locations|Carson City|Las Vegas)/i);
    addLinks(map, record, sourceLinks(cutoff >= 0 ? section.slice(0, cutoff) : section, indexUrl), seed, indexUrl);
  }
  return finalize(map);
}

export function isNevadaAgencySource(seed: PublicMeetingSourceSeed) {
  return ["nv-cannabis-public-meetings", "nv-taxation-public-meetings", "nv-state-board-of-education", "carson-city-school-participation", "carson-city-school-district"].includes(seed.id);
}

export function parsePublicDriveFolder(html: string): Array<{ id: string; name: string; folder: boolean }> {
  // Public folder pages render file rows without authentication. No internal Drive API is used.
  return [...html.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)].flatMap((row) => {
    if (!/\bdata-selectable\b/.test(row[1])) return [];
    const id = row[1].match(/\bdata-id=["']([a-zA-Z\d_-]+)["']/)?.[1];
    const name = text(row[2].match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/i)?.[1] ?? "");
    if (!id || !name) return [];
    return [{ id, name, folder: /data-tooltip=["'][^"']*\bfolder["']/i.test(row[2]) }];
  });
}

export function parseCarsonSchoolBoardCalendar(html: string, seed: PublicMeetingSourceSeed, indexUrl: string): NevadaAgencyMeeting[] {
  const map = new Map<string, NevadaAgencyMeeting>();
  for (const article of html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)) {
    const title = text(article[1].match(/<div\b[^>]*class=["']fsTitle["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
    const start = article[1].match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*class=["']fsStartTime["']/i)?.[1];
    if (!/\bschool board meeting\b/i.test(title) || !start || !Number.isFinite(Date.parse(start)) || !/[+-]\d{2}:\d{2}$/.test(start)) continue;
    const record = getMeeting(map, seed, seed.name, start.slice(0, 10), indexUrl);
    record.meetingDate = new Date(start).toISOString();
    record.meetingTimeKnown = true;
    record.meetingCategory = "government";
    record.meetingType = "School board meeting";
    record.title = `${seed.name} — ${start.slice(0, 10)}`;
    record.location = text(article[1].match(/<div\b[^>]*class=["']fsLocation["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "") || null;
    record.meetingStatus = /cancelled|canceled/i.test(title) ? "cancelled" : /rescheduled|postponed/i.test(title) ? "rescheduled" : "scheduled";
  }
  return finalize(map);
}

async function discoverCarsonSchoolBoardMeetings(seed: PublicMeetingSourceSeed, fetchHtml: FetchHtml, now: Date, onWarning?: (warning: string) => void) {
  const indexUrl = seed.meetingIndexUrl!;
  const html = await fetchHtml(indexUrl);
  const map = new Map<string, NevadaAgencyMeeting>();
  for (const meeting of parseCarsonSchoolBoardCalendar(html, seed, indexUrl)) {
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(meeting.meetingDate));
    map.set(recordKey(seed.name, localDate), meeting);
  }
  const folders = sourceLinks(html, indexUrl).filter((link) => /^(View )?(Agendas|Minutes)$/i.test(link.label) && new URL(link.href).hostname === "drive.google.com" && /^\/drive\/folders\/[\w-]+$/.test(new URL(link.href).pathname));
  if (!folders.length) onWarning?.("District board page did not expose its public agenda/minutes folders. Calendar dates remain available; legacy BoardDocs is not parsed.");
  const documents: Array<{ id: string; name: string; kind: "agenda" | "minutes"; folderUrl: string }> = [];
  for (const folder of folders.slice(0, 2)) {
    try {
      const years = parsePublicDriveFolder(await fetchHtml(folder.href)).filter((row) => row.folder && /^20\d{2}$/.test(row.name) && Number(row.name) >= now.getFullYear() - 1 && Number(row.name) <= now.getFullYear() + 1);
      if (!years.length) throw new Error("public folder exposed no recent annual directories");
      for (const year of years.slice(0, 3)) {
        const folderUrl = `https://drive.google.com/drive/folders/${year.id}`;
        const entries = parsePublicDriveFolder(await fetchHtml(folderUrl));
        if (!entries.length) onWarning?.(`${folderUrl}: no publicly readable file rows; calendar dates retained.`);
        for (const entry of entries.filter((row) => !row.folder && /\.pdf$/i.test(row.name))) documents.push({ ...entry, kind: /minutes/i.test(folder.label) ? "minutes" : "agenda", folderUrl });
      }
    } catch (error) {
      onWarning?.(`${folder.label}: ${error instanceof Error ? error.message : String(error)}. Published calendar dates retained; document access needs review.`);
    }
  }
  // First create meetings only from explicit agendas/retreats/minutes; standalone attachments cannot create one.
  for (const document of documents) {
    const date = nevadaMeetingDate(document.name);
    if (!date || !/agenda|board retreat|meeting minutes/i.test(document.name)) continue;
    getMeeting(map, seed, seed.name, date, indexUrl);
  }
  for (const document of documents) {
    const date = nevadaMeetingDate(document.name);
    const record = date ? map.get(recordKey(seed.name, date)) : null;
    if (!record) continue;
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${document.id}`;
    const viewUrl = `https://drive.google.com/file/d/${document.id}/view`;
    if (document.kind === "minutes" && /minutes/i.test(document.name)) record.minutesUrl = downloadUrl;
    if (document.kind === "agenda" && /agenda|board retreat/i.test(document.name)) { record.agendaUrl = downloadUrl; record.packetUrl = downloadUrl; }
    if (/board retreat/i.test(document.name)) record.meetingType = "Board retreat";
    record.meetingCategory = "government";
    record.sourceUrls = [...new Set([...record.sourceUrls, document.folderUrl, downloadUrl, viewUrl])];
  }
  if (!map.size) throw new Error("Carson City school board source exposed no dated calendar entries or public agenda/minutes files; source layout needs review.");
  return finalize(map);
}

/** Public Finalsite school calendars supply occurrence IDs and real offset timestamps. */
export function parseSchoolParentMeetings(html: string, seed: PublicMeetingSourceSeed, indexUrl: string): NevadaAgencyMeeting[] {
  const map = new Map<string, NevadaAgencyMeeting>();
  const blocks = html.split(/<div\b[^>]*class=["']fsCalendarInfo["'][^>]*>/i).slice(1);
  for (const block of blocks) {
    const event = block.match(/<a\b[^>]*class=["'][^"']*fsCalendarEventTitle[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!event) continue;
    const title = text(event[1]);
    if (!/\b(?:PTA|PTO|PTSA|parent[- ]teacher|parent organization)\b/i.test(title) || !/meeting|council|committee/i.test(title)) continue;
    const occurrenceId = event[0].match(/data-occur-id=["']([^"']+)["']/i)?.[1];
    const start = block.match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*class=["']fsStartTime["']/i)?.[1];
    if (!occurrenceId || !start || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)$/.test(start) || !Number.isFinite(Date.parse(start))) continue;
    const school = text(block.match(/<span\b[^>]*class=["']fsStyleSROnly["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    if (!school || /district calendar/i.test(school)) continue;
    const group = title.match(/\b(?:PTA|PTO|PTSA)\b/i)?.[0].toUpperCase() ?? "Parent Organization";
    const record = getMeeting(map, seed, `${school} ${group}`, start.slice(0, 10), indexUrl, occurrenceId);
    // Occurrence ID persists if the date/time changes; avoid duplicating rescheduled events.
    record.id = `meeting-${seed.id}-${occurrenceId}`;
    record.meetingDate = new Date(start).toISOString();
    record.meetingTimeKnown = true;
    record.meetingCategory = "parent_organization";
    record.meetingType = "Parent organization meeting";
    record.title = `${school} — ${title}`;
    record.meetingSummary = "Parent organization meeting published on the school's official calendar. Contact the organizer for joining details or minutes if they are not publicly posted.";
    record.meetingStatus = /cancelled|canceled/i.test(title) ? "cancelled" : /rescheduled|postponed/i.test(title) ? "rescheduled" : "scheduled";
    const href = event[0].match(/href=["']([^"']+)["']/i)?.[1];
    if (href && !href.startsWith("#")) record.sourceUrl = safeHttpUrl(href, indexUrl);
  }
  return finalize(map);
}

export async function discoverNevadaAgencyMeetings(seed: PublicMeetingSourceSeed, fetchHtml: FetchHtml, now = new Date(), onWarning?: (warning: string) => void) {
  const index = seed.meetingIndexUrl;
  if (!index) throw new Error(`Missing official meeting index for ${seed.id}`);
  const requireArchiveRecords = (records: NevadaAgencyMeeting[]) => {
    if (!records.length) throw new Error(`${seed.name}: official archive exposed no recognizable meeting records; source layout needs review.`);
    return records;
  };
  if (seed.id === "nv-cannabis-public-meetings") return requireArchiveRecords(parseCannabisMeetings(await fetchHtml(index), seed, index));
  if (seed.id === "nv-taxation-public-meetings") return requireArchiveRecords(parseTaxationMeetings(await fetchHtml(index), seed, index));
  if (seed.id === "carson-city-school-district") return discoverCarsonSchoolBoardMeetings(seed, fetchHtml, now, onWarning);
  if (seed.id === "carson-city-school-participation") {
    const html = await fetchHtml(index);
    if (!/fsCalendar/i.test(html)) throw new Error("Official school calendar markup was not available; source layout needs review.");
    return parseSchoolParentMeetings(html, seed, index);
  }
  if (seed.id === "nv-state-board-of-education") {
    const html = await fetchHtml(index);
    const currentYear = now.getUTCFullYear();
    const years = new Set([currentYear - 1, currentYear, currentYear + 1]);
    const archives = sourceLinks(html, index).filter((link) => /\d{4}-state-board-of-education-meeting-materials\/?$/.test(new URL(link.href).pathname) && years.has(Number(link.href.match(/(20\d{2})-state-board/)?.[1])));
    const urls = [...new Set(archives.map((link) => link.href))];
    if (!urls.length) throw new Error("Education index exposed no recent annual meeting archives; source layout needs review.");
    const meetings: NevadaAgencyMeeting[] = [];
    // Fetch only published archive links; never synthesize a next-year route.
    for (const url of urls) meetings.push(...parseEducationMeetings(await fetchHtml(url), seed, url));
    return requireArchiveRecords([...new Map(meetings.map((meeting) => [meeting.id, meeting])).values()]);
  }
  throw new Error(`No Nevada agency adapter for ${seed.id}`);
}

export type NevadaMeetingSourceLead = {
  id: string;
  bodyName: string;
  sourceUrl: string | null;
  discoveredFrom: string;
  meetingDate: string | null;
  cancelled: boolean;
  status: "needs_source_review" | "contact_only";
  sourceKind: "official_notice" | "school_calendar" | "school_directory" | "parent_organization";
};

/** The statewide portal is a discovery net, not proof that a linked archive is ingested. */
export function parseNevadaPublicNoticeLeads(html: string, indexUrl = "https://notice.nv.gov/"): NevadaMeetingSourceLead[] {
  const blocks = html.split(/<div\b[^>]*class=["']subtoday-notice-item\b/gi).slice(1);
  const leads = blocks.flatMap((block) => {
    const dateText = block.match(/class=["']subtoday-notice-time-date["'][^>]*>([^<]+)/i)?.[1];
    const date = dateText ? nevadaMeetingDate(dateText) : null;
    const bodyHtml = block.match(/class=["']subtoday-notice-body["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
    if (!date || !bodyHtml) return [];
    const bodyName = text(bodyHtml);
    const link = sourceLinks(bodyHtml, indexUrl)[0];
    const key = `${bodyName}:${date}:${link?.href ?? "contact-only"}`;
    return [{
      id: `nv-meeting-source-lead-${createHash("sha256").update(key).digest("hex").slice(0, 20)}`,
      bodyName, sourceUrl: link?.href ?? null, discoveredFrom: indexUrl,
      meetingDate: meetingTime(date, block.match(/class=["']subtoday-notice-time-clock["'][^>]*>([^<]+)/i)?.[1] ?? "").meetingDate,
      cancelled: /^\s*is-cancelled\b/i.test(block),
      status: link ? "needs_source_review" as const : "contact_only" as const,
      sourceKind: "official_notice" as const,
    }];
  });
  return [...new Map(leads.map((lead) => [lead.id, lead])).values()];
}

export function parseSchoolParticipationLeads(html: string, indexUrl: string): NevadaMeetingSourceLead[] {
  const districtHost = new URL(indexUrl).hostname.replace(/^www\./, "");
  return sourceLinks(html, indexUrl).filter((link) => {
    const url = new URL(link.href);
    const schoolHomepage = url.hostname.endsWith(`.${districtHost}`) && url.hostname !== `www.${districtHost}` && url.pathname === "/";
    return schoolHomepage || /\b(?:PTA|PTO|PTSA|parent teacher|parent organization|school calendars?|schools?|school district|parent engagement)\b/i.test(`${link.label} ${url.pathname.replace(/[-_]/g, " ")}`);
  }).map((link) => ({
    id: `nv-school-source-lead-${slugify(new URL(indexUrl).hostname)}-${createHash("sha256").update(link.href).digest("hex").slice(0, 16)}`,
    bodyName: link.label || new URL(link.href).hostname,
    sourceUrl: link.href, discoveredFrom: indexUrl, meetingDate: null, cancelled: false,
    status: "needs_source_review", sourceKind: /pta|pto|ptsa|parent/i.test(`${link.label} ${link.href}`) ? "parent_organization" : /calendar/i.test(`${link.label} ${link.href}`) ? "school_calendar" : "school_directory",
  }));
}
