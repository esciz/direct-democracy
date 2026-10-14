import { GovCrmPageShell } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";
import { getGovCrmOperationsDashboard } from "@/lib/govcrm/operations-dashboard";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0, style: "percent" });

function formatNumber(value: number | undefined) {
  return numberFormatter.format(value ?? 0);
}

function formatPercent(value: number | undefined) {
  return percentFormatter.format((value ?? 0) / 100);
}

function formatDate(value: string | undefined) {
  if (!value) return "Date pending";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatLabel(value: string | undefined) {
  return value?.replaceAll("_", " ") ?? "Pending";
}

export default async function GovMeetingsPage() {
  await requireGovCrmAccess();
  const dashboard = await getGovCrmOperationsDashboard();

  return (
    <GovCrmPageShell
      title="Meeting source readiness"
      description="Operational view of meeting evidence quality, source gaps, parser gaps, attendance coverage, and next retrieval actions."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Meetings scored</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(dashboard.summary.meetingsScored)}</p>
          <p className="mt-2 text-sm text-slate-400">Source completeness records</p>
        </article>
        <article className="rounded-[1.25rem] border border-emerald-300/20 bg-emerald-400/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Ready</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(dashboard.summary.readyMeetings)}</p>
          <p className="mt-2 text-sm text-slate-300">{formatPercent(dashboard.summary.readinessRate)} accountability readiness</p>
        </article>
        <article className="rounded-[1.25rem] border border-amber-300/20 bg-amber-400/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Source gaps</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(dashboard.summary.sourceGapMeetings)}</p>
          <p className="mt-2 text-sm text-slate-300">Retrieval/cache blockers</p>
        </article>
        <article className="rounded-[1.25rem] border border-cyan-300/20 bg-cyan-400/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Parser gaps</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(dashboard.summary.parserGapMeetings)}</p>
          <p className="mt-2 text-sm text-slate-300">Extraction logic blockers</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {[
          ["Source gaps", dashboard.queues.sourceGaps],
          ["Parser gaps", dashboard.queues.parserGaps],
          ["Attendance gaps", dashboard.queues.missingAttendance],
          ["Next actions", dashboard.queues.nextActions],
        ].map(([title, records]) => (
          <article key={String(title)} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-semibold text-white">{String(title)}</h2>
            <ul className="mt-5 space-y-3">
              {Array.isArray(records) && records.length ? (
                records.slice(0, 4).map((record) => (
                  <li key={record.meetingId} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <p className="font-semibold text-white">{record.bodyName ?? "Meeting body pending"}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {record.jurisdiction ?? "Jurisdiction pending"} · {formatDate(record.meetingDate)}
                    </p>
                    <p className="mt-3 text-xs text-slate-300">
                      {formatLabel(record.recommendedNextAction)} · readiness {formatPercent(Math.round((record.accountabilityReadinessScore ?? 0) * 100))}
                    </p>
                  </li>
                ))
              ) : (
                <li className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">No records generated.</li>
              )}
            </ul>
          </article>
        ))}
      </section>
    </GovCrmPageShell>
  );
}
