import type { PublicMeetingRecord } from "@/lib/public-meetings/types";

const DAY = 86_400_000;

/** Refreshes are observations, never deletion instructions. Missing rows retain their evidence. */
export function mergeMeetingHistory(previous: PublicMeetingRecord[], incoming: PublicMeetingRecord[]) {
  const records = new Map(previous.filter((meeting) => meeting.source_method !== "manual_fixture").map((meeting) => [meeting.id, meeting]));
  for (const meeting of incoming.filter((row) => row.source_method !== "manual_fixture")) {
    let old = records.get(meeting.id);
    // Alias IDs are supplied only by adapters with direct source-identity evidence.
    for (const aliasId of meeting.meeting_alias_ids ?? []) {
      if (aliasId === meeting.id) continue;
      const alias = records.get(aliasId);
      if (!alias) continue;
      old = old ? { ...alias, ...old,
        agenda_url: old.agenda_url ?? alias.agenda_url, minutes_url: old.minutes_url ?? alias.minutes_url,
        packet_url: old.packet_url ?? alias.packet_url, video_url: old.video_url ?? alias.video_url,
        source_urls: [...new Set([...alias.source_urls, ...old.source_urls])],
        source_local_paths: [...new Set([...(alias.source_local_paths ?? []), ...(old.source_local_paths ?? [])])],
        document_hashes: [...new Set([...alias.document_hashes, ...old.document_hashes])],
        source_document_count: Math.max(alias.source_document_count, old.source_document_count),
        meeting_alias_ids: [...new Set([...(alias.meeting_alias_ids ?? []), ...(old.meeting_alias_ids ?? [])])],
      } : { ...alias, id: meeting.id };
      records.delete(aliasId);
    }
    if (!old) { records.set(meeting.id, meeting); continue; }
    const merged = { ...old, ...meeting, created_at: old.created_at };
    for (const field of ["agenda_url", "minutes_url", "packet_url", "video_url", "transcript_url", "meeting_summary", "meeting_date", "meeting_type"] as const) {
      merged[field] = meeting[field]?.trim() ? meeting[field] : old[field];
    }
    merged.meeting_alias_ids = [...new Set([...(old.meeting_alias_ids ?? []), ...(meeting.meeting_alias_ids ?? [])])].filter((id) => id !== meeting.id);
    merged.source_identity_evidence = [...new Set([...(old.source_identity_evidence ?? []), ...(meeting.source_identity_evidence ?? [])])];
    merged.meeting_status = meeting.meeting_status ?? old.meeting_status;
    merged.meeting_category = meeting.meeting_category ?? old.meeting_category;
    merged.meeting_time_known = meeting.meeting_time_known ?? old.meeting_time_known;
    merged.location = meeting.location?.trim() ? meeting.location : old.location;
    merged.source_urls = [...new Set([...old.source_urls, ...meeting.source_urls])];
    merged.document_hashes = [...new Set([...old.document_hashes, ...meeting.document_hashes])];
    merged.source_local_paths = [...new Set([...(old.source_local_paths ?? []), ...(meeting.source_local_paths ?? [])])];
    merged.source_document_count = Math.max(old.source_document_count, meeting.source_document_count, merged.source_urls.length);
    if (!meeting.vote_results.length) merged.vote_results = old.vote_results;
    if (!meeting.key_actions.length) merged.key_actions = old.key_actions;
    // An unchanged observation must not present historical evidence as freshly updated.
    const comparable = (row: PublicMeetingRecord) => JSON.stringify(Object.fromEntries(Object.entries({ ...row, updated_at: undefined, source_local_paths: row.source_local_paths ?? [], meeting_alias_ids: row.meeting_alias_ids ?? [], source_identity_evidence: row.source_identity_evidence ?? [] }).sort(([left], [right]) => left.localeCompare(right))));
    if (comparable(merged) === comparable(old)) merged.updated_at = old.updated_at;
    records.set(meeting.id, merged);
  }
  return [...records.values()];
}

export function meetingLifecycle(meeting: Pick<PublicMeetingRecord, "meeting_date" | "title" | "minutes_url"> & { meeting_status?: string; meeting_category?: string }, now = new Date(), minutesExtracted = false) {
  const timestamp = Date.parse(meeting.meeting_date ?? "");
  const dateKnown = Number.isFinite(timestamp);
  const cancelled = meeting.meeting_status === "cancelled" || meeting.meeting_status !== "rescheduled" && /\b(cancelled|canceled|cancellation)\b/i.test(meeting.title.replace(/_/g, " "));
  const postponed = meeting.meeting_status !== "rescheduled" && /\bpostponed\b/i.test(meeting.title.replace(/_/g, " "));
  // Keep the full meeting day active when official end times are not available.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const meetingDay = /^\d{4}-\d{2}-\d{2}$/.test(meeting.meeting_date ?? "") ? meeting.meeting_date : dateKnown ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp)) : null;
  const phase = !dateKnown ? "date_unconfirmed" : cancelled || postponed || meetingDay! < today ? "archived" : "upcoming";
  const daysSinceMeeting = dateKnown ? Math.max(0, Math.floor((now.getTime() - timestamp) / DAY)) : null;
  const minutesExpected = meeting.meeting_category !== "parent_organization" && !postponed;
  const minutesStatus = cancelled ? "cancelled" : minutesExtracted ? "extracted" : meeting.minutes_url ? "published" : phase === "archived" && minutesExpected ? "awaiting_publication" : "not_due";
  const minutesOverdue = minutesStatus === "awaiting_publication" && (daysSinceMeeting ?? 0) >= 30;
  const nextAction = cancelled ? "none" : postponed ? "verify_rescheduled_date" : phase === "date_unconfirmed" ? "verify_meeting_date" : minutesStatus === "published" ? "retrieve_and_extract_minutes" : minutesStatus === "awaiting_publication" ? "check_official_minutes_archive" : phase === "upcoming" ? "refresh_calendar_and_agenda" : "periodic_archive_check";
  const checkCadenceHours = phase === "upcoming" ? 24 : minutesStatus === "awaiting_publication" ? (daysSinceMeeting! <= 45 ? 24 : daysSinceMeeting! <= 180 ? 168 : 720) : 720;
  return { phase, minutesStatus, minutesOverdue, daysSinceMeeting, nextAction, checkCadenceHours } as const;
}

export type DocumentRefreshState = {
  documentId: string;
  sourceId?: string;
  lastAttemptAt: string;
  lastSuccessAt: string | null;
  nextAttemptAt: string;
  consecutiveFailures: number;
  status: string;
};

export function documentRefreshIntervalMs(documentType: string, meetingDate: string | null, now: Date) {
  const date = Date.parse(meetingDate ?? "");
  const ageDays = Number.isFinite(date) ? (now.getTime() - date) / DAY : Infinity;
  if (ageDays < 2) return DAY;
  if (/minutes|result|vote|transcript/.test(documentType) && ageDays <= 90) return 7 * DAY;
  return 30 * DAY;
}

export function recordDocumentAttempt(input: { documentId: string; sourceId?: string; status: string; documentType: string; meetingDate: string | null; previous?: DocumentRefreshState; now: Date }): DocumentRefreshState {
  const succeeded = ["downloaded", "newly_cached", "cached", "unchanged", "updated_content"].includes(input.status);
  const failures = succeeded ? 0 : (input.previous?.consecutiveFailures ?? 0) + 1;
  const delay = succeeded ? documentRefreshIntervalMs(input.documentType, input.meetingDate, input.now)
    : input.status === "security_rejected" ? 30 * DAY
    : input.status === "unavailable" ? 7 * DAY
    : Math.min(7 * DAY, 6 * 3_600_000 * 2 ** Math.min(failures - 1, 6));
  return { documentId: input.documentId, sourceId: input.sourceId ?? input.previous?.sourceId, status: input.status, lastAttemptAt: input.now.toISOString(), lastSuccessAt: succeeded ? input.now.toISOString() : input.previous?.lastSuccessAt ?? null, consecutiveFailures: failures, nextAttemptAt: new Date(input.now.getTime() + delay).toISOString() };
}

export function documentRefreshDue(input: { state?: DocumentRefreshState; lastSuccessfulRetrievalAt?: string | null; documentType: string; meetingDate: string | null; now: Date; force?: boolean }) {
  if (input.force) return true;
  if (input.state) return Date.parse(input.state.nextAttemptAt) <= input.now.getTime();
  const last = Date.parse(input.lastSuccessfulRetrievalAt ?? "");
  return !Number.isFinite(last) || last + documentRefreshIntervalMs(input.documentType, input.meetingDate, input.now) <= input.now.getTime();
}

/** Round robin across sources; never let one large archive consume the entire daily budget. */
export function selectDocumentRefreshBatch<T extends { id: string; organizationId: string | null; sourceHost: string | null; documentType: string; meetingId: string; priorityBody: boolean }>(documents: T[], state: Map<string, DocumentRefreshState>, meetingDates: Map<string, string | null>, limit: number) {
  const sorted = [...documents].sort((left, right) => {
    const leftAttempt = Date.parse(state.get(left.id)?.lastAttemptAt ?? "") || 0;
    const rightAttempt = Date.parse(state.get(right.id)?.lastAttemptAt ?? "") || 0;
    return leftAttempt - rightAttempt
      || Number(/minutes|result|vote/.test(right.documentType)) - Number(/minutes|result|vote/.test(left.documentType))
      || (Date.parse(meetingDates.get(right.meetingId) ?? "") || 0) - (Date.parse(meetingDates.get(left.meetingId) ?? "") || 0)
      || Number(right.priorityBody) - Number(left.priorityBody)
      || left.id.localeCompare(right.id);
  });
  const groups = new Map<string, T[]>();
  for (const document of sorted) {
    const key = document.organizationId ?? document.sourceHost ?? document.id;
    const group = groups.get(key) ?? [];
    group.push(document);
    groups.set(key, group);
  }
  const sourceLastAttempt = new Map<string, number>();
  for (const row of state.values()) if (row.sourceId) sourceLastAttempt.set(row.sourceId, Math.max(sourceLastAttempt.get(row.sourceId) ?? 0, Date.parse(row.lastAttemptAt) || 0));
  const fairGroups = new Map([...groups].sort(([left], [right]) => (sourceLastAttempt.get(left) ?? 0) - (sourceLastAttempt.get(right) ?? 0)));
  const selected: T[] = [];
  while (selected.length < limit && fairGroups.size) {
    for (const [key, group] of fairGroups) {
      selected.push(group.shift()!);
      if (!group.length) fairGroups.delete(key);
      if (selected.length >= limit) break;
    }
  }
  return selected;
}
