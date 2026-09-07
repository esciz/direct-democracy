import type { PublicBodyRecord, PublicMeetingRecord, PublicMeetingSourceSeed } from "../public-meetings/types";

function publicHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return /^(https?:)$/.test(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function calendarUrl(value: string | null | undefined) {
  const href = publicHttpUrl(value);
  if (!href) return null;
  const url = new URL(href);
  // A generated body can inherit an individual agenda or recording from an older
  // meeting. Such URLs are evidence for that meeting, never its body's calendar.
  if (/\.(?:pdf|docx?|xlsx?|mp4)(?:$|\/)/i.test(url.pathname) || /\/(?:Downloadfile|Document|GeneratedAgenda|GeneratedMinutes)\//i.test(url.pathname)) return null;
  if ([...url.searchParams.keys()].some((key) => /^(?:clip_id|meeting_?id|document_?id)$/i.test(key))) return null;
  return href;
}

export function officialBodyCalendarUrl(
  seed: Pick<PublicMeetingSourceSeed, "meetingIndexUrl" | "sourceUrl" | "website"> | null,
  body: Pick<PublicBodyRecord, "meeting_index_url"> | null,
) {
  // The reviewed registry defines a calendar. Imported body metadata may have
  // been generated from any individual meeting in that calendar's history.
  return [seed?.meetingIndexUrl, seed?.sourceUrl, body?.meeting_index_url, seed?.website]
    .map(calendarUrl).find(Boolean) ?? null;
}

export function officialMeetingSourceUrl(meeting: Pick<PublicMeetingRecord, "source_urls" | "agenda_url" | "minutes_url" | "packet_url" | "video_url">) {
  return [...meeting.source_urls, meeting.agenda_url, meeting.minutes_url, meeting.packet_url, meeting.video_url]
    .map(publicHttpUrl).find(Boolean) ?? null;
}
