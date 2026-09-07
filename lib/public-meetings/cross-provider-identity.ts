import type { PublicMeetingRecord } from "@/lib/public-meetings/types";

const SCHOOL_BODY = "body-carson-city-school-district-carson-city-school-district-board-of-trustees";
const CITY_SCHOOL_BODY = "body-carson-city-board-of-supervisors-carson-city-school-board";
const LEGISLATIVE_BODIES = new Set([
  "body-manual-nv-legislature-nevada-legislature",
  "body-manual-nv-senate-nevada-senate",
  "body-manual-nv-assembly-nevada-assembly",
]);

function parseUrl(value: string | null | undefined) {
  try { return value ? new URL(value) : null; } catch { return null; }
}

function knownStart(meeting: PublicMeetingRecord) {
  if (meeting.meeting_time_known === false || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(meeting.meeting_date ?? "")) return null;
  const timestamp = Date.parse(meeting.meeting_date!);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

/** Remove display dates and punctuation, but never erase chamber or committee names. */
function meetingName(title: string) {
  return title.toLowerCase().replace(/\s+[-–—]\s+(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+.*|\d{4}-\d{2}-\d{2})$/i, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function legislativeIdentity(meeting: PublicMeetingRecord) {
  if (!LEGISLATIVE_BODIES.has(meeting.public_body_id) || meetingName(meeting.title) !== "economic forum") return null;
  const agenda = parseUrl(meeting.agenda_url);
  if (!agenda || !["www.leg.state.nv.us", "leg.state.nv.us"].includes(agenda.hostname.toLowerCase())
    || !/^\/App\/InterimCommittee\/REL\/Interim\d{4}\/Meeting\/\d+\/?$/i.test(agenda.pathname)) return null;
  // Only the exact official meeting resource establishes cross-chamber identity.
  return agenda.pathname.replace(/\/$/, "").toLowerCase();
}

function schoolProvider(meeting: PublicMeetingRecord): "district" | "city" | null {
  const name = meetingName(meeting.title);
  if (meeting.public_body_id === SCHOOL_BODY && name === "carson city school district board of trustees") {
    const hasOfficialBoard = meeting.source_urls.some((value) => {
      const url = parseUrl(value);
      return url?.hostname === "www.carsoncityschools.com" && url.pathname.replace(/\/$/, "") === "/our-district/school-board";
    });
    const agenda = parseUrl(meeting.agenda_url);
    const hasDistrictDocument = agenda?.hostname === "drive.google.com" && (agenda.searchParams.has("id") || /^\/file\/d\/[\w-]+/.test(agenda.pathname));
    return hasOfficialBoard && hasDistrictDocument ? "district" : null;
  }
  if (meeting.public_body_id === CITY_SCHOOL_BODY && /^(?:carson city school board)(?: regular meeting)?$/.test(name)) {
    const agenda = parseUrl(meeting.agenda_url);
    return agenda?.hostname === "carsoncity.granicus.com" && /^\/AgendaViewer\.php$/i.test(agenda.pathname)
      && /^\d+$/.test(agenda.searchParams.get("event_id") ?? "") ? "city" : null;
  }
  return null;
}

function mergeEvidence(canonical: PublicMeetingRecord, group: PublicMeetingRecord[], evidence: string): PublicMeetingRecord {
  const union = <T>(values: T[]) => [...new Set(values)];
  const merged = { ...canonical };
  for (const field of ["agenda_url", "minutes_url", "packet_url", "video_url", "transcript_url", "location"] as const) {
    merged[field] = canonical[field] || group.find((meeting) => meeting[field])?.[field] || null;
  }
  merged.meeting_alias_ids = union(group.flatMap((meeting) => [meeting.id, ...(meeting.meeting_alias_ids ?? [])])).filter((id) => id !== canonical.id).sort();
  merged.source_identity_evidence = union([...group.flatMap((meeting) => meeting.source_identity_evidence ?? []), evidence]);
  merged.source_urls = union(group.flatMap((meeting) => [...meeting.source_urls, meeting.agenda_url, meeting.minutes_url, meeting.packet_url, meeting.video_url, meeting.transcript_url].filter((url): url is string => !!url)));
  merged.source_local_paths = union(group.flatMap((meeting) => meeting.source_local_paths ?? []));
  merged.document_hashes = union(group.flatMap((meeting) => meeting.document_hashes));
  merged.key_actions = union(group.flatMap((meeting) => meeting.key_actions));
  merged.vote_results = [...new Map(group.flatMap((meeting) => meeting.vote_results).map((vote) => [JSON.stringify(vote), vote])).values()];
  merged.source_document_count = Math.max(...group.map((meeting) => meeting.source_document_count), merged.source_urls.length);
  merged.created_at = group.map((meeting) => meeting.created_at).sort()[0];
  merged.updated_at = group.map((meeting) => meeting.updated_at).sort().at(-1)!;
  return merged;
}

function schoolAmendmentIdentity(meeting: PublicMeetingRecord) {
  const id = meeting.id.match(/^meeting-((?:clark|washoe)-county-school-district)-diligent-(\d+)$/);
  if (!id || !meeting.public_body_id.startsWith(`body-${id[1]}-`) || !meeting.meeting_type || !meeting.location?.trim()) return null;
  const host = id[1] === "clark-county-school-district" ? "ccsd.community.diligentoneplatform.com" : "washoeschools.community.diligentoneplatform.com";
  const agenda = parseUrl(meeting.agenda_url);
  if (agenda?.hostname !== host || !/^\/document\/\d+(?:\/|$)/.test(agenda.pathname)) return null;
  const hasPublicMeeting = meeting.source_urls.some((value) => {
    const url = parseUrl(value);
    return url?.hostname === host && /^\/Portal\/MeetingInformation\.aspx$/i.test(url.pathname) && url.searchParams.get("Id") === id[2];
  });
  if (!hasPublicMeeting) return null;
  const amended = /\bamended\b/i.test(meeting.title);
  if (amended !== /\bamended\b/i.test(meeting.meeting_type)) return null;
  const originalName = (value: string) => meetingName(value.replace(/\bamended\b/ig, ""));
  return { provider: id[1], amended, title: originalName(meeting.title), type: originalName(meeting.meeting_type), location: meetingName(meeting.location) };
}

/** A publisher's explicit amendment supersedes its otherwise identical original posting. */
function reconcileSchoolAmendments(meetings: PublicMeetingRecord[]) {
  const groups = new Map<string, PublicMeetingRecord[]>();
  for (const meeting of meetings) {
    const identity = schoolAmendmentIdentity(meeting);
    const start = knownStart(meeting);
    if (!identity || !start) continue;
    const key = JSON.stringify([identity.provider, meeting.public_body_id, start, identity.title, identity.type, identity.location]);
    groups.set(key, [...(groups.get(key) ?? []), meeting]);
  }
  const replacements = new Map<string, PublicMeetingRecord>();
  const removed = new Set<string>();
  for (const group of groups.values()) {
    if (group.length !== 2 || group[0].id === group[1].id || new Set(group.map((meeting) => meeting.meeting_status ?? "scheduled")).size !== 1) continue;
    const amendments = group.filter((meeting) => schoolAmendmentIdentity(meeting)!.amended);
    if (amendments.length !== 1) continue;
    const canonical = amendments[0];
    const original = group.find((meeting) => meeting.id !== canonical.id)!;
    replacements.set(canonical.id, mergeEvidence(canonical, group,
      `The official school Diligent portal explicitly labels ${canonical.id} AMENDED. Its original posting ${original.id} has the same provider, governing body, exact published start ${knownStart(canonical)}, location and title/type after removing only AMENDED. Both postings and their documents remain retained as source evidence.`));
    removed.add(original.id);
  }
  return meetings.filter((meeting) => !removed.has(meeting.id)).map((meeting) => replacements.get(meeting.id) ?? meeting);
}

/**
 * Collapse only established official-source aliases, preserving every old ID and all evidence.
 * Carson's district board page names the city school board and links Carson.org recordings;
 * its Sep 8, 2026 district packet and Granicus event 2715 share the same agenda, date and 6 PM
 * start. This allowlisted body relationship does not apply to other boards or school committees.
 * School amendments require one explicit AMENDED/original pair with matching publisher,
 * body, start, location and title/type. Other ambiguous rows or conflicting statuses remain separate.
 */
export function reconcileCrossProviderMeetingIdentities(meetings: PublicMeetingRecord[]): PublicMeetingRecord[] {
  meetings = reconcileSchoolAmendments(meetings);
  const groups = new Map<string, PublicMeetingRecord[]>();
  for (const meeting of meetings) {
    const start = knownStart(meeting);
    if (!start) continue;
    const legislative = legislativeIdentity(meeting);
    const school = schoolProvider(meeting);
    const key = legislative ? `legislature|${legislative}|${start}` : school ? `carson-school|${start}` : null;
    if (key) groups.set(key, [...(groups.get(key) ?? []), meeting]);
  }
  const replacements = new Map<string, PublicMeetingRecord>();
  const removed = new Set<string>();
  for (const [key, group] of groups) {
    if (group.length < 2 || new Set(group.map((meeting) => meeting.public_body_id)).size !== group.length) continue;
    if (new Set(group.map((meeting) => meeting.meeting_status ?? "scheduled")).size > 1) continue;
    const school = key.startsWith("carson-school|");
    if (school && (group.length !== 2 || !group.some((meeting) => schoolProvider(meeting) === "district") || !group.some((meeting) => schoolProvider(meeting) === "city"))) continue;
    const canonical = [...group].sort((a, b) => {
      const preference = (meeting: PublicMeetingRecord) => school ? Number(meeting.public_body_id !== SCHOOL_BODY) : Number(meeting.public_body_id !== "body-manual-nv-legislature-nevada-legislature");
      return preference(a) - preference(b) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
    })[0];
    const evidence = school
      ? `The official Carson City School District board calendar and its city-hosted School Board agenda identify the same governing body and exact published start ${knownStart(canonical)}. District authority: https://www.carsoncityschools.com/our-district/school-board; city agenda: ${group.find((meeting) => schoolProvider(meeting) === "city")!.agenda_url}`
      : `Legislature, Senate and Assembly source labels point to the same Economic Forum official meeting resource ${canonical.agenda_url}, title and published start ${knownStart(canonical)}.`;
    replacements.set(canonical.id, mergeEvidence(canonical, group, evidence));
    for (const meeting of group) if (meeting.id !== canonical.id) removed.add(meeting.id);
  }
  return meetings.filter((meeting) => !removed.has(meeting.id)).map((meeting) => replacements.get(meeting.id) ?? meeting);
}

/** Pure migration helper for document/parse/OCR ledgers and nested provenance or item rows. */
export function remapMeetingReferences<T>(value: T, meetings: PublicMeetingRecord[]): T {
  const aliases = new Map(meetings.flatMap((meeting) => (meeting.meeting_alias_ids ?? []).map((alias) => [alias, meeting.id])));
  const scalarFields = new Set(["meetingId", "meeting_id", "meetingRecordId", "relatedMeetingId", "related_meeting_id"]);
  const arrayFields = new Set(["meetingIds", "meeting_ids", "relatedMeetingIds", "related_meeting_ids"]);
  const canonical = (id: string) => aliases.get(id) ?? id;
  const visit = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(visit);
    if (!input || typeof input !== "object") return input;
    return Object.fromEntries(Object.entries(input).map(([key, item]) => [key,
      scalarFields.has(key) && typeof item === "string" ? canonical(item)
        : arrayFields.has(key) && Array.isArray(item) ? [...new Set(item.map((entry: unknown) => typeof entry === "string" ? canonical(entry) : visit(entry)))]
          : visit(item),
    ]));
  };
  // IDs of documents, items, raw evidence, and meeting_alias_ids remain unchanged.
  return visit(value) as T;
}
