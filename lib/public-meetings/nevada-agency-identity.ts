import { mergeMeetingHistory } from "@/lib/public-meetings/lifecycle";
import type { PublicMeetingRecord } from "@/lib/public-meetings/types";

const CCB = "body-nv-cannabis-public-meetings-nevada-cannabis-compliance-board";
const CLGF = "body-nv-taxation-public-meetings-nevada-committee-on-local-government-finance";
const supported = (meeting: PublicMeetingRecord) => /^body-nv-(?:cannabis|taxation)-public-meetings-/.test(meeting.public_body_id);

export function isNevadaAgencyMinutesObservation(meeting: PublicMeetingRecord) {
  return /^meeting-manual-nv-(?:cannabis|taxation)-public-meetings-/.test(meeting.id)
    && meeting.source_method === "manual_cache" && !!meeting.minutes_url && !meeting.agenda_url && !meeting.packet_url && !meeting.video_url
    && meeting.source_urls.every((url) => url === meeting.minutes_url);
}

/** Correct only attribution established by an exact document in the current official archive. */
export function reconcileNevadaAgencyMeetingHistory(previous: PublicMeetingRecord[], incoming: PublicMeetingRecord[]) {
  let refreshed = incoming.map((meeting) => {
    if (!supported(meeting)) return meeting;
    const retained = previous.filter((old) => supported(old) && old.meeting_alias_ids?.includes(meeting.id));
    if (retained.length === 1) return { ...meeting, id: retained[0].id, meeting_alias_ids: [...new Set([meeting.id, ...(meeting.meeting_alias_ids ?? [])])] };
    if (meeting.public_body_id.startsWith(`${CLGF}-`) && meeting.agenda_url) {
      // The old parent/day row may have combined two subcommittees. Keep its route for
      // the session identified by its primary agenda; the other session keeps its own ID.
      const matches = previous.filter((old) => old.public_body_id === CLGF && old.agenda_url === meeting.agenda_url);
      if (matches.length === 1) return { ...meeting, id: matches[0].id, meeting_alias_ids: [...new Set([meeting.id, ...(meeting.meeting_alias_ids ?? [])])] };
    }
    if (meeting.public_body_id === `${CCB}-regulation-workshops`) {
      const phantom = previous.filter((old) => old.public_body_id === CCB && !old.agenda_url && old.minutes_url
        && old.meeting_date?.slice(0, 10) === meeting.meeting_date?.slice(0, 10) && meeting.source_urls.includes(old.minutes_url));
      if (phantom.length === 1) return { ...meeting, meeting_alias_ids: [...new Set([phantom[0].id, ...(phantom[0].meeting_alias_ids ?? []), ...(meeting.meeting_alias_ids ?? [])])] };
    }
    return meeting;
  });
  const refreshedIds = new Set(refreshed.map((meeting) => meeting.id));
  const canonicalCandidates = [...refreshed.filter(supported), ...previous.filter((meeting) => supported(meeting) && !refreshedIds.has(meeting.id))];
  const observations = [...previous, ...incoming].filter(isNevadaAgencyMinutesObservation);
  const manualAliases = new Map<string, string[]>();
  for (const observation of observations) {
    const owners = canonicalCandidates.filter((candidate) => candidate.minutes_url === observation.minutes_url);
    if (owners.length !== 1) continue;
    const aliases = manualAliases.get(owners[0].id) ?? [];
    aliases.push(observation.id, ...(observation.meeting_alias_ids ?? [])); manualAliases.set(owners[0].id, aliases);
  }
  const aliasedObservations = new Set([...manualAliases.values()].flat());
  refreshed = refreshed.filter((meeting) => !aliasedObservations.has(meeting.id)).map((meeting) => manualAliases.has(meeting.id)
    ? { ...meeting, meeting_alias_ids: [...new Set([...(meeting.meeting_alias_ids ?? []), ...manualAliases.get(meeting.id)!])] } : meeting);
  for (const candidate of canonicalCandidates) if (!refreshedIds.has(candidate.id) && manualAliases.has(candidate.id)) {
    refreshed.push({ ...candidate, meeting_alias_ids: [...new Set([...(candidate.meeting_alias_ids ?? []), ...manualAliases.get(candidate.id)!])] });
  }
  const claims = new Map<string, Set<string>>();
  for (const meeting of refreshed.filter(supported)) for (const url of meeting.source_urls) {
    // Index pages, shared streams and references cannot establish document ownership.
    if (!/\.pdf(?:$|\?)/i.test(url)) continue;
    const owners = claims.get(url) ?? new Set<string>();
    owners.add(meeting.id); claims.set(url, owners);
  }
  const documentMeetingIds = new Map([...claims].filter(([, owners]) => owners.size === 1).map(([url, owners]) => [url, [...owners][0]]));
  const aliasIds = new Map(refreshed.flatMap((meeting) => (meeting.meeting_alias_ids ?? []).map((id) => [id, meeting.id] as const)));
  const historical = [...new Map([...previous, ...incoming.filter(isNevadaAgencyMinutesObservation)].map((meeting) => [meeting.id, meeting])).values()];
  const cleaned = historical.map((meeting) => {
    if (!supported(meeting) && !isNevadaAgencyMinutesObservation(meeting)) return meeting;
    const canonicalId = aliasIds.get(meeting.id) ?? meeting.id;
    const moved = (url: string | null) => !!url && documentMeetingIds.has(url) && documentMeetingIds.get(url) !== canonicalId;
    const relocated = meeting.source_urls.filter(moved);
    if (!relocated.length && ![meeting.agenda_url, meeting.minutes_url, meeting.packet_url].some(moved)) return meeting;
    return { ...meeting,
      agenda_url: moved(meeting.agenda_url) ? null : meeting.agenda_url,
      minutes_url: moved(meeting.minutes_url) ? null : meeting.minutes_url,
      packet_url: moved(meeting.packet_url) ? null : meeting.packet_url,
      source_urls: meeting.source_urls.filter((url) => !moved(url)),
      source_identity_evidence: [...new Set([...(meeting.source_identity_evidence ?? []), ...relocated])],
    };
  });
  return { meetings: mergeMeetingHistory(cleaned, refreshed), documentMeetingIds };
}
