import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { PageIntro } from "@/components/ui/page-intro";
import { formatCivicEventDate } from "@/lib/events/lifecycle";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

type SourceHealth = {
  sourceId: string; name: string; jurisdiction: string; calendarUrl: string | null;
  status: string; lastCheckedAt: string | null; lastSuccessAt: string | null;
  nextCheckAt: string | null; upcomingMeetings: number; awaitingMinutes: number; overdueMinutes: number;
  error: string | null;
};
type MeetingFollowUp = {
  meetingId: string; title: string; meetingDate: string | null; jurisdiction: string | null;
  minutesStatus: string; minutesOverdue: boolean; nextAction: string; officialSourceUrl: string | null;
};
type HealthReport = {
  generatedAt: string; totals: Record<string, number>; sources: SourceHealth[]; records: MeetingFollowUp[];
};
type DiscoveryLead = { id: string; bodyName: string; sourceUrl: string | null; discoveredFrom: string; status: string; sourceKind: string; registeredProviderId: string | null };
async function readDiscovery(): Promise<DiscoveryLead[]> {
  try {
    const data = JSON.parse(await readFile(path.join(process.cwd(), "data/generated/nevada-meeting-source-discovery.json"), "utf8"));
    return Array.isArray(data.leads) ? data.leads : [];
  } catch { return []; }
}

async function readReport(): Promise<HealthReport | null> {
  try {
    const data = JSON.parse(await readFile(path.join(process.cwd(), "data/generated/public-meeting-lifecycle.json"), "utf8"));
    return Array.isArray(data.sources) && Array.isArray(data.records) && data.totals ? data : null;
  } catch { return null; }
}

function date(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "No check recorded";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }).format(new Date(value));
}
const button = "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-cyan-100";
const actionLabels: Record<string, string> = {
  check_official_minutes_archive: "Check the official minutes archive",
  retrieve_and_extract_minutes: "Retrieve and extract the linked minutes",
  verify_meeting_date: "Verify the meeting date with the organizer",
  refresh_calendar_and_agenda: "Check the calendar and latest agenda",
  periodic_archive_check: "Recheck the archive for corrections",
};

export default async function MeetingHealthPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") redirect("/profile");
  const [report, params, leads] = await Promise.all([readReport(), searchParams ?? Promise.resolve({ q: "" }), readDiscovery()]);
  const query = (params.q ?? "").trim().toLowerCase();
  const matches = (text: string) => !query || text.toLowerCase().includes(query);
  const sources = (report?.sources ?? []).filter((source) => matches(`${source.name} ${source.jurisdiction}`))
    .sort((a, b) => Number(/carson/i.test(b.jurisdiction)) - Number(/carson/i.test(a.jurisdiction)) || Number(a.status === "healthy") - Number(b.status === "healthy") || a.name.localeCompare(b.name));
  const followUps = (report?.records ?? []).filter((meeting) => ["awaiting_publication", "published"].includes(meeting.minutesStatus) && matches(`${meeting.title} ${meeting.jurisdiction}`))
    .sort((a, b) => Number(/carson/i.test(b.jurisdiction ?? "")) - Number(/carson/i.test(a.jurisdiction ?? "")) || (Date.parse(b.meetingDate ?? "") || 0) - (Date.parse(a.meetingDate ?? "") || 0));
  const staleReport = !report || !Number.isFinite(Date.parse(report.generatedAt)) || Date.now() - Date.parse(report.generatedAt) > 48 * 3_600_000;
  const discoveryLeads = leads.filter((lead) => !lead.registeredProviderId && matches(`${lead.bodyName} ${lead.sourceKind} ${lead.discoveredFrom}`));
  return (
    <div className="space-y-6 pb-12">
      <PageIntro eyebrow="Meeting operations" title="Calendar coverage and minutes follow-up" description="Track source checks, upcoming meetings, and the minutes still needed to document decisions. Carson City appears first; coverage includes the whole state." />
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/operations" className={button}>Run a refresh</Link>
        <Link href="/admin/meeting-sources" className={button}>Source registry</Link>
        <Link href="/admin/meetings/upload" className={button}>Import meeting materials</Link>
        <Link href="/admin/meeting-actions?review=needs_review" className={button}>Review extracted actions</Link>
        <Link href="/events?status=completed" className={button}>Public archive</Link>
      </div>
      <p className={`rounded-2xl border p-4 text-sm ${staleReport ? "border-amber-300/30 bg-amber-500/10 text-amber-100" : "border-white/10 bg-white/5 text-slate-300"}`}>
        {report ? `Report generated ${date(report.generatedAt)} Pacific. ` : "No lifecycle report is available. "}
        {staleReport ? "Refresh required. " : ""}A fresh report does not prove every calendar was checked. Source checks and successful checks are listed separately below.
      </p>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Upcoming", "upcoming"], ["Archived", "archived"], ["Awaiting minutes", "awaitingMinutes"], ["Minutes text extracted", "minutesExtracted"], ["Active sources", "activeSources"], ["Sources due", "sourcesDue"], ["Stale sources", "sourcesStale"], ["Sources needing attention", "sourcesDegraded"]].map(([label, key]) => (
          <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{report?.totals[key]?.toLocaleString() ?? "—"}</p>
          </div>
        ))}
      </section>
      <form action="/admin/meeting-health" className="flex flex-wrap gap-3">
        <label htmlFor="meeting-health-search" className="sr-only">Search body or jurisdiction</label>
        <input id="meeting-health-search" name="q" defaultValue={params.q} placeholder="Search Carson City, taxation, schools…" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-sm text-white" />
        <button className={button} type="submit">Search</button>
      </form>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Source coverage · {sources.length}</h2>
        <p className="text-sm text-slate-400">Zero upcoming meetings requires checking the official calendar. It can mean a quiet calendar, a delayed posting, or an adapter that missed dates.</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {sources.map((source) => <article key={source.sourceId} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-semibold text-white">{source.name}</h3><span className={`rounded-full px-2 py-1 text-xs ${source.status === "healthy" ? "bg-emerald-500/10 text-emerald-200" : "bg-amber-500/10 text-amber-100"}`}>{source.status}</span></div>
            <p className="mt-1 text-sm text-slate-400">{source.jurisdiction} · {source.upcomingMeetings} upcoming · {source.awaitingMinutes} awaiting minutes</p>
            <dl className="mt-3 space-y-1 text-xs text-slate-400">
              <div><dt className="inline">Last attempt: </dt><dd className="inline">{date(source.lastCheckedAt)}</dd></div>
              <div><dt className="inline">Last success: </dt><dd className="inline">{date(source.lastSuccessAt)}</dd></div>
              <div><dt className="inline">Next check: </dt><dd className="inline">{source.nextCheckAt ? date(source.nextCheckAt) : "Due now"}</dd></div>
            </dl>
            {source.error ? <p className="mt-3 break-words text-xs text-amber-100">{source.error.slice(0, 300)}</p> : null}
            {source.calendarUrl ? <a href={source.calendarUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-cyan-200 underline">Check official calendar</a> : null}
          </article>)}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Minutes to follow up · {followUps.length}</h2>
        <p className="text-sm text-slate-400">Missing minutes and linked minutes awaiting extraction, showing the 60 most recent matches with Carson City first. The 30-day flag is an operational follow-up target, not a legal deadline. Archived meetings remain eligible for minutes collection.</p>
        {followUps.slice(0, 60).map((meeting) => <article key={meeting.meetingId} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <Link href={`/events/${meeting.meetingId}`} className="font-semibold text-cyan-100 hover:underline">{meeting.title}</Link>
          <p className="mt-1 text-sm text-slate-400">{meeting.jurisdiction} · {formatCivicEventDate(meeting.meetingDate, true)}</p>
          <p className="mt-2 text-sm text-slate-300">{actionLabels[meeting.nextAction] ?? meeting.nextAction.replaceAll("_", " ")}{meeting.minutesOverdue ? " · Follow-up target exceeded" : ""}</p>
          {meeting.officialSourceUrl ? <a href={meeting.officialSourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-cyan-200 underline">View source</a> : null}
        </article>)}
        {!followUps.length ? <p className="text-sm text-slate-400">No matching follow-up records in this report.</p> : null}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">New source leads to review · {discoveryLeads.length}</h2>
        <p className="text-sm text-slate-400">Public-notice and school-directory discoveries expand the registry after review. Confirm the body and calendar before publishing meeting dates. Contact-only PTA entries still need a public or organizer-provided calendar.</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {discoveryLeads.slice(0, 40).map((lead) => <article key={lead.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <h3 className="font-semibold text-white">{lead.bodyName}</h3>
            <p className="mt-1 text-xs text-slate-400">{lead.sourceKind.replaceAll("_", " ")} · {lead.status.replaceAll("_", " ")}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-cyan-200 underline">
              {lead.sourceUrl ? <a href={lead.sourceUrl} target="_blank" rel="noreferrer">Proposed source</a> : null}
              <a href={lead.discoveredFrom} target="_blank" rel="noreferrer">Discovery evidence</a>
            </div>
          </article>)}
        </div>
      </section>
    </div>
  );
}
