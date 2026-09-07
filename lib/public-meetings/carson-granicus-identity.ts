import { slugify } from "@/lib/public-meetings/shared";
import type { PublicMeetingRecord } from "@/lib/public-meetings/types";

type CarsonMeetingDraft = {
  id: string;
  sourceId: string;
  publicBodyName: string;
  meetingDate: string;
  agendaUrl: string | null;
  minutesUrl: string | null;
  packetUrl: string | null;
  videoUrl: string | null;
  sourceUrls: string[];
  aliasMeetingIds?: string[];
  sourceIdentityEvidence?: string[];
};

type HistoricMeeting = PublicMeetingRecord & { meeting_alias_ids?: string[]; source_identity_evidence?: string[] };

function granicusIdentity(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "carsoncity.granicus.com") return null;
    const eventId = parsed.searchParams.get("event_id");
    const clipId = parsed.searchParams.get("clip_id") ?? parsed.pathname.match(/^\/player\/clip\/(\d+)\/?$/)?.[1];
    if (eventId && /^\d+$/.test(eventId)) return `event:${eventId}`;
    if (clipId && /^\d+$/.test(clipId)) return `clip:${clipId}`;
  } catch { /* Invalid source URLs cannot establish identity. */ }
  return null;
}

function identities(urls: Array<string | null | undefined>) {
  return new Set(urls.flatMap((url) => url && granicusIdentity(url) ? [granicusIdentity(url)!] : []));
}

function meetingDay(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

/** An actual redirect to a specific published agenda proves event→recording identity. */
export async function resolveCarsonAgendaArtifact(url: string): Promise<string | null> {
  const parsed = new URL(url);
  if (parsed.hostname !== "carsoncity.granicus.com" || parsed.pathname.toLowerCase() !== "/agendaviewer.php" || !granicusIdentity(url)) return null;
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { accept: "text/html,application/pdf" } });
  await response.body?.cancel();
  if (!response.ok || !response.redirected) return null;
  const target = new URL(response.url);
  // A homepage, login page, error page, or generic viewer is never an alias proof.
  if (target.hostname !== "granicus_production_attachments.s3.amazonaws.com" || !/^\/carsoncity\/[a-f\d]{32,64}\.(?:html|pdf)$/i.test(target.pathname)) return null;
  return `${target.origin}${target.pathname}`;
}

/** No name/date-only merging: exact source IDs or verified agenda-artifact equality only. */
export async function reconcileCarsonGranicusIdentities<T extends CarsonMeetingDraft>(drafts: T[], previous: HistoricMeeting[], options: {
  resolveAgendaArtifact?: (url: string) => Promise<string | null>;
  maxBridgeChecks?: number;
  onAmbiguity?: (message: string) => void;
} = {}): Promise<Array<T & Pick<CarsonMeetingDraft, "aliasMeetingIds" | "sourceIdentityEvidence">>> {
  const resolver = options.resolveAgendaArtifact ?? resolveCarsonAgendaArtifact;
  const maxChecks = options.maxBridgeChecks ?? 12;
  const resolved = new Map<string, Promise<string | null>>();
  const resolve = (url: string) => {
    if (!resolved.has(url)) resolved.set(url, resolver(url).catch(() => null));
    return resolved.get(url)!;
  };
  const previousByBody = new Map<string, HistoricMeeting[]>();
  for (const old of previous) {
    const rows = previousByBody.get(old.public_body_id) ?? [];
    rows.push(old); previousByBody.set(old.public_body_id, rows);
  }
  let checks = 0;
  const output: T[] = [];
  for (const draft of [...drafts].sort((a, b) => b.meetingDate.localeCompare(a.meetingDate))) {
    const bodyId = `body-${draft.sourceId}-${slugify(draft.publicBodyName)}`;
    const oldRows = previousByBody.get(bodyId) ?? [];
    const currentIdentities = identities([draft.agendaUrl, draft.videoUrl, ...draft.sourceUrls]);
    const matching = oldRows.filter((old) => [...identities([old.agenda_url, old.video_url, ...old.source_urls])].some((key) => currentIdentities.has(key)));
    const evidence = new Set(draft.sourceIdentityEvidence ?? []);
    // Exact packet equality selects candidates; it is insufficient without matching redirects.
    const candidates = draft.packetUrl && draft.agendaUrl && [...currentIdentities].some((key) => key.startsWith("clip:"))
      ? oldRows.filter((old) => old.packet_url === draft.packetUrl && old.agenda_url && !matching.includes(old)
        && meetingDay(old.meeting_date) === meetingDay(draft.meetingDate)
        && [...identities([old.agenda_url])].some((key) => key.startsWith("event:"))) : [];
    const eventIds = new Set(candidates.flatMap((old) => [...identities([old.agenda_url])].filter((key) => key.startsWith("event:"))));
    if (eventIds.size > 1) options.onAmbiguity?.(`${draft.id}: multiple scheduled event IDs share its packet; retained separate records.`);
    else if (candidates.length && checks < maxChecks) {
      checks += 1;
      const target = await resolve(draft.agendaUrl!);
      const oldTarget = await resolve(candidates[0].agenda_url!);
      if (target && target === oldTarget) { matching.push(...candidates); evidence.add(target); }
      else options.onAmbiguity?.(`${draft.id}: scheduled event and recording did not resolve to the same specific agenda artifact; retained separate records.`);
    } else if (candidates.length) options.onAmbiguity?.(`${draft.id}: identity verification deferred by the per-run request limit; retained separate records.`);
    if (!matching.length) { output.push(draft); continue; }
    matching.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    const canonical = matching[0];
    const aliases = [...new Set([draft.id, ...matching.flatMap((old) => [old.id, ...(old.meeting_alias_ids ?? [])]), ...(draft.aliasMeetingIds ?? [])])].filter((id) => id !== canonical.id);
    const scheduled = matching.find((old) => [...identities([old.agenda_url, ...old.source_urls])].some((key) => key.startsWith("event:")));
    output.push({
      ...draft,
      id: canonical.id,
      // A recording's actual start is not the event's advertised attendance time.
      meetingDate: scheduled?.meeting_date && meetingDay(scheduled.meeting_date) === meetingDay(draft.meetingDate) ? scheduled.meeting_date : draft.meetingDate,
      aliasMeetingIds: aliases,
      sourceUrls: [...new Set([...draft.sourceUrls, ...matching.flatMap((old) => old.source_urls), ...evidence])],
      sourceIdentityEvidence: [...new Set([...evidence, ...matching.flatMap((old) => old.source_identity_evidence ?? [])])],
    });
  }
  return output;
}
