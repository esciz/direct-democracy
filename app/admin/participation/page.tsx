import Link from "next/link";

import { SectionHeading } from "@/components/ui/section-heading";
import { getParticipationAdminDashboard } from "@/lib/civic-signals/participation-admin";
import { requireAdminPage } from "@/lib/admin/permissions";

function Metric({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{typeof value === "number" ? value.toLocaleString() : value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </article>
  );
}

function Badge({ children, tone = "slate" }: { children: string; tone?: "slate" | "green" | "amber" | "cyan" }) {
  const tones = {
    slate: "border-white/10 bg-white/5 text-slate-300",
    green: "border-emerald-300/20 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-300/20 bg-amber-500/10 text-amber-200",
    cyan: "border-cyan-300/20 bg-cyan-500/10 text-cyan-200",
  };
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${tones[tone]}`}>{children}</span>;
}

export default async function AdminParticipationPage() {
  await requireAdminPage("dataops.view");
  const dashboard = await getParticipationAdminDashboard();
  const totals = dashboard.activation.totals;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Admin QA</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Participation and stakeholder analytics</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Review real verified responses separately from QA fixtures, demo seed responses, and imported tests. Official-facing analytics count only real participant responses with analytics enabled.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/operations" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100">
                Operations
              </Link>
              <Link href="/gov/dashboard" className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                Official dashboard
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Source-backed questions" value={totals.sourceBackedQuestions} detail="Reviewed public civic records" />
          <Metric label="Real participant responses" value={totals.realParticipantResponses} detail="Eligible source of civic signal" />
          <Metric label="Verified analytics responses" value={totals.verifiedResponses} detail="Counted after verification checks" />
          <Metric label="Public cohorts" value={totals.stakeholderPublicSegments} detail="Meet minimum cohort threshold" />
          <Metric label="Suppressed cohorts" value={totals.stakeholderSuppressedSegments} detail="Hidden by privacy policy" />
          <Metric label="QA fixtures" value={totals.qaFixtureResponses} detail="Excluded from official analytics" />
          <Metric label="Demo seed responses" value={totals.demoSeedResponses} detail="Excluded unless explicitly promoted later" />
          <Metric label="Excluded responses" value={totals.excludedFromAnalyticsResponses} detail="Not counted in official-facing aggregates" />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <SectionHeading eyebrow="Policy" title="Analytics guardrails" description="This page can show operational provenance. Public and official analytics stay aggregate-only." />
          <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2 xl:grid-cols-4">
            <p className="rounded-xl bg-slate-950/35 p-3">Vote weight: {dashboard.activation.policy.voteWeight}</p>
            <p className="rounded-xl bg-slate-950/35 p-3">Minimum cohort: {dashboard.activation.policy.minimumCohortSize}</p>
            <p className="rounded-xl bg-slate-950/35 p-3">Hidden weighting: {dashboard.activation.policy.hiddenWeighting ? "yes" : "no"}</p>
            <p className="rounded-xl bg-slate-950/35 p-3">Individual records exposed: {dashboard.activation.policy.individualRecordsExposed ? "yes" : "no"}</p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <SectionHeading eyebrow="Questions" title="Source-backed voting inventory" description="Recent reviewed questions and their analytics/excluded response counts." />
            <div className="mt-4 space-y-3">
              {dashboard.topQuestions.slice(0, 12).map((question) => (
                <div key={question.id} className="rounded-xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-white">{question.questionText}</h2>
                      <p className="mt-1 text-xs text-slate-400">{question.jurisdictionName} · {question.sourceName ?? "source pending"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={question.sourceUrlPresent ? "green" : "amber"}>{question.sourceUrlPresent ? "source-backed" : "source missing"}</Badge>
                      <Badge tone={question.publicSegmentCount ? "green" : "amber"}>{question.publicSegmentCount ? "public cohort" : "suppressed"}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                    <span>responses {question.totalResponses}</span>
                    <span>analytics {question.analyticsResponses}</span>
                    <span>excluded {question.excludedResponses}</span>
                    <span>suppressed segments {question.suppressedSegmentCount}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <SectionHeading eyebrow="Responses" title="Recent participation provenance" description="Operational QA view. User IDs and private identity evidence are not displayed." />
            <div className="mt-4 space-y-3">
              {dashboard.recentResponses.length ? dashboard.recentResponses.map((response) => (
                <div key={response.id} className="rounded-xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={response.provenance === "real_participant" ? "green" : "amber"}>{response.provenance.replaceAll("_", " ")}</Badge>
                    <Badge tone={response.countsInAnalytics ? "green" : "amber"}>{response.countsInAnalytics ? "counts" : "excluded"}</Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">{response.questionText}</p>
                  <p className="mt-1 text-xs text-slate-400">{response.jurisdictionName} · {response.answer} · {new Date(response.updatedAt).toLocaleString()}</p>
                  {response.provenanceNote ? <p className="mt-2 text-xs leading-5 text-slate-500">{response.provenanceNote}</p> : null}
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-400">
                  No participation responses are stored right now.
                </div>
              )}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
