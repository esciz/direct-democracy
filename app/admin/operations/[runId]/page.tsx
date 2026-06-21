import Link from "next/link";
import { notFound } from "next/navigation";

import { OperationsAutoRefresh } from "@/components/admin/operations-auto-refresh";
import { PageIntro } from "@/components/ui/page-intro";
import { requireAdminSession } from "@/lib/admin/auth";
import { cancelAdminOperationAction } from "@/lib/admin/operations-actions";
import {
  getAdminOperationDefinition,
  getAdminOperationLogTail,
  getAdminOperationRun,
  type AdminOperationRunStatus,
} from "@/lib/admin/operations";

export const dynamic = "force-dynamic";

type AdminOperationRunSearchParams = {
  cancelled?: string;
  error?: string;
};

type AdminOperationRunPageProps = {
  params: Promise<{ runId: string }>;
  searchParams?: Promise<AdminOperationRunSearchParams>;
};

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "long" }).format(new Date(value)) : "Not yet";
}

function statusClasses(status: AdminOperationRunStatus) {
  if (status === "succeeded") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (status === "failed") return "border-rose-300/20 bg-rose-300/10 text-rose-100";
  if (status === "cancelled") return "border-slate-300/20 bg-slate-300/10 text-slate-200";
  return "border-cyan-300/20 bg-cyan-300/10 text-cyan-100";
}

export default async function AdminOperationRunPage({ params, searchParams }: AdminOperationRunPageProps) {
  const { runId } = await params;
  await requireAdminSession(`/admin/operations/${runId}`);
  const query: AdminOperationRunSearchParams = searchParams ? await searchParams : {};
  const run = await getAdminOperationRun(runId).catch(() => null);

  if (!run) {
    return notFound();
  }

  const [definition, logTail] = [getAdminOperationDefinition(run.operationId), await getAdminOperationLogTail(run.id).catch(() => "")];
  const active = run.status === "queued" || run.status === "running";
  const currentStep = run.currentStepIndex === null ? 0 : Math.min(run.currentStepIndex + 1, run.totalSteps);

  return (
    <div className="space-y-6 py-8">
      <OperationsAutoRefresh active={active} intervalMs={3_000} />
      <PageIntro
        eyebrow="Admin operation"
        title={run.operationLabel}
        description={definition?.description ?? "Monitored native administrator operation."}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Operations console
            </Link>
            <Link href="/admin/meetings" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Meeting review
            </Link>
            {active ? (
              <form action={cancelAdminOperationAction}>
                <input type="hidden" name="runId" value={run.id} />
                <button type="submit" className="rounded-full border border-rose-300/20 bg-rose-300/10 px-4 py-2.5 text-sm font-semibold text-rose-100 hover:border-rose-200/40">
                  Cancel operation
                </button>
              </form>
            ) : null}
          </div>
        }
      />

      {query.cancelled ? (
        <section className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
          Cancellation was requested. The status will refresh when the runner exits.
        </section>
      ) : null}
      {query.error ? (
        <section className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">{query.error}</section>
      ) : null}
      {run.errorMessage ? (
        <section className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm leading-6 text-rose-100">{run.errorMessage}</section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Status</p>
          <span className={`mt-3 inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${statusClasses(run.status)}`}>
            {run.status}
          </span>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Progress</p>
          <p className="mt-3 text-2xl font-semibold text-slate-50">{currentStep} / {run.totalSteps}</p>
          <p className="mt-1 text-xs text-slate-500">{run.currentStepLabel ?? "Waiting for runner"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Started</p>
          <p className="mt-3 text-sm font-semibold text-slate-100">{formatDate(run.startedAt ?? run.createdAt)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Completed</p>
          <p className="mt-3 text-sm font-semibold text-slate-100">{formatDate(run.completedAt)}</p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
        <div className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Requested by</p>
            <p className="mt-2 text-slate-200">{run.requestedBy}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Run ID</p>
            <p className="mt-2 break-all font-mono text-xs text-slate-300">{run.id}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Runner PID</p>
            <p className="mt-2 text-slate-200">{run.pid ?? "Not active"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Exit code</p>
            <p className="mt-2 text-slate-200">{run.exitCode ?? "Not available"}</p>
          </div>
        </div>
      </section>

      {definition ? (
        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Allowlisted steps</p>
          <div className="mt-4 space-y-3">
            {definition.steps.map((step, index) => {
              const completed = run.status === "succeeded" || (run.currentStepIndex !== null && index < run.currentStepIndex);
              const current = run.currentStepIndex === index && active;
              return (
                <div key={`${definition.id}-${step.label}`} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-100">{index + 1}. {step.label}</p>
                    <span className="text-xs font-semibold text-slate-500">{completed ? "completed" : current ? "running" : "pending"}</span>
                  </div>
                  <p className="mt-2 break-all font-mono text-xs text-slate-500">{`npm run ${step.script}`}</p>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/80">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Live output</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-50">Runner log</h2>
          </div>
          <p className="text-xs text-slate-500">Showing the most recent output; refreshes every three seconds while active.</p>
        </div>
        <pre className="max-h-[42rem] overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-xs leading-6 text-slate-300">
          {logTail || "The runner has not written output yet."}
        </pre>
      </section>
    </div>
  );
}
