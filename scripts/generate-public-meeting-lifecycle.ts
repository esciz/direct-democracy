import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { meetingLifecycle } from "@/lib/public-meetings/lifecycle";
import type { PublicBodyRecord, PublicMeetingRecord, PublicMeetingSourceSeed } from "@/lib/public-meetings/types";

const generatedDirectory = path.join(process.cwd(), "data", "generated");
function read<T>(file: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path.join(process.cwd(), file), "utf8")) as T; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback; throw error; }
}
const now = new Date(process.argv.find((arg) => arg.startsWith("--now="))?.slice(6) ?? Date.now());
if (!Number.isFinite(now.getTime())) throw new Error("Invalid --now timestamp");
const meetings = read<PublicMeetingRecord[]>("data/generated/public-meetings.json", []);
const bodies = read<PublicBodyRecord[]>("data/generated/public-meeting-bodies.json", []);
const seeds = read<PublicMeetingSourceSeed[]>("data/seed/public-meeting-sources.json", []);
type DiscoveryState = { sourceId: string; lastAttemptAt: string; lastSuccessAt: string | null; failures: number; meetingsDiscovered: number; error: string | null };
const discovery = read<{ records: DiscoveryState[] }>("data/generated/public-meeting-discovery-state.json", { records: [] });
const sourceById = new Map(discovery.records.map((state) => [state.sourceId, state]));
const bodyById = new Map(bodies.map((body) => [body.id, body]));
const text = read<{ records: Array<{ meetingId: string; documentType: string; textLength: number; extractionQuality: string; extractedTextPath?: string | null }> }>("data/generated/public-meeting-document-text.json", { records: [] });
function hasCachedText(file: string | null | undefined) {
  if (!file) return false;
  try { return statSync(path.resolve(process.cwd(), file)).size > 0; } catch { return false; }
}
const extractedMinutes = new Set(text.records.filter((row) => row.documentType === "minutes" && row.textLength >= 100 && ["high", "medium"].includes(row.extractionQuality) && hasCachedText(row.extractedTextPath)).map((row) => row.meetingId));
const records = meetings.filter((meeting) => meeting.source_method !== "manual_fixture").map((meeting) => {
  const body = bodyById.get(meeting.public_body_id);
  const source = body ? sourceById.get(body.seed_source_id) : undefined;
  const lifecycle = meetingLifecycle(meeting, now, extractedMinutes.has(meeting.id));
  const nextCheckAt = source?.lastAttemptAt ? new Date(Date.parse(source.lastAttemptAt) + lifecycle.checkCadenceHours * 3_600_000).toISOString() : null;
  return { meetingId: meeting.id, title: meeting.title, meetingDate: meeting.meeting_date, bodyName: body?.name ?? null, jurisdiction: body?.jurisdiction ?? null, sourceId: body?.seed_source_id ?? null, ...lifecycle, sourceLastCheckedAt: source?.lastAttemptAt ?? null, sourceLastSuccessAt: source?.lastSuccessAt ?? null, nextCheckAt, checkDue: !nextCheckAt || Date.parse(nextCheckAt) <= now.getTime(), minutesUrl: meeting.minutes_url, officialSourceUrl: meeting.source_urls[0] ?? body?.meeting_index_url ?? null };
});
const discoveryCrawl = read<{ generatedAt?: string; sourceReports: Array<{ url: string; status: string; error?: string }> }>("data/generated/nevada-meeting-source-discovery.json", { sourceReports: [] });
const previousSources = new Map(read<{ sources: Array<{ sourceId: string; lastCheckedAt: string | null; lastSuccessAt: string | null; error: string | null }> }>("data/generated/public-meeting-lifecycle.json", { sources: [] }).sources.map((row) => [row.sourceId, row]));
const normalizedUrl = (value: string) => value.replace(/#.*$/, "").replace(/\/$/, "");
const sources = seeds.filter((seed) => seed.active).map((seed) => {
  const discoveryOnly = seed.platformHints?.includes("discovery_only") ?? false;
  let state = sourceById.get(seed.id);
  if (discoveryOnly) {
    const sourceUrls = new Set([seed.meetingIndexUrl, seed.sourceUrl, ...(seed.discoveryUrls ?? [])].filter((value): value is string => Boolean(value)).map(normalizedUrl));
    const attempts = discoveryCrawl.sourceReports.filter((row) => sourceUrls.has(normalizedUrl(row.url)));
    const prior = previousSources.get(seed.id);
    const successful = attempts.some((row) => row.status === "ok");
    state = { sourceId: seed.id, lastAttemptAt: attempts.length && discoveryCrawl.generatedAt ? discoveryCrawl.generatedAt : prior?.lastCheckedAt ?? "", lastSuccessAt: successful && discoveryCrawl.generatedAt ? discoveryCrawl.generatedAt : prior?.lastSuccessAt ?? null,
      failures: attempts.filter((row) => row.status === "error").length, meetingsDiscovered: 0,
      error: attempts.some((row) => row.status === "error") ? attempts.filter((row) => row.status === "error").map((row) => row.error ?? "Discovery directory fetch failed").join("; ") : attempts.length ? null : prior?.error ?? null };
  }
  const linked = records.filter((record) => record.sourceId === seed.id);
  const cadenceHours = Math.min((seed.directCollectionCadenceDays ?? 1) * 24, ...linked.map((record) => record.checkCadenceHours));
  const nextCheckAt = state?.lastAttemptAt ? new Date(Date.parse(state.lastAttemptAt) + cadenceHours * 3_600_000).toISOString() : null;
  const stale = !state?.lastSuccessAt || now.getTime() - Date.parse(state.lastSuccessAt) > Math.max(48, cadenceHours * 2) * 3_600_000;
  return { sourceId: seed.id, capability: discoveryOnly ? "discovery_only" : "meeting_collection", nextAction: discoveryOnly ? "review_discovered_sources" : linked.some((row) => row.minutesStatus === "awaiting_publication") ? "refresh_calendar_and_minutes" : "refresh_calendar", name: seed.name, jurisdiction: seed.jurisdiction, calendarUrl: seed.meetingIndexUrl, minutesArchiveUrl: seed.minutesArchiveUrl ?? seed.meetingIndexUrl, status: state?.error || state?.failures ? "degraded" : stale ? "stale" : "healthy", lastCheckedAt: state?.lastAttemptAt || null, lastSuccessAt: state?.lastSuccessAt ?? null, nextCheckAt, checkDue: !nextCheckAt || Date.parse(nextCheckAt) <= now.getTime(), cadenceHours, upcomingMeetings: linked.filter((record) => record.phase === "upcoming").length, archivedMeetings: linked.filter((record) => record.phase === "archived").length, awaitingMinutes: linked.filter((record) => record.minutesStatus === "awaiting_publication").length, overdueMinutes: linked.filter((record) => record.minutesOverdue).length, error: state?.error ?? (stale ? "No recent successful source discovery has been recorded." : null) };
});
const artifact = { generatedAt: now.toISOString(), policy: { archive: "Meetings move to the archive after the official local meeting day. Source disappearance never deletes history or implies cancellation.", minutes: "Check daily for 45 days, weekly through 180 days, monthly thereafter. Thirty days marks an operational follow-up target, not a legal publication deadline.", freshness: "Source check times come from actual discovery attempts; generating this report does not refresh them." }, totals: { meetings: records.length, upcoming: records.filter((row) => row.phase === "upcoming").length, archived: records.filter((row) => row.phase === "archived").length, datesUnconfirmed: records.filter((row) => row.phase === "date_unconfirmed").length, awaitingMinutes: records.filter((row) => row.minutesStatus === "awaiting_publication").length, overdueMinutes: records.filter((row) => row.minutesOverdue).length, minutesPublished: records.filter((row) => row.minutesStatus === "published").length, minutesExtracted: records.filter((row) => row.minutesStatus === "extracted").length, activeSources: sources.length, discoveryOnlySources: sources.filter((row) => row.capability === "discovery_only").length, meetingCollectionSources: sources.filter((row) => row.capability === "meeting_collection").length, sourcesDue: sources.filter((row) => row.checkDue).length, sourcesDegraded: sources.filter((row) => row.status === "degraded").length, sourcesStale: sources.filter((row) => row.status === "stale").length }, sources, records };
const output = path.join(generatedDirectory, "public-meeting-lifecycle.json");
mkdirSync(generatedDirectory, { recursive: true });
writeFileSync(`${output}.${process.pid}.tmp`, `${JSON.stringify(artifact, null, 2)}\n`);
renameSync(`${output}.${process.pid}.tmp`, output);
console.log(JSON.stringify(artifact.totals, null, 2));
