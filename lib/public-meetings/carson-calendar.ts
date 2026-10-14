import { meetingTime, nevadaMeetingDate, sourceLinks, type NevadaAgencyMeeting } from "@/lib/public-meetings/nevada-agency-sources";
import { normalizeWhitespace, stripHtml } from "@/lib/public-meetings/shared";
import type { PublicMeetingSourceSeed } from "@/lib/public-meetings/types";

export const CARSON_PUBLIC_CALENDAR = "https://www.carsoncity.gov/government/city-meetings/calendar";
// This calendar also contains concerts, flu clinics and fairs. Only recognized
// civic bodies can create meeting records; a generic event is not a meeting.
const BODIES = [
  "Local Emergency Planning Committee", "Board of Supervisors", "Board of Supervisors and Board of Health",
  "Board of Supervisors and Redevelopment Authority", "9-1-1 Surcharge Advisory Committee", "Airport Authority",
  "Audit Committee", "Board of Appeals", "Board of Equalization", "Carson Area Metropolitan Planning Organization",
  "Carson City Culture & Tourism Authority", "Charter Review Committee", "Cultural Commission", "Debt Management Commission",
  "Historic Resources Commission", "Library Board of Trustees", "Open Space Advisory Committee", "Parks and Recreation Commission",
  "Planning Commission", "Redevelopment Authority Citizens Committee", "Regional Transportation Commission",
  "Utility Finance Oversight Committee", "Carson City Advisory Board to Manage Wildlife",
];
const clean = (value: string) => normalizeWhitespace(stripHtml(value).replace(/&amp;/g, "&").replace(/&#39;/g, "'"));
const bodyName = (title: string) => {
  const normalized = title.replace(/\*|\b(?:cancelled|canceled|rescheduled|postponed)\b/gi, "").replace(/\s+meeting\s*$/i, "").trim();
  return BODIES.find(body => body.toLowerCase() === normalized.toLowerCase())
    ?? (normalized === "Carson City Regional Transportation Commission" ? "Regional Transportation Commission" : null);
};

/** Dates come from each cell's explicit accessible date, not its month position. */
export function parseCarsonPublicCalendar(html: string, seed: PublicMeetingSourceSeed, indexUrl = CARSON_PUBLIC_CALENDAR): NevadaAgencyMeeting[] {
  if (!/class=["'][^"']*\bcalendar_day\b/i.test(html)) throw new Error("Carson public calendar markup unavailable; access or layout needs review");
  const records = new Map<string, NevadaAgencyMeeting>();
  for (const cell of html.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)) {
    const date = nevadaMeetingDate(cell[1].match(/aria-label=["']([^"']+)["']/i)?.[1] ?? "");
    if (!date) continue;
    for (const item of cell[2].matchAll(/<div\b[^>]*class=["'][^"']*\bcalendar_item\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)) {
      const link = sourceLinks(item[1], indexUrl).find(entry => /^https:\/\/www\.carsoncity\.gov\/Home\/Components\/Calendar\/Event\/\d+\/\d+(?:\?|$)/i.test(entry.href));
      if (!link) continue;
      const body = bodyName(clean(link.label));
      if (!body) continue;
      const eventId = new URL(link.href).pathname.match(/\/Event\/(\d+)\//i)![1];
      const sourceUrl = new URL(link.href); sourceUrl.search = ""; sourceUrl.hash = "";
      const time = item[1].match(/<span\b[^>]*class=["'][^"']*\bcalendar_eventtime\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "";
      const id = `meeting-${seed.id}-city-calendar-${eventId}`;
      records.set(id, {
        id, sourceId: seed.id, publicBodyName: body, jurisdiction: seed.jurisdiction, level: seed.level,
        ...meetingTime(date, time), title: clean(link.label), meetingType: "Public meeting", meetingCategory: "government",
        meetingStatus: /cancelled|canceled/i.test(link.label) ? "cancelled" : /rescheduled|postponed/i.test(link.label) ? "rescheduled" : "scheduled",
        agendaUrl: null, minutesUrl: null, packetUrl: null, videoUrl: null, location: null,
        sourceUrl: sourceUrl.toString(), sourceUrls: [sourceUrl.toString(), indexUrl], sourceDocumentCount: 0,
        meetingSummary: "Meeting date published on Carson City's official calendar. Agenda, location and participation details should be confirmed with the linked official notice; an agenda has not yet been matched to this calendar entry.",
      });
    }
  }
  return [...records.values()];
}

export async function discoverCarsonPublicCalendar(seed: PublicMeetingSourceSeed, fetchHtml: (url: string) => Promise<string>, now = new Date(), onWarning?: (message: string) => void) {
  const records = new Map<string, NevadaAgencyMeeting>();
  const visited = new Set<string>();
  let url: string | undefined = CARSON_PUBLIC_CALENDAR;
  let available = 0;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  // Follow only the official next-month links, with a three-page budget.
  while (url && visited.size < 3 && !visited.has(url)) {
    visited.add(url);
    try {
      const html = await fetchHtml(url);
      for (const record of parseCarsonPublicCalendar(html, seed, url)) {
        // Calendar-only historical imports would duplicate the separate archive.
        // Retained native calendar IDs remain stable when an occurrence moves.
        if (record.meetingDate.slice(0, 10) >= today) records.set(record.id, record);
      }
      available++;
      url = sourceLinks(html, url).find(link => /Next Month/i.test(link.label)
        && /^https:\/\/www\.carsoncity\.gov\/government\/city-meetings\/calendar\/-curm-\d{1,2}\/-cury-20\d{2}$/.test(link.href))?.href;
    } catch (error) {
      onWarning?.(`Carson public calendar ${url}: ${error instanceof Error ? error.message : String(error)}`);
      break;
    }
  }
  if (!available) throw new Error("Carson public calendar unavailable; future meeting coverage needs review");
  return [...records.values()];
}
