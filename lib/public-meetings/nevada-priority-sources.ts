import { createHash } from "node:crypto";
import { nevadaMeetingDate, sourceLinks, type NevadaAgencyMeeting } from "./nevada-agency-sources";
import { normalizeWhitespace, stripHtml } from "./shared";
import type { PublicMeetingRecord, PublicMeetingSourceSeed } from "./types";

export type PriorityMeeting = NevadaAgencyMeeting & { aliasMeetingIds?: string[]; sourceIdentityEvidence?: string[] };
type FetchText = (url: string) => Promise<string>;
const clean = (value: string) => normalizeWhitespace(stripHtml(value).replace(/&nbsp;/gi, " ").replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(Number(c))));
const hash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 12);
const day = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
export function priorityMeetingTime(date: string, value: string) {
  const m = clean(value).match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])\.?m\.?/i);
  if (!m || +m[1] > 12 || +m[1] < 1 || +m[2] > 59) return { meetingDate: date, meetingTimeKnown: false };
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "shortOffset" }).formatToParts(new Date(`${date}T20:00:00Z`)).find((p) => p.type === "timeZoneName")?.value;
  return { meetingDate: new Date(`${date}T${String(+m[1] % 12 + (m[3].toLowerCase() === "p" ? 12 : 0)).padStart(2, "0")}:${m[2]}:00${zone === "GMT-7" ? "-07:00" : "-08:00"}`).toISOString(), meetingTimeKnown: true };
}
function record(seed: PublicMeetingSourceSeed, identity: string, title: string, date: string, source: string, body = seed.name): PriorityMeeting {
  return { id: `meeting-${seed.id}-${identity}`, sourceId: seed.id, publicBodyName: body, jurisdiction: seed.jurisdiction, level: seed.level,
    meetingDate: date, meetingType: title, title: title.startsWith(body) ? title : `${body} — ${title}`, agendaUrl: null, minutesUrl: null, packetUrl: null, videoUrl: null,
    sourceUrl: source, sourceUrls: [source], sourceDocumentCount: 0, meetingSummary: "Published on the official meeting calendar. Check the linked notice for final attendance and public comment instructions.",
    meetingStatus: /cancelled|canceled/i.test(title) ? "cancelled" : /rescheduled|postponed/i.test(title) ? "rescheduled" : "scheduled", meetingTimeKnown: false, location: null };
}
function finish(rows: PriorityMeeting[]) { return rows.map((r) => ({ ...r, sourceUrls: [...new Set([...r.sourceUrls, r.agendaUrl, r.minutesUrl, r.packetUrl, r.videoUrl].filter((u): u is string => Boolean(u)))], sourceDocumentCount: [r.agendaUrl, r.minutesUrl, r.packetUrl].filter(Boolean).length })); }
function schoolBody(seed: PublicMeetingSourceSeed, title: string) {
  let body = title.replace(/^[\s-]*(?:(?:agenda|amended|addendum|cancelled|canceled)[, :–-]*\s*)+/gi, "").replace(/,?\s+\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*$/i, "").replace(/\s+of Washoe County\b/i, "").replace(/,?\s+(?:Public Input\s+)?Meeting$/i, "").trim();
  if (/board|work session|oath of office/i.test(body) && !/committee|commission|alliance|panel/i.test(body)) return seed.name;
  body = body.replace(/\s+(?:regular meeting)$/i, "");
  return `${seed.jurisdiction.replace(/, NV$/, "")} — ${body}`;
}
function matchTitle(title: string) { return title.toLowerCase().replace(/amended|addendum|agenda|cancelled|canceled|regular|meeting|of|the|washoe county|board|trustees|school|district/g, " ").replace(/[^a-z]/g, ""); }

/** Finalsite's rendered public occurrence IDs contain exact UTC times, not recurrence guesses. */
export function parsePrioritySchoolCalendar(html: string, seed: PublicMeetingSourceSeed, url: string): PriorityMeeting[] {
  const records: PriorityMeeting[] = [];
  for (const m of html.matchAll(/<a\b([^>]*data-occur-id=["'][^"']+["'][^>]*)>([\s\S]*?)<\/a>/gi)) {
    const occurrence = m[1].match(/data-occur-id=["']([^"']+)/)?.[1];
    const title = clean(m[2]);
    const parts = occurrence?.split("_");
    if (!parts || parts.length < 3 || !Number.isFinite(Date.parse(parts[1])) || !/meeting|committee|commission|board|council/i.test(title)) continue;
    const localContext = html.slice(m.index!, Math.min(html.indexOf('class="fsCalendarDate"', m.index! + m[0].length) > 0 ? html.indexOf('class="fsCalendarDate"', m.index! + m[0].length) : html.length, m.index! + 2300));
    const r = record(seed, `finalsite-${parts[0]}-${day(parts[1])}`, title, parts[1], url, schoolBody(seed, title));
    r.meetingTimeKnown = true;
    r.location = clean(localContext.match(/<div class="fsLocation">([\s\S]*?)<\/div>/)?.[1] ?? "") || null;
    r.meetingSummary = "Dated meeting listed on the district calendar. The district considers meeting arrangements tentative until its agenda is posted.";
    records.push(r);
  }
  return finish([...new Map(records.map((r) => [r.id, r])).values()]);
}

type DiligentListing = { id: string; title: string; date: string; url: string };
export function parseDiligentListing(html: string, base: string): DiligentListing[] {
  const rows: DiligentListing[] = [];
  for (const m of html.matchAll(/<button\b[^>]*onclick=["'][^"']*meetingClick\(this,\s*(\d+)[^>]*>([\s\S]*?)<\/button>/gi)) {
    const date = nevadaMeetingDate(clean(m[2])); const title = clean(m[2].match(/class="meeting-list-item-button-name"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? "");
    if (date && title) rows.push({ id: m[1], title, date, url: new URL(`/Portal/MeetingInformation.aspx?Id=${m[1]}`, base).toString() });
  }
  for (const link of sourceLinks(html, base)) {
    if (!/MeetingInformation\.aspx/i.test(link.href)) continue;
    const id = new URL(link.href).searchParams.get("Id"); const date = nevadaMeetingDate(link.label);
    if (id && date) rows.push({ id, title: link.label.replace(/\s*-\s*[A-Z][a-z]{2}\s+\d{1,2}\s+20\d{2}.*$/, ""), date, url: link.href });
  }
  return [...new Map(rows.map((r) => [r.id, r])).values()];
}

type DiligentDocument = { Id: number; MeetingId: number; DocumentType: number; Format: string; Type: number; Name: string; PublicReleaseDelayDateString?: string };
export function attachDiligentDocuments(r: PriorityMeeting, payload: { Documents?: DiligentDocument[] }, id: number, base: string) {
  // These are the explicitly published OPEN document types in the vendor's public viewer.
  // Closed-session types and drafts are never selected. The API's IsPublic field is false
  // for its rendered outputs even when the public viewer exposes them. Prefer the
  // viewer's accessible HTML: some school minutes PDFs include hundreds of MB of
  // attachments, while their HTML contains the same published minutes directly.
  const rank = new Map([[4, 1], [1, 2], [10, 1], [9, 2], [53, 3], [55, 4]]);
  for (const doc of [...(payload.Documents ?? [])].sort((a, b) => (rank.get(a.DocumentType) ?? 0) - (rank.get(b.DocumentType) ?? 0))) {
    if (doc.MeetingId !== id || !rank.has(doc.DocumentType)) continue;
    const html = [1, 9, 55].includes(doc.DocumentType);
    if (html ? !["docx", "html"].includes(doc.Format) : doc.Format !== "pdf") continue;
    if (doc.PublicReleaseDelayDateString && Date.parse(doc.PublicReleaseDelayDateString) > Date.now()) continue;
    const url = new URL(html ? `/document/${doc.Id}` : `/document/${doc.Id}/${encodeURIComponent(`${doc.Name} - ${doc.Type === 2 ? "Minutes" : "Agenda"}.pdf`)}`, base).toString();
    if (doc.Type === 1 && [1, 4].includes(doc.DocumentType)) r.agendaUrl = url;
    if (doc.Type === 2 && [9, 10, 53, 55].includes(doc.DocumentType)) r.minutesUrl = url;
  }
}
async function schoolMeetings(seed: PublicMeetingSourceSeed, fetchText: FetchText, now: Date, warn: (message: string) => void) {
  const calendar = seed.id.startsWith("clark") ? "https://www.ccsd.net/about/school-board" : seed.meetingIndexUrl!;
  const html = await fetchText(calendar);
  const calendars = parsePrioritySchoolCalendar(html, seed, calendar);
  const host = seed.id.startsWith("clark") ? "https://ccsd.community.diligentoneplatform.com" : "https://washoeschools.community.diligentoneplatform.com";
  const listingUrl = `${host}/Portal/MeetingInformation.aspx`;
  let list: DiligentListing[] = [];
  try { list = parseDiligentListing(await fetchText(listingUrl), listingUrl); } catch (e) { warn(`Meeting archive listing failed: ${String(e)}`); }
  const earliest = `${now.getUTCFullYear() - 1}-01-01`;
  const listings = list.filter((r) => r.date >= earliest).sort((a, b) => b.date.localeCompare(a.date));
  const result: PriorityMeeting[] = [];
  const recentCutoff = now.getTime() - 120 * 86400000;
  const recent = listings.filter((r) => Date.parse(r.date) >= recentCutoff).slice(0, 80);
  const historical = listings.filter((r) => Date.parse(r.date) < recentCutoff);
  const rotation = historical.length ? (Math.floor(now.getTime() / 86400000) * 12) % historical.length : 0;
  const backfill = Array.from({ length: Math.min(12, historical.length) }, (_, i) => historical[(rotation + i) % historical.length]);
  const detailIds = new Set([...recent, ...backfill].map((r) => r.id));
  for (const listing of listings) {
    const r = record(seed, `diligent-${listing.id}`, listing.title, listing.date, listing.url, schoolBody(seed, listing.title));
    const matches = calendars.filter((c) => day(c.meetingDate) === listing.date && c.publicBodyName === r.publicBodyName && matchTitle(c.meetingType ?? "") === matchTitle(listing.title));
    const sameCalendarListings = listings.filter((other) => other.date === listing.date && schoolBody(seed, other.title) === r.publicBodyName && matchTitle(other.title) === matchTitle(listing.title));
    const amended = sameCalendarListings.filter((other) => /^AMENDED\b/i.test(other.title));
    const ownsCalendarAlias = sameCalendarListings.length === 1 || (amended.length === 1 && amended[0].id === listing.id);
    if (matches.length === 1 && ownsCalendarAlias) { const c = matches[0]; Object.assign(r, { meetingDate: c.meetingDate, meetingTimeKnown: c.meetingTimeKnown, location: c.location, aliasMeetingIds: [c.id], sourceIdentityEvidence: [`Official district calendar and public portal agree on body, meeting type and local day ${listing.date}.`], sourceUrls: [...r.sourceUrls, ...c.sourceUrls] }); }
    // Recent notices plus a deterministic daily rotating historical batch keep late
    // minutes discoverable without refetching the complete archive every six hours.
    if (detailIds.has(listing.id)) {
      try {
        const data = JSON.parse(await fetchText(`${host}/Services/MeetingsService.svc/meetings/${listing.id}/meetingData`));
        if (data.Id !== +listing.id || nevadaMeetingDate(data.Name ?? "") !== listing.date) throw new Error("Meeting detail identity/date differs from its public listing");
        Object.assign(r, priorityMeetingTime(listing.date, data.Time ?? "")); r.location = data.Location || r.location;
        attachDiligentDocuments(r, JSON.parse(await fetchText(`${host}/Services/MeetingsService.svc/meetings/${listing.id}/meetingDocuments`)), +listing.id, host);
      } catch (e) { warn(`${seed.id} meeting ${listing.id}: ${String(e)}`); }
    }
    if (r.aliasMeetingIds?.length && matches[0] && Date.parse(r.meetingDate) !== Date.parse(matches[0].meetingDate)) {
      r.aliasMeetingIds = []; r.sourceIdentityEvidence = [];
    }
    result.push(r);
  }
  const aliases = new Set(result.flatMap((r) => r.aliasMeetingIds ?? []));
  return finish([...result, ...calendars.filter((c) => !aliases.has(c.id))]);
}

/** Numeric dates and scheduled rows without a public detail link are legitimate calendar records. */
export function parseLegistarCalendar(html: string, seed: PublicMeetingSourceSeed, url: string): PriorityMeeting[] {
  const rows: PriorityMeeting[] = [];
  for (const m of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => c[1]);
    if (cells.length < 5) continue;
    const links = sourceLinks(m[1], url);
    const ical = links.find((l) => /View\.ashx\?M=IC&/i.test(l.href));
    const detail = links.find((l) => /MeetingDetail\.aspx/i.test(l.href));
    const identity = new URL(ical?.href ?? detail?.href ?? url).searchParams.get("ID");
    const date = nevadaMeetingDate(clean(cells[1])); const body = clean(cells[0]);
    if (!identity || !date || !body) continue;
    const r = record(seed, `legistar-${identity}`, body, date, detail?.href ?? url, body);
    Object.assign(r, priorityMeetingTime(date, cells[3])); r.location = clean(cells[4]) || null;
    if (/cancelled|canceled/i.test(clean(m[1]))) r.meetingStatus = "cancelled";
    for (const l of links) {
      if (/View\.ashx\?M=A&/i.test(l.href)) r.agendaUrl = l.href;
      if (/View\.ashx\?M=M&/i.test(l.href)) r.minutesUrl = l.href;
      if (/View\.ashx\?M=AADA&/i.test(l.href)) r.packetUrl = l.href;
      if (/video|media/i.test(l.label) && !/not available/i.test(l.label)) r.videoUrl = l.href;
    }
    if (ical) r.sourceUrls.push(ical.href);
    rows.push(r);
  }
  return finish(rows);
}

export function parseOnBaseMeetings(html: string, seed: PublicMeetingSourceSeed, url: string): PriorityMeeting[] {
  const rows: PriorityMeeting[] = [];
  for (const m of html.matchAll(/<tr\b[^>]*data-meeting-id="(\d+)"[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...m[2].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => clean(c[1]));
    const date = nevadaMeetingDate(cells[2] ?? ""); if (!date || !cells[0] || !cells[1] || /^pre[- ]?checks?\b|\btest meeting\b/i.test(cells[0])) continue;
    const r = record(seed, `onbase-${m[1]}`, cells[0], date, `${url.replace(/\/$/, "")}/#meeting-${m[1]}-row`, cells[1]);
    Object.assign(r, priorityMeetingTime(date, cells[2]));
    for (const link of sourceLinks(m[2], url)) {
      const fileName = decodeURIComponent(new URL(link.href).pathname);
      // OnBase's public download page redirects to this byte route in its own JS.
      // Keep agenda packets separate from the shorter agenda document.
      const documentUrl = link.href.replace(/\/Documents\/DownloadFile\//i, "/Documents/DownloadFileBytes/");
      if (/DownloadFile/i.test(link.href) && /_Agenda_(?!Packet_)/i.test(fileName)) r.agendaUrl = documentUrl;
      else if (/^agenda$/i.test(link.label) && !r.agendaUrl) r.agendaUrl = documentUrl;
      else if (/agenda packet/i.test(link.label) || /_Agenda_Packet_/i.test(fileName)) r.packetUrl = documentUrl;
      else if (/DownloadFile/i.test(link.href) && /_Minutes_(?!Packet_)/i.test(fileName)) r.minutesUrl = documentUrl;
      else if (/^minutes$/i.test(link.label) && !r.minutesUrl) r.minutesUrl = documentUrl;
      else if (/Minutes_Packet_/i.test(fileName) && !r.minutesUrl) r.minutesUrl = documentUrl;
      else if (/media|video/i.test(link.label)) r.videoUrl = link.href;
    }
    if (seed.id === "sparks-city-council") {
      // Sparks' published PDF byte routes currently return its NotFound page. Its
      // public meeting viewer exposes the same agenda/minutes as accessible HTML.
      const root = url.replace(/\/$/, "");
      if (r.agendaUrl) { r.sourceUrls.push(r.agendaUrl); r.agendaUrl = `${root}/Documents/ViewAgenda?meetingId=${m[1]}&type=HTML&doctype=1`; }
      if (r.minutesUrl) { r.sourceUrls.push(r.minutesUrl); r.minutesUrl = `${root}/Documents/ViewAgenda?meetingId=${m[1]}&type=HTML&doctype=2`; }
    }
    rows.push(r);
  }
  return finish(rows);
}

function nsheBody(title: string) { return /board of regents/i.test(title) ? "Nevada System of Higher Education Board of Regents" : `NSHE — ${title.replace(/\s+Meeting$/i, "")}`; }
export function parseNsheMeetings(html: string, seed: PublicMeetingSourceSeed, url: string): PriorityMeeting[] {
  const map = new Map<string, PriorityMeeting>();
  const add = (title: string, date: string, source: string, location?: string) => { const body = nsheBody(title); const key = `${date}:${body}:${/quarterly/i.test(title) ? "quarterly" : /board of regents/i.test(title) ? "special" : "committee"}`; const r = map.get(key) ?? record(seed, `${date}-${hash(key)}`, title, date, source, body); r.location = location ?? r.location; map.set(key, r); return r; };
  for (const m of html.matchAll(/<div class="title-block">([\s\S]*?)<\/div>\s*<\/div>/gi)) {
    const title = clean(m[1].match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? ""); const date = nevadaMeetingDate(m[1]);
    if (title && date) { const r = add(title, date, url, clean(m[1].match(/class="meeting-location">([\s\S]*?)<\/div>/)?.[1] ?? "") || undefined); r.meetingSummary = `Official published schedule: ${clean(m[1])}. Meeting times and individual session notices remain subject to the posted agenda.`; }
  }
  for (const yearBlock of html.split(/<div id="archive-(20\d{2})"/).slice(1).reduce<Array<{year: string; html: string}>>((out, value, i, values) => { if (i % 2 === 0) out.push({ year: value, html: values[i + 1] }); return out; }, [])) {
    if (+yearBlock.year < 2024) continue;
    for (const m of yearBlock.html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => c[1]); if (cells.length < 4) continue;
      const date = nevadaMeetingDate(`${clean(cells[0])}, ${yearBlock.year}`); const title = clean(cells[1]); if (!date || !title) continue;
      const r = add(title, date, url);
      r.agendaUrl = sourceLinks(cells[2], url).find((l) => /^agenda/i.test(l.label))?.href ?? null;
      r.minutesUrl = sourceLinks(cells[3], url).find((l) => /minutes/i.test(l.label))?.href ?? null;
      r.videoUrl = sourceLinks(cells[4] ?? "", url).find((l) => /video/i.test(l.label))?.href ?? null;
    }
  }
  return finish([...map.values()]);
}

export function isNevadaPrioritySource(seed: PublicMeetingSourceSeed) { return ["clark-county-school-district", "washoe-county-school-district", "clark-county-commission", "washoe-county-commission", "sparks-city-council", "nshe-board-of-regents", "elko-city-council", "henderson-city-council", "reno-city-council", "elko-county-commission", "eureka-county-commission"].includes(seed.id); }
export async function discoverNevadaPriorityMeetings(seed: PublicMeetingSourceSeed, fetchText: FetchText, now = new Date(), warn = (_message: string) => {}): Promise<PriorityMeeting[]> {
  if (/^(clark|washoe)-county-school-district$/.test(seed.id)) return schoolMeetings(seed, fetchText, now, warn);
  if (seed.scraperType === "legistar") { const url = new URL("Calendar.aspx", seed.meetingIndexUrl!).toString(); return parseLegistarCalendar(await fetchText(url), seed, url); }
  const onbaseUrls: Record<string, string> = { "sparks-city-council": "https://agendas.cityofsparks.us/OnBaseAgendaOnline/", "elko-city-council": "https://ob.elkocitynv.gov/onbaseagendaonline/", "henderson-city-council": "https://henderson.hylandcloud.com/231agendaonline/" };
  if (onbaseUrls[seed.id]) { const url = onbaseUrls[seed.id]; return parseOnBaseMeetings(await fetchText(url), seed, url); }
  if (seed.id === "reno-city-council") { const url = "https://reno.primegov.com/public/portal"; const upcoming = JSON.parse(await fetchText("https://reno.primegov.com/api/v2/PublicPortal/ListUpcomingMeetings")); const archive = JSON.parse(await fetchText(`https://reno.primegov.com/api/v2/PublicPortal/ListArchivedMeetings?year=${now.getFullYear()}`)); const committees = JSON.parse(await fetchText("https://reno.primegov.com/api/committee/GetCommitteeesListByShowInPublicPortal")); const names = new Map<number, string>(committees.map((c: {id: number; name: string}) => [c.id, clean(c.name)])); return [...new Map(parsePrimeGovMeetings([...archive, ...upcoming], seed, url, names).map((r) => [r.id, r])).values()]; }
  if (seed.id === "elko-county-commission") { const url = "https://elkocounty.granicus.com/ViewPublisher.php?view_id=5"; return parsePriorityGranicus(await fetchText(url), seed, url); }
  if (seed.id === "eureka-county-commission") { const map = new Map<string, PriorityMeeting>(); for (const url of [seed.meetingIndexUrl!, seed.minutesArchiveUrl!].filter(Boolean)) for (const r of parseEurekaDocuments(await fetchText(url), seed, url)) { const old = map.get(r.id); map.set(r.id, old ? { ...old, ...r, agendaUrl: r.agendaUrl ?? old.agendaUrl, packetUrl: r.packetUrl ?? old.packetUrl, minutesUrl: r.minutesUrl ?? old.minutesUrl, sourceUrls: [...old.sourceUrls, ...r.sourceUrls] } : r); } return finish([...map.values()]); }
  if (seed.id === "nshe-board-of-regents") {
    const calendar = "https://nshe.nevada.edu/regents/upcoming-meetings/"; const archive = "https://nshe.nevada.edu/regents/archive/";
    const calendars = parseNsheMeetings(await fetchText(calendar), seed, calendar); const archives = parseNsheMeetings(await fetchText(archive), seed, archive);
    const map = new Map(calendars.map((r) => [r.id, r])); for (const r of archives) { const old = map.get(r.id); map.set(r.id, old ? { ...old, ...r, location: old.location, sourceUrls: [...old.sourceUrls, ...r.sourceUrls] } : r); } return finish([...map.values()]);
  }
  return [];
}

/** Provider identity from public URLs survives URL parameter order and calendar time corrections. */
export function reconcilePriorityMeetingIdentities(incoming: PriorityMeeting[], previous: PublicMeetingRecord[]): PriorityMeeting[] {
  function identity(url: string) {
    try {
      const u = new URL(url); const params = new Map([...u.searchParams].map(([k,v]) => [k.toLowerCase(), v]));
      if (/MeetingInformation\.aspx|MeetingDetail\.aspx|Meetings\/ViewMeeting/i.test(u.pathname) && params.get("id")) return `${u.hostname}:meeting:${params.get("id")}`;
      if (/primegov\.com$/.test(u.hostname) && params.get("meetingtemplateid")) return `${u.hostname}:template:${params.get("meetingtemplateid")}`;
      return null;
    } catch { return null; }
  }
  for (const row of incoming) {
    const keys = new Set(row.sourceUrls.map(identity).filter(Boolean));
    const matches = previous.filter((old) => (old.id.startsWith(`meeting-${row.sourceId}-`) || old.id.startsWith(`meeting-manual-${row.sourceId}-`)) && old.id !== row.id && old.source_urls.some((u) => keys.has(identity(u)) && identity(u)));
    for (const old of matches) { row.aliasMeetingIds = [...new Set([...(row.aliasMeetingIds ?? []), old.id])]; row.sourceIdentityEvidence = [...new Set([...(row.sourceIdentityEvidence ?? []), "Official provider meeting ID and host match the retained historical record; calendar time corrections preserve its alias."])]; }
  }
  return incoming;
}


type PrimeGovMeeting = { id: number; committeeId?: number; title: string; date: string; time: string; location?: string; videoUrl?: string; documentList: Array<{ id: number; meetingId: number; templateId: number; templateName: string; compileOutputType: number; publishStatus: number; link?: string | null }> };
export function parsePrimeGovMeetings(data: PrimeGovMeeting[], seed: PublicMeetingSourceSeed, url: string, committeeNames = new Map<number, string>()): PriorityMeeting[] {
  if (!Array.isArray(data)) throw new Error("PrimeGov public calendar response is not a meeting list");
  return finish(data.flatMap((m) => {
    const date = nevadaMeetingDate(m.date ?? ""); if (!date || !m.id || !m.title) return [];
    const rawBody = committeeNames.get(m.committeeId ?? -1) ?? m.title.replace(/^(?:CANCELLED|CANCELED)[: -]*/i, "").replace(/\s+(?:Regular\s+|Special\s+)?Meeting(?: Agenda)?$/i, ""); const body = rawBody === "City Council" ? "Reno City Council" : rawBody; const r = record(seed, `primegov-${m.id}`, m.title, date, url, body);
    Object.assign(r, priorityMeetingTime(date, m.time ?? "")); r.location = m.location || null; r.videoUrl = m.videoUrl || null;
    for (const d of m.documentList ?? []) {
      if (d.meetingId !== m.id || d.publishStatus !== 1 || d.compileOutputType !== 1) continue;
      const param = d.templateId > 0 ? `meetingTemplateId=${d.templateId}` : `compiledMeetingDocumentFileId=${d.id}`;
      const link = d.link || new URL(`/Public/CompiledDocument?${param}&compileOutputType=1`, url).toString();
      if (/^agenda$/i.test(d.templateName)) r.agendaUrl = link;
      else if (/packet/i.test(d.templateName)) r.packetUrl = link;
      else if (/minutes/i.test(d.templateName)) r.minutesUrl = link;
    }
    r.sourceUrl = r.agendaUrl ?? url; return [r];
  }));
}

export function parseEurekaDocuments(html: string, seed: PublicMeetingSourceSeed, url: string): PriorityMeeting[] {
  const map = new Map<string, PriorityMeeting>();
  for (const link of sourceLinks(html, url)) {
    const name = decodeURIComponent(new URL(link.href).pathname.split("/").at(-1) ?? "");
    if (!/\.pdf$/i.test(name) || !/agenda|minutes/i.test(name)) continue;
    const date = nevadaMeetingDate(name) ?? nevadaMeetingDate(link.label);
    if (!date || date < "2024-01-01") continue;
    // A separate district's agenda on the commission archive is not a commission meeting.
    const body = /dggid/i.test(name) ? "Diamond Valley General Improvement District" : /liquor[- ]board/i.test(name) ? "Eureka County Liquor Board" : /(?:^|[-_])rtc(?:[-_]|$)/i.test(name) ? "Eureka County Regional Transportation Commission" : /tv[- ]district/i.test(name) ? "Eureka County TV District" : seed.name;
    const id = `${date}-${hash(body)}`; const r = map.get(id) ?? record(seed, id, `${body} — ${date}`, date, url, body);
    if (/minutes/i.test(name)) r.minutesUrl = link.href;
    else { r.agendaUrl = link.href; if (/backup/i.test(name)) r.packetUrl = link.href; }
    map.set(id, r);
  }
  return finish([...map.values()]);
}

export function parsePriorityGranicus(html: string, seed: PublicMeetingSourceSeed, url: string): PriorityMeeting[] {
  const rows: PriorityMeeting[] = [];
  for (const m of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => c[1]); if (cells.length < 2) continue;
    const archiveBody = m[1].match(/headers="Date ([^"]+)"/)?.[1]?.replace(/-/g, " ");
    const body = archiveBody ?? clean(cells[0]); const dateCell = archiveBody ? cells[0] : cells[1]; const date = nevadaMeetingDate(clean(dateCell)); if (!body || !date || date < "2024-01-01") continue;
    const links = sourceLinks(m[1], url); const agenda = links.find((l) => /^agenda$/i.test(l.label)); const video = links.find((l) => /video/i.test(l.label));
    const identityUrl = agenda?.href ?? video?.href ?? url;
    const u = new URL(identityUrl); const event = u.searchParams.get("event_id") ?? m[1].match(/data-event-id="(\d+)"/)?.[1]; const clip = u.searchParams.get("clip_id"); if (!event && !clip) continue;
    const r = record(seed, `granicus-${event ? "event" : "clip"}-${event ?? clip}`, body, date, identityUrl, body);
    Object.assign(r, priorityMeetingTime(date, dateCell)); r.agendaUrl = agenda?.href ?? null;
    const embeddedVideo = m[1].match(/window\.open\(['"]([^'"]*MediaPlayer\.php[^'"]+)/)?.[1];
    r.videoUrl = video?.href ?? (embeddedVideo ? new URL(embeddedVideo, url).toString() : null);
    r.minutesUrl = links.find((l) => /minutes/i.test(l.label))?.href ?? null;
    rows.push(r);
  }
  return finish([...new Map(rows.map((r) => [r.id, r])).values()]);
}

export function removeMisclassifiedSchoolPortalDocuments(meeting: PublicMeetingRecord): PublicMeetingRecord {
  if (!meeting.id.startsWith("meeting-washoe-county-school-district-")) return meeting;
  // Earlier code labeled one generic portal URL as three separate documents. Retain
  // that URL as source attribution, while removing only these known false labels.
  const result = { ...meeting };
  for (const field of ["agenda_url", "minutes_url", "packet_url"] as const) if (/MeetingInformation\.aspx/i.test(result[field] ?? "")) result[field] = null;
  return result;
}
