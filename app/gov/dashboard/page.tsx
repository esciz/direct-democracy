import Link from "next/link";

import { GovCrmPageShell } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";
import { getGovCases, isGovCaseOverdue } from "@/lib/govcrm/cases";
import { getGovCrmOperationsDashboard, type MeetingReadinessRecord, type RetrievalQueueRecord, type StakeholderAnalyticsRecord } from "@/lib/govcrm/operations-dashboard";
import { getGovTenantBySlug, getGovTenantDashboardCards, GOV_TENANT_TYPE_LABELS, tenantHref } from "@/lib/govcrm/tenants";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0, style: "percent" });

function formatNumber(value: number | undefined) {
  return numberFormatter.format(value ?? 0);
}

function formatPercent(value: number | undefined) {
  return percentFormatter.format((value ?? 0) / 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not generated yet";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatLabel(value: string | undefined) {
  return value?.replaceAll("_", " ") ?? "Pending";
}

function MetricCard({ label, value, detail, tone = "slate" }: { label: string; value: string; detail: string; tone?: "slate" | "emerald" | "amber" | "cyan" | "rose" }) {
  const toneClasses = {
    slate: "border-white/10 bg-white/[0.04] text-slate-200",
    emerald: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
    amber: "border-amber-300/25 bg-amber-400/10 text-amber-100",
    cyan: "border-cyan-300/25 bg-cyan-400/10 text-cyan-100",
    rose: "border-rose-300/25 bg-rose-400/10 text-rose-100",
  };

  return (
    <article className={`rounded-[1.25rem] border p-5 ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
    </article>
  );
}

function QueueRow({ record }: { record: MeetingReadinessRecord }) {
  return (
    <li className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-white">{record.bodyName ?? "Meeting body pending"}</p>
          <p className="mt-1 text-xs text-slate-400">
            {record.jurisdiction ?? "Jurisdiction pending"} · {formatDate(record.meetingDate)}
          </p>
        </div>
        <span className="w-fit rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">
          {formatLabel(record.recommendedNextAction)}
        </span>
      </div>
      <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-4">
        <span>Documents {formatNumber(record.documentsDiscovered)}</span>
        <span>Cached {formatNumber(record.localDocuments)}</span>
        <span>Extracted {formatNumber(record.extractedDocuments)}</span>
        <span>Readiness {formatPercent(Math.round((record.accountabilityReadinessScore ?? 0) * 100))}</span>
      </div>
    </li>
  );
}

function RetrievalRow({ record }: { record: RetrievalQueueRecord }) {
  return (
    <li className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-white">{formatLabel(record.documentType)}</p>
          <p className="mt-1 text-xs text-slate-400">
            {record.jurisdiction ?? "Jurisdiction pending"} · {record.sourceHost ?? "Host pending"}
          </p>
        </div>
        <span className="w-fit rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">
          {formatLabel(record.retrievalState)}
        </span>
      </div>
      <p className="mt-3 break-all text-xs leading-5 text-slate-400">{record.sourceUrl ?? "Source URL pending"}</p>
      <p className="mt-3 text-xs text-slate-300">{formatLabel(record.recommendedNextAction)} · {formatLabel(record.failureReason ?? undefined)}</p>
    </li>
  );
}

function StakeholderSignalRow({ record }: { record: StakeholderAnalyticsRecord }) {
  const publicSegments = (record.segments ?? []).filter((segment) => !segment.suppressed);
  const suppressedSegments = (record.segments ?? []).filter((segment) => segment.suppressed);

  return (
    <li className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-white">{record.entityName ?? record.questionText ?? "Civic question"}</p>
          <p className="mt-1 text-xs text-slate-400">
            {record.jurisdictionName ?? "Nevada"} · {formatNumber(record.verifiedResponseCount)} verified response{record.verifiedResponseCount === 1 ? "" : "s"}
          </p>
        </div>
        <span className="w-fit rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">
          {formatNumber(record.publicSegments)} public segment{record.publicSegments === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">{record.questionText}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {publicSegments.length ? publicSegments.map((segment) => (
          <div key={segment.segmentId ?? segment.label} className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100">{segment.label}</p>
            {!segment.suppressed ? (
              <p className="mt-2 text-sm text-emerald-50">
                {formatNumber(segment.count)} responses · {formatNumber(segment.supportPercent)}% support · vote weight {segment.voteWeight}
              </p>
            ) : null}
          </div>
        )) : (
          <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">
            No segment has enough verified responses to publish yet.
          </div>
        )}
        {suppressedSegments.length ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Suppressed</p>
            <p className="mt-2 text-sm text-slate-300">
              {formatNumber(suppressedSegments.length)} segment{suppressedSegments.length === 1 ? "" : "s"} hidden by cohort privacy.
            </p>
          </div>
        ) : null}
      </div>
    </li>
  );
}

type GovDashboardPageProps = {
  searchParams?: Promise<{
    tenant?: string;
  }>;
};

export default async function GovDashboardPage({ searchParams }: GovDashboardPageProps) {
  await requireGovCrmAccess();
  const params = searchParams ? await searchParams : undefined;
  const activeTenant = getGovTenantBySlug(params?.tenant);
  const dashboard = await getGovCrmOperationsDashboard();
  const govCases = getGovCases();
  const overdueCases = govCases.filter((caseItem) => isGovCaseOverdue(caseItem));
  const unassignedCases = govCases.filter((caseItem) => !caseItem.assignment.assigneeName);
  const tenantCards = getGovTenantDashboardCards(activeTenant);

  return (
    <GovCrmPageShell
      title="GovCRM operations dashboard"
      description={`${activeTenant.shortName} ${GOV_TENANT_TYPE_LABELS[activeTenant.type]} workspace. Universal GovCRM modules are composed through an actor profile, not a separate product fork.`}
    >
      <section className="rounded-md border border-cyan-400/20 bg-cyan-400/10 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Universal GovCRM tenant</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{activeTenant.name}</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-200">{activeTenant.profile.summary}</p>
          </div>
          <Link href={tenantHref("/gov/settings/tenant", activeTenant)} className="inline-flex min-h-10 w-fit items-center justify-center rounded-md border border-cyan-300/30 bg-slate-950 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/10">
            Tenant settings
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {activeTenant.modules.slice(0, 10).map((moduleId) => (
            <span key={moduleId} className="rounded-md border border-slate-700 bg-slate-950/70 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
              {formatLabel(moduleId)}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {tenantCards.map((card) => (
          <article key={card.id} className="rounded-md border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{card.label}</p>
            <p className="mt-3 text-2xl font-semibold text-white">{card.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{card.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Documents discovered" value={formatNumber(dashboard.summary.documents)} detail={`${formatNumber(dashboard.summary.queued)} queued for retrieval`} tone="cyan" />
        <MetricCard label="Text extracted" value={formatNumber(dashboard.summary.extracted)} detail={`${formatPercent(dashboard.summary.extractionRate)} extraction coverage`} tone="emerald" />
        <MetricCard label="OCR required" value={formatNumber(dashboard.summary.ocrRequired)} detail={dashboard.summary.ocrAvailable ? "OCR runtime available" : "OCR runtime unavailable"} tone="amber" />
        <MetricCard label="Scorecards" value={dashboard.summary.scorecardsSafe ? "Allowed" : "Blocked"} detail="Official scorecards stay disabled until readiness is defensible" tone={dashboard.summary.scorecardsSafe ? "emerald" : "rose"} />
      </section>

      <section className="rounded-[1.5rem] border border-emerald-300/20 bg-emerald-400/10 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">Privacy-preserving stakeholder analytics</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Aggregate civic signal context</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-200">
              Officials can see verified aggregate trends only when cohorts meet the minimum size. Individual vote records, user identities, demographic cross-filters, and hidden weighting are not exposed.
            </p>
          </div>
          <Link href="/gov/reports" className="inline-flex min-h-10 w-fit items-center justify-center rounded-md border border-emerald-300/30 bg-slate-950 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/10">
            View audit
          </Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Questions analyzed" value={formatNumber(dashboard.summary.stakeholderQuestions)} detail="Source-backed vote questions" tone="emerald" />
          <MetricCard label="Verified responses" value={formatNumber(dashboard.summary.stakeholderVerifiedResponses)} detail="Eligible aggregate signals" tone="cyan" />
          <MetricCard label="Public segments" value={formatNumber(dashboard.summary.stakeholderPublicSegments)} detail="Cohorts meeting privacy threshold" tone="emerald" />
          <MetricCard label="Suppressed" value={formatNumber(dashboard.summary.stakeholderSuppressedSegments)} detail="Small cohorts hidden" tone="amber" />
        </div>
        <ul className="mt-5 grid gap-3 lg:grid-cols-2">
          {dashboard.queues.stakeholderAnalytics.length ? (
            dashboard.queues.stakeholderAnalytics.slice(0, 4).map((record) => <StakeholderSignalRow key={record.questionId ?? record.questionText} record={record} />)
          ) : (
            <li className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-300">
              No aggregate stakeholder analytics generated yet.
            </li>
          )}
        </ul>
      </section>

      <section className="rounded-[1.5rem] border border-cyan-300/20 bg-cyan-400/10 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Internal/private case management</p>
            <h2 className="mt-2 text-xl font-semibold text-white">GovCRM case inbox is active</h2>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {formatNumber(govCases.length)} fixture-backed cases · {formatNumber(overdueCases.length)} overdue · {formatNumber(unassignedCases.length)} unassigned. Publishing, email sending, and public status syncing remain disabled.
            </p>
          </div>
          <Link href={tenantHref("/gov/cases", activeTenant)} className="inline-flex min-h-11 w-fit items-center justify-center rounded-full bg-cyan-200 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100">
            Open case inbox
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Evidence readiness</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Accountability input health</h2>
            </div>
            <p className="text-xs text-slate-400">Generated {formatDate(dashboard.generatedAt)}</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Meetings scored" value={formatNumber(dashboard.summary.meetingsScored)} detail="Source completeness records" />
            <MetricCard label="Ready" value={formatNumber(dashboard.summary.readyMeetings)} detail={`${formatPercent(dashboard.summary.readinessRate)} readiness rate`} tone="emerald" />
            <MetricCard label="Source gaps" value={formatNumber(dashboard.summary.sourceGapMeetings)} detail="Retrieval/cache work" tone="amber" />
            <MetricCard label="Parser gaps" value={formatNumber(dashboard.summary.parserGapMeetings)} detail="Extraction logic work" tone="cyan" />
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Trust foundation</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Participant trust controls</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {dashboard.health.trust.roles.map((role) => (
              <span key={role.id ?? role.label} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                {role.label ?? role.id}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Verified Resident and Verified Voter remain equal participation groups. Claims, security controls, and data-domain separation are foundation concepts for future segmentation.
          </p>
          <Link href="/gov/settings" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/15">
            View separation rules
          </Link>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Highest priority</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Source gap meetings</h2>
            </div>
            <Link href="/gov/meetings" className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">
              Meetings
            </Link>
          </div>
          <ul className="mt-5 space-y-3">
            {dashboard.queues.sourceGaps.length ? dashboard.queues.sourceGaps.map((record) => <QueueRow key={record.meetingId} record={record} />) : <li className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">No source gap queue generated.</li>}
          </ul>
        </article>

        <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Retrieval queue</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Remote documents</h2>
            </div>
            <Link href="/gov/documents" className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">
              Documents
            </Link>
          </div>
          <ul className="mt-5 space-y-3">
            {dashboard.queues.retrieval.length ? dashboard.queues.retrieval.map((record) => <RetrievalRow key={record.id ?? record.documentId} record={record} />) : <li className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">No retrieval queue generated.</li>}
          </ul>
        </article>
      </section>
    </GovCrmPageShell>
  );
}
