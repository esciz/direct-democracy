import Link from "next/link";

import { OperationsAutoRefresh } from "@/components/admin/operations-auto-refresh";
import { PageIntro } from "@/components/ui/page-intro";
import { logoutAdminAction } from "@/lib/admin/auth-actions";
import { requireAdminSession } from "@/lib/admin/auth";
import { startAdminOperationAction } from "@/lib/admin/operations-actions";
import {
  getAdminOperationDefinitions,
  getAdminOperationsRuntime,
  listAdminOperationRuns,
  type AdminOperationRunStatus,
} from "@/lib/admin/operations";
import { getAdminImportRuns, getCivicDataMetrics, type CivicDataMetrics } from "@/lib/civic-data/service";
import { getPublicMeetingAdminDashboard } from "@/lib/public-meetings/public";

export const dynamic = "force-dynamic";

const EMPTY_METRICS: CivicDataMetrics = {
  jurisdictions: 0,
  offices: 0,
  districts: 0,
  officials: 0,
  elections: 0,
  bills: 0,
  initiatives: 0,
  meetings: 0,
  ads: 0,
  dataSources: 0,
};

const adminLinks = [
  { href: "/admin/data", label: "Nevada data QA" },
  { href: "/admin/data-factory", label: "Civic Data Factory" },
  { href: "/admin/imports", label: "Import history" },
  { href: "/admin/meetings", label: "Meeting review" },
  { href: "/admin/meeting-sources", label: "Meeting sources" },
  { href: "/admin/preview", label: "Preview mode" },
];

type AdminOperationsSearchParams = {
  error?: string;
};

type AdminOperationsPageProps = {
  searchParams?: Promise<AdminOperationsSearchParams>;
};

type MeetingDashboard = Awaited<ReturnType<typeof getPublicMeetingAdminDashboard>>;
type ImportRuns = Awaited<ReturnType<typeof getAdminImportRuns>>;

async function safeLoad<T>(loader: () => Promise<T>, fallback: T) {
  try {
    return await loader();
  } catch {
    return fallback;
  }
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusClasses(status: AdminOperationRunStatus) {
  if (status === "succeeded") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (status === "failed") return "border-rose-300/20 bg-rose-300/10 text-rose-100";
  if (status === "cancelled") return "border-slate-300/20 bg-slate-300/10 text-slate-200";
  return "border-cyan-300/20 bg-cyan-300/10 text-cyan-100";
}

export default async function AdminOperationsPage({ searchParams }: AdminOperationsPageProps) {
  const session = await requireAdminSession("/admin");
  const params: AdminOperationsSearchParams = searchParams ? await searchParams : {};
  const definitions = getAdminOperationDefinitions();
  const [runtime, runs, metrics, meetingDashboard, importRuns] = await Promise.all([
    getAdminOperationsRuntime(),
    safeLoad(() => listAdminOperationRuns(20), []),
    safeLoad(() => getCivicDataMetrics(), EMPTY_METRICS),
    safeLoad<MeetingDashboard | null>(() => getPublicMeetingAdminDashboard(), null),
    safeLoad<ImportRuns>(() => getAdminImportRuns(), []),
  ]);
  const activeRun = runs.find((run) => run.status === "queued" || run.status === "running") ?? null;
  const meetingCount = meetingDashboard?.meetings.length ?? metrics.meetings;
  const meetingItemCount = meetingDashboard?.meetingItems.length ?? 0;
  const providerCount = meetingDashboard?.seedSources.length ?? 0;
  const needsReviewCount = meetingDashboard?.manualProviderReport.reduce((total, report) => total + (report.needs_review_count ?? 0), 0) ?? 0;
  const metricCards = [
    { label: "Meetings", value: meetingCount },
    { label: "Meeting items", value: meetingItemCount },
    { label: "Source providers", value: providerCount },
    { label: "Meeting review flags", value: needsReviewCount },
    { label: "Civic sources", value: metrics.dataSources },
    { label: "Officials", value: metrics.officials },
    { label: "Elections", value: metrics.elections },
    { label: "Recorded imports", value: importRuns.length },
  ];

  return (
    <div className="space-y-6 py-8">
      <OperationsAutoRefresh active={Boolean(activeRun)} />
      <PageIntro
        eyebrow="Admin"
        title="Operations console"
        description="Monitor civic data health and trigger the fixed, source-safe acquisition and processing pipelines from the application environment instead of a terminal."
        actions={
          <div className="flex flex-wrap gap-2">
            {adminLinks.map((link) => (
              <Link key={link.href} href={link.href} className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
                {link.label}
              </Link>
            ))}
            <form action={logoutAdminAction}>
              <button type="submit" className="rounded-full border border-rose-300/20 bg-rose-300/10 px-4 py-2.5 text-sm font-semibold text-rose-100 hover:border-rose-200/40">
                Sign out
              </button>
            </form>
          </div>
        }
      />

      {params.error ? (
        <section className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm leading-6 text-rose-100">{params.error}</section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-50">{metric.value.toLocaleString()}</p>
          </div>
        ))}
      </section>

      <section className={`rounded-[1.75rem] border p-5 ${runtime.enabled ? "border-emerald-300/20 bg-emerald-300/5" : "border-amber-300/20 bg-amber-300/5"}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Native runner</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-50">{runtime.enabled ? "Ready to run" : "Monitoring only"}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{runtime.reason}</p>
          </div>
          <div className="grid gap-2 text-xs font-semibold text-slate-300 sm:grid-cols-2 lg:min-w-[24rem]">
            <span className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">Environment: {runtime.environment}</span>
            <span className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">Runner: {runtime.runnerAvailable ? "installed" : "missing"}</span>
            <span className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">Playwright: {runtime.playwrightAvailable ? "installed" : "missing"}</span>
            <span className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">Logs: {runtime.storageLabel}</span>
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-400">
          Signed in as {session.email}. Operations are allowlisted and serialized. They never accept arbitrary shell commands and must not bypass authentication, CAPTCHAs, paywalls, bot protection, or private endpoints.
        </p>
      </section>

      {activeRun ? (
        <section className="rounded-[1.75rem] border border-cyan-300/20 bg-cyan-300/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Active operation</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-50">{activeRun.operationLabel}</h2>
              <p className="mt-2 text-sm text-slate-400">
                {activeRun.currentStepLabel ?? "Waiting for the runner"} · started {formatDate(activeRun.startedAt ?? activeRun.createdAt)}
              </p>
            </div>
            <Link href={`/admin/operations/${activeRun.id}`} className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
              View live log
            </Link>
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Acquisition and processing</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-50">Run an allowlisted pipeline</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Each trigger launches the existing repository scripts in a detached native runner, records who started it, and streams stdout and stderr into a reviewable log.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {definitions.map((operation) => {
            const disabled = !runtime.enabled || Boolean(activeRun) || (operation.requiresPlaywright && !runtime.playwrightAvailable);
            return (
              <article key={operation.id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                    {operation.category}
                  </span>
                  {operation.requiresPlaywright ? (
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">Playwright</span>
                  ) : null}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-slate-50">{operation.label}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{operation.description}</p>
                <ol className="mt-3 space-y-1 text-xs leading-5 text-slate-500">
                  {operation.steps.map((step, index) => (
                    <li key={`${operation.id}-${step.label}`}>{index + 1}. {step.label}</li>
                  ))}
                </ol>
                <form action={startAdminOperationAction} className="mt-4">
                  <input type="hidden" name="operationId" value={operation.id} />
                  <button
                    type="submit"
                    disabled={disabled}
                    className="dd-button-primary rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {activeRun ? "Another operation is active" : "Start operation"}
                  </button>
                </form>
              </article>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Audit trail</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-50">Recent native operations</h2>
          </div>
          <span className="text-xs text-slate-500">Auto-refreshes while a run is active</span>
        </div>
        <div className="divide-y divide-white/10">
          {runs.length > 0 ? (
            runs.map((run) => (
              <Link key={run.id} href={`/admin/operations/${run.id}`} className="grid gap-3 px-5 py-4 text-sm hover:bg-white/[0.03] md:grid-cols-[1.4fr_0.7fr_0.9fr_0.9fr]">
                <div>
                  <p className="font-semibold text-slate-50">{run.operationLabel}</p>
                  <p className="mt-1 text-xs text-slate-500">{run.currentStepLabel ?? run.category}</p>
                </div>
                <div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusClasses(run.status)}`}>
                    {run.status}
                  </span>
                </div>
                <p className="text-slate-300">{formatDate(run.createdAt)}</p>
                <p className="truncate text-slate-400">{run.requestedBy}</p>
              </Link>
            ))
          ) : (
            <p className="px-5 py-8 text-sm text-slate-400">No native operation runs have been recorded on this host.</p>
          )}
        </div>
      </section>
    </div>
  );
}
