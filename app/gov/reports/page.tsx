import { GovCrmPageShell } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";
import { getGovCrmOperationsDashboard } from "@/lib/govcrm/operations-dashboard";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-US");

function formatNumber(value: number | undefined) {
  return numberFormatter.format(value ?? 0);
}

function formatDate(value: string | null) {
  if (!value) return "Not generated yet";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default async function GovReportsPage() {
  await requireGovCrmAccess();
  const dashboard = await getGovCrmOperationsDashboard();
  const artifactRows = Object.values(dashboard.artifacts).map((artifact) => ({
    path: artifact.path,
    available: artifact.available,
  }));
  const stakeholderPolicy = dashboard.health.stakeholderAnalytics.policy;

  return (
    <GovCrmPageShell
      title="Trust reports"
      description="Generated audit artifacts for evidence acquisition, OCR readiness, accountability readiness, and platform trust controls."
    >
      <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Audit status</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Latest generated foundation report</h2>
          </div>
          <p className="text-sm text-slate-400">{formatDate(dashboard.generatedAt)}</p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1.25rem] border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Artifacts available</p>
            <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(artifactRows.filter((row) => row.available).length)}</p>
          </article>
          <article className="rounded-[1.25rem] border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Documents</p>
            <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(dashboard.summary.documents)}</p>
          </article>
          <article className="rounded-[1.25rem] border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Source gaps</p>
            <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(dashboard.summary.sourceGapMeetings)}</p>
          </article>
          <article className="rounded-[1.25rem] border border-rose-300/20 bg-rose-400/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-200">Scorecard status</p>
            <p className="mt-3 text-3xl font-semibold text-white">{dashboard.summary.scorecardsSafe ? "Allowed" : "Blocked"}</p>
          </article>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-xl font-semibold text-white">Generated artifacts</h2>
        <ul className="mt-5 space-y-3">
          {artifactRows.map((artifact) => (
            <li key={artifact.path} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="break-all text-sm text-slate-300">{artifact.path}</span>
              <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${artifact.available ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border-amber-300/20 bg-amber-400/10 text-amber-100"}`}>
                {artifact.available ? "available" : "missing"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[1.5rem] border border-emerald-300/20 bg-emerald-400/10 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">Stakeholder analytics policy</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Aggregate-only civic signal reporting</h2>
          </div>
          <p className="text-sm text-slate-300">{formatDate(dashboard.health.stakeholderAnalytics.generatedAt)}</p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-[1.25rem] border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Minimum cohort</p>
            <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(stakeholderPolicy?.minimumCohortSize)}</p>
          </article>
          <article className="rounded-[1.25rem] border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Public segments</p>
            <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(dashboard.summary.stakeholderPublicSegments)}</p>
          </article>
          <article className="rounded-[1.25rem] border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Suppressed</p>
            <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(dashboard.summary.stakeholderSuppressedSegments)}</p>
          </article>
          <article className="rounded-[1.25rem] border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Hidden weighting</p>
            <p className="mt-3 text-3xl font-semibold text-white">{stakeholderPolicy?.hiddenWeighting ? "On" : "Off"}</p>
          </article>
          <article className="rounded-[1.25rem] border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Individual records</p>
            <p className="mt-3 text-3xl font-semibold text-white">{stakeholderPolicy?.individualRecordsExposed ? "Shown" : "Hidden"}</p>
          </article>
        </div>
        <p className="mt-5 text-sm leading-6 text-emerald-50">
          This report is intentionally aggregate-only. Officials can inspect source-backed public trends, but cannot view individual voting records,
          unrestricted cross-filters, or any hidden weighted signal.
        </p>
      </section>
    </GovCrmPageShell>
  );
}
