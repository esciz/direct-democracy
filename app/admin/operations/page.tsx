import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";

import { SectionHeading } from "@/components/ui/section-heading";
import { OPERATION_DEFINITIONS } from "@/lib/admin/operations/catalog";
import { listAdminOperations, readOperationLog } from "@/lib/admin/operations/store";
import { requireAdminPage } from "@/lib/admin/permissions";
import { readIdentityStore } from "@/lib/identity/storage";
import { startAdminOperation, retryOperationAction, updateHumanReviewWorkflowAction } from "@/app/admin/operations/actions";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");

function readGenerated<T>(fileName: string, fallback: T): T {
  const filePath = path.join(GENERATED_DIR, fileName);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

type TrustAuditSummary = {
  generatedAt?: string;
  status?: string;
  provenance?: { runId?: string; executionEnvironment?: string };
  database?: { classification?: string };
  failures?: string[];
};

type ReviewWorkflowState = {
  generatedAt?: string;
  records?: Record<string, { itemId: string; reviewType: string; status: string; notes?: string; reviewerName?: string; updatedAt?: string }>;
};

type VoteReviewItem = {
  meeting_item_id: string;
  meeting_id: string;
  title: string;
  source_url: string | null;
  reason: string;
  sourceSnippet?: string;
  outcome?: { raw?: string; sourceSnippet?: string } | null;
};

type AttendanceIdentityRecord = {
  personName: string;
  meetingId: string;
  organizationId: string | null;
  bodyId: string | null;
  attendanceStatus: string;
  votingEligibility: string;
  matchConfidence: string;
  sourceSnippet: string;
};

function currentEnvironmentSlug() {
  if (process.env.CODEX_SANDBOX || process.env.CODEX_SANDBOX_NETWORK_DISABLED) return "codex-sandbox";
  if (process.env.GITHUB_ACTIONS === "true") return "github-actions";
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") return "production";
  return "unknown";
}

function readCurrentEnvironmentAudit<T>(fallback: T): T {
  const filePath = path.join(GENERATED_DIR, `production-trust-readiness.${currentEnvironmentSlug()}.json`);
  if (existsSync(filePath)) return JSON.parse(readFileSync(filePath, "utf8")) as T;
  return fallback;
}

function readLatestDegradedAudit() {
  const candidates = [
    "production-trust-readiness.production.json",
    "production-trust-readiness.github-actions.json",
    "production-trust-readiness.local-network-enabled.json",
    "production-trust-readiness.codex-sandbox.json",
    "production-trust-readiness.unknown.json",
  ]
    .map((fileName) => readGenerated<TrustAuditSummary | null>(fileName, null))
    .filter((audit): audit is TrustAuditSummary => Boolean(audit?.status && audit.status !== "ready"));
  return candidates.sort((a, b) => String(b.generatedAt ?? "").localeCompare(String(a.generatedAt ?? "")))[0] ?? null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString();
}

function Pill({ children, tone = "slate" }: { children: string; tone?: "slate" | "green" | "amber" | "red" | "cyan" }) {
  const tones = {
    slate: "border-white/10 bg-white/5 text-slate-300",
    green: "border-emerald-300/20 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-300/20 bg-amber-500/10 text-amber-200",
    red: "border-rose-300/20 bg-rose-500/10 text-rose-200",
    cyan: "border-cyan-300/20 bg-cyan-500/10 text-cyan-200",
  };
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${tones[tone]}`}>{children}</span>;
}

function summarize(value: string | null | undefined, length = 220) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

function workflowTone(status: string | undefined): "slate" | "green" | "amber" | "red" | "cyan" {
  if (status === "resolved" || status === "reviewed_no_change") return "green";
  if (status === "needs_source" || status === "needs_roster") return "amber";
  if (status === "deferred") return "red";
  return "slate";
}

function ReviewWorkflowForm({ itemId, reviewType, currentStatus, currentNotes }: { itemId: string; reviewType: string; currentStatus?: string; currentNotes?: string }) {
  return (
    <form action={updateHumanReviewWorkflowAction} className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto]">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="reviewType" value={reviewType} />
      <select name="status" defaultValue={currentStatus ?? "pending"} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-100">
        <option value="pending">Pending</option>
        <option value="needs_source">Needs source</option>
        <option value="needs_roster">Needs roster</option>
        <option value="reviewed_no_change">Reviewed no change</option>
        <option value="resolved">Resolved</option>
        <option value="deferred">Deferred</option>
      </select>
      <input name="notes" defaultValue={currentNotes ?? ""} placeholder="Reviewer note" className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-100" />
      <button className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950">Save</button>
    </form>
  );
}

export default async function AdminOperationsPage({ searchParams }: { searchParams?: Promise<{ operation?: string; error?: string }> }) {
  const admin = await requireAdminPage("dataops.view");
  const query = await searchParams;
  const operations = listAdminOperations();
  const identityStore = readIdentityStore();
  const residencyClaims = identityStore.verificationClaims.filter((claim) => claim.claimType === "residency");
  const voterClaims = identityStore.verificationClaims.filter((claim) => claim.claimType === "voter");
  const pendingResidencyClaims = residencyClaims.filter((claim) => claim.status === "pending" || claim.status === "pending_manual_review");
  const pendingVoterClaims = voterClaims.filter((claim) => claim.status === "pending" || claim.status === "pending_manual_review");
  const assistedVoterClaims = voterClaims.filter((claim) => Boolean(claim.reviewContext?.verificationAssistant));
  const selectedOperation = operations.find((operation) => operation.id === query?.operation) ?? operations[0] ?? null;
  const pipeline = readGenerated<{ runId?: string; completedAt?: string; stagesSucceeded?: number; stagesFailed?: number; stagesSkipped?: number; environment?: { networkAvailable?: boolean; networkReason?: string | null }; metrics?: Record<string, number> }>("dataops-pipeline-run.json", {});
  const monitoring = readGenerated<{ audit?: { totals?: Record<string, number> } }>("dataops-monitoring-status.json", {});
  const verification = readGenerated<{ audit?: { totals?: Record<string, number> } }>("public-meeting-content-verification.json", {});
  const ocr = readGenerated<{ audit?: { totals?: Record<string, number> } }>("public-meeting-ocr-audit.json", {});
  const ingestionCoverage = readGenerated<{ totals?: Record<string, number> }>("ingestion-coverage-report.json", {});
  const production = readGenerated<{ status?: string; worker?: string; evidenceStorage?: string; emailProvider?: string; mfa?: string; identityStorage?: string; operationStorage?: string; browserSessionStorage?: string; backup?: string; restore?: string; queue?: { depth?: number | null; running?: number | null; deadLetters?: number | null; staleRunning?: number | null }; provenance?: { runId?: string; executionEnvironment?: string } }>("production-trust-readiness.json", {});
  const trustPlan = readGenerated<{ generatedAt?: string; services?: unknown[] }>("production-trust-services-plan.json", {});
  const emailTest = readGenerated<{ status?: string; queuedThroughDurableWorker?: boolean; productionConfirmed?: boolean }>("email-test-audit.json", {});
  const evidenceSmoke = readGenerated<{ status?: string; storageStatus?: string; purgeSucceeded?: boolean }>("evidence-storage-smoke-test.json", {});
  const browserSmoke = readGenerated<{ status?: string; storageStatus?: string; revocationRecorded?: boolean }>("browser-session-smoke-test.json", {});
  const workerSmoke = readGenerated<{ status?: string; workerHeartbeatRecorded?: boolean }>("worker-smoke-test.json", {});
  const currentEnvironmentAudit = readCurrentEnvironmentAudit<TrustAuditSummary>({});
  const degradedAudit = readLatestDegradedAudit();
  const database = readGenerated<{ connectivity?: { classification?: string }; identity?: { status?: string; ready?: boolean }; operations?: { status?: string; ready?: boolean }; backup?: string; restore?: string }>("database-health-audit.json", {});
  const operationStorage = readGenerated<{ durable?: { status?: string; ready?: boolean }; localDevelopmentStore?: { records?: number; staleRecords?: number } }>("durable-operation-storage-audit.json", {});
  const browserSessionStorage = readGenerated<{ status?: string; localRecords?: number; expiredRecords?: number }>("browser-session-storage-audit.json", {});
  const workerQueue = readGenerated<{ worker?: { queueDepth?: number | null; runningJobs?: number | null; deadLetters?: number | null; staleRunningJobs?: number | null } }>("worker-queue-audit.json", {});
  const officialsCoverage = readGenerated<{ generatedAt?: string; totals?: Record<string, number>; failures?: string[] }>("officials-coverage-audit.json", {});
  const officialsHealth = readGenerated<{ generatedAt?: string; records?: Array<{ sourceId?: string; retrievalStatus?: string; sourceHealth?: string; cachedPath?: string | null; contentHash?: string | null; lastCheckedAt?: string | null; lastChangedAt?: string | null; nextDueAt?: string | null }>; audit?: { totals?: Record<string, number> }; canonicalPromotion?: { promotedAt?: string; promotedFromRunId?: string } | null }>("officials-source-health.json", {});
  const officialsEvidence = readGenerated<{ runId?: string; generatedAt?: string; totals?: Record<string, number>; provenance?: { executionEnvironment?: string; networkCapability?: string } }>("carson-city-officials-source-evidence.json", {});
  const githubNetworkWorker = readGenerated<{ status?: string; workflow?: { workflowFilename?: string; protectedPromotionJobPresent?: boolean; artifactHandoffPresent?: boolean; workflowInputsAllowlisted?: boolean }; persistenceMode?: { defaultWhenDurableStorageMissing?: string } }>("github-network-worker-audit.json", {});
  const officialsReconciliation = readGenerated<{ generatedAt?: string; parser?: { recordsParsed?: number; reviewQueueRecords?: number }; promotion?: { eligible?: boolean; status?: string; blockers?: string[] } }>("carson-city-officials-source-reconciliation.json", {});
  const officialsPromotion = readGenerated<{ status?: string; recordsPromoted?: number; promotedAt?: string | null; promotedFromRunId?: string | null; conflictsRemaining?: number; blockers?: string[] }>("carson-city-officials-promotion-audit.json", {});
  const citizenActionAudit = readGenerated<{ status?: string; generatedAt?: string; totals?: { sourceBackedDecisionsAvailable?: number; sourceBackedProjectsAvailable?: number; pendingResidentConcerns?: number; concernEntryPoints?: number }; failures?: string[] }>("citizen-action-loop-audit.json", {});
  const sprint2Readiness = readGenerated<{ status?: string; recommendation?: string; gates?: { voteAttribution?: Record<string, any>; attendanceIdentity?: Record<string, any>; documents?: Record<string, any>; sourceAdapters?: Record<string, any>; officials?: Record<string, any> }; remainingWork?: Array<{ bucket: string; count: number; nextAction: string }> }>("sprint-2-readiness-report.json", {});
  const voteReviewAudit = readGenerated<{ totals?: Record<string, number>; ambiguousVoteActions?: VoteReviewItem[]; attendanceReviewActions?: VoteReviewItem[]; distributionReviewActions?: VoteReviewItem[] }>("public-meeting-vote-extraction-audit.json", {});
  const attendanceIdentity = readGenerated<{ records?: AttendanceIdentityRecord[] }>("public-meeting-attendance.json", { records: [] });
  const reviewWorkflowState = readGenerated<ReviewWorkflowState>("human-review-workflow-state.json", {});
  const carsonSources = officialsHealth.records?.filter((record) => String(record.sourceId ?? "").startsWith("carson-city")) ?? [];
  const latestSourceHash = carsonSources.map((record) => record.contentHash).filter(Boolean).at(-1);
  const nextOfficialsRefresh = carsonSources.map((record) => record.nextDueAt).filter(Boolean).sort()[0];
  const officialsPromotionStatus = officialsPromotion.status ?? (officialsHealth.canonicalPromotion?.promotedAt ? "promoted" : "not_promoted");
  const stdoutPreview = selectedOperation?.stdoutPath ? readOperationLog(selectedOperation.stdoutPath).slice(-2000) : "";
  const stderrPreview = selectedOperation?.stderrPath ? readOperationLog(selectedOperation.stderrPath).slice(-2000) : "";
  const reviewState = reviewWorkflowState.records ?? {};
  const voteReviewItems = [
    ...(voteReviewAudit.ambiguousVoteActions ?? []).map((item) => ({ ...item, reviewType: "ambiguous_vote", bucket: "Ambiguous vote" })),
    ...(voteReviewAudit.attendanceReviewActions ?? []).map((item) => ({ ...item, reviewType: "attendance_review", bucket: "Attendance review" })),
    ...(voteReviewAudit.distributionReviewActions ?? []).map((item) => ({ ...item, reviewType: "distribution_review", bucket: "Distribution review" })),
  ];
  const identityBuckets = Array.from(
    (attendanceIdentity.records ?? [])
      .filter((record) => record.matchConfidence === "unmatched_name" && record.votingEligibility === "eligible_voting_member")
      .reduce((map, record) => {
        const key = `${record.personName}|${record.organizationId ?? "unknown"}|${record.attendanceStatus}`;
        const current = map.get(key) ?? { itemId: `identity-${key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, personName: record.personName, organizationId: record.organizationId ?? "unknown", attendanceStatus: record.attendanceStatus, count: 0, sample: record.sourceSnippet };
        current.count += 1;
        map.set(key, current);
        return map;
      }, new Map<string, { itemId: string; personName: string; organizationId: string; attendanceStatus: string; count: number; sample: string }>())
      .values(),
  ).sort((left, right) => right.count - left.count || left.personName.localeCompare(right.personName));
  const reviewedWorkflowCount = Object.values(reviewState).filter((record) => record.status && record.status !== "pending").length;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Platform admin</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Operations console</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Unified control plane for source discovery, retrieval, cache verification, OCR, reprocessing, reviews, and runtime artifact generation. This surface belongs to public platform admin, not GovCRM.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Signed in admin</p>
              <p className="mt-2 font-semibold text-slate-100">{admin.name}</p>
              <p className="text-xs text-slate-500">{admin.role}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Pending residency", pendingResidencyClaims.length],
            ["Pending voter claims", pendingVoterClaims.length],
            ["Assisted voter packets", assistedVoterClaims.length],
            ["Sources monitored", monitoring.audit?.totals?.sourcesMonitored ?? 0],
            ["Sources due/queued", monitoring.audit?.totals?.queuedRetrievals ?? 0],
            ["Cache records", verification.audit?.totals?.cacheRecords ?? 0],
            ["Verified PDFs", verification.audit?.totals?.verifiedPdf ?? 0],
            ["Quarantined", verification.audit?.totals?.quarantined ?? 0],
            ["OCR candidates", ocr.audit?.totals?.ocrRequired ?? 0],
            ["Pipeline failures", pipeline.stagesFailed ?? 0],
            ["Ingestion covered", ingestionCoverage.totals?.sourcesWithAcquisitionMode ?? 0],
            ["Worker", production.worker ?? "worker_unconfigured"],
            ["Worker smoke", workerSmoke.status ?? "not run"],
            ["Canonical trust", production.status ?? "audit_pending"],
            ["Trust plan", trustPlan.generatedAt ? `${trustPlan.services?.length ?? 0} services` : "not generated"],
            ["Current audit env", currentEnvironmentAudit.provenance?.executionEnvironment ?? "audit_pending"],
            ["Latest degraded", degradedAudit?.status ?? "none_recorded"],
            ["Email", production.emailProvider ?? "email_provider_unconfigured"],
            ["Email test", emailTest.status ?? "not run"],
            ["MFA", production.mfa ?? "mfa_encryption_unconfigured"],
            ["Evidence", production.evidenceStorage ?? "storage_unconfigured"],
            ["Evidence smoke", evidenceSmoke.status ?? "not run"],
            ["Database", database.connectivity?.classification ?? (database.identity?.ready ? "healthy" : database.identity?.status ?? "audit_pending")],
            ["Operation storage", operationStorage.durable?.ready ? "configured" : operationStorage.durable?.status ?? "audit_pending"],
            ["Queue depth", production.queue?.depth ?? workerQueue.worker?.queueDepth ?? "audit_pending"],
            ["Dead letters", production.queue?.deadLetters ?? workerQueue.worker?.deadLetters ?? "audit_pending"],
            ["Stale jobs", production.queue?.staleRunning ?? workerQueue.worker?.staleRunningJobs ?? "audit_pending"],
            ["Browser sessions", browserSessionStorage.status ?? production.browserSessionStorage ?? "audit_pending"],
            ["Browser smoke", browserSmoke.status ?? "not run"],
            ["Backups", production.backup ?? database.backup ?? "backup_unconfigured"],
            ["Restore", production.restore ?? database.restore ?? "restore_untested"],
            ["Current officials", officialsCoverage.totals?.runtimeOfficials ?? "audit_pending"],
            ["Officials sources", officialsHealth.audit?.totals?.sources ?? "audit_pending"],
            ["Officials cache", officialsHealth.audit?.totals?.withCachedHtml ?? "audit_pending"],
            ["Officials promotion", officialsPromotionStatus],
            ["Officials reviews", officialsReconciliation.parser?.reviewQueueRecords ?? "audit_pending"],
            ["GitHub worker", githubNetworkWorker.status ?? "audit_pending"],
            ["Officials gaps", officialsCoverage.totals?.emptyPublicSectionRisks ?? "audit_pending"],
            ["Officials failures", officialsCoverage.totals?.failures ?? 0],
            ["Action loop", citizenActionAudit.status ?? "audit_pending"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Identity verification workflow</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Residency and voter registration review</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Approve privacy-preserving residency claims and guided voter-registration packets. Voter approval is review-gated unless an imported official voter file produced an exact source match.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Pill tone={pendingResidencyClaims.length ? "amber" : "green"}>{`${pendingResidencyClaims.length} residency pending`}</Pill>
                <Pill tone={pendingVoterClaims.length ? "amber" : "green"}>{`${pendingVoterClaims.length} voter pending`}</Pill>
                <Pill tone={assistedVoterClaims.length ? "cyan" : "slate"}>{`${assistedVoterClaims.length} assisted packets`}</Pill>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/identity#voter-review" className="inline-flex w-fit rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950">
                Review voter claims
              </Link>
              <Link href="/admin/identity" className="inline-flex w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100">
                Open identity dashboard
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Participation QA</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Real vs demo civic signal</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Review verified participation, QA fixtures, demo seed responses, and official-facing aggregate suppression before any stakeholder analytics are trusted.
              </p>
            </div>
            <Link href="/admin/participation" className="inline-flex w-fit rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">
              Open participation QA
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Private beta</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Tester feedback review</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Review private-link tester reports for broken flows, confusing copy, stale data, and account-verification issues before wider sharing.
              </p>
            </div>
            <Link href="/admin/private-beta-feedback" className="inline-flex w-fit rounded-full bg-sky-300 px-4 py-2 text-sm font-semibold text-slate-950">
              Open feedback queue
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">Citizen action loops</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Watchlists, questions, and resident concerns</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Residents can follow source-backed decisions, projects, meetings, issues, and communities, then submit questions or concerns into the moderated resident-story queue.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Pill tone={citizenActionAudit.status === "passed" ? "green" : "amber"}>{citizenActionAudit.status ?? "audit pending"}</Pill>
                <Pill tone="cyan">{`${citizenActionAudit.totals?.sourceBackedDecisionsAvailable ?? 0} decisions available`}</Pill>
                <Pill tone="cyan">{`${citizenActionAudit.totals?.sourceBackedProjectsAvailable ?? 0} projects available`}</Pill>
                <Pill tone={citizenActionAudit.totals?.pendingResidentConcerns ? "amber" : "green"}>{`${citizenActionAudit.totals?.pendingResidentConcerns ?? 0} concerns pending`}</Pill>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/cases/resident-intake" className="inline-flex w-fit rounded-full bg-violet-300 px-4 py-2 text-sm font-semibold text-slate-950">
                Review concerns
              </Link>
              <Link href="/profile" className="inline-flex w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100">
                Open watchlist
              </Link>
            </div>
          </div>
        </section>

        <section id="human-review" className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionHeading
              eyebrow="Human review"
              title="Vote attribution and identity quality"
              description="Triage the remaining human-review queue without mutating generated source evidence. Saved decisions are stored as an admin workflow overlay."
            />
            <div className="flex flex-wrap gap-2">
              <Pill tone={sprint2Readiness.status === "green" ? "green" : sprint2Readiness.status === "yellow" ? "amber" : "red"}>{sprint2Readiness.status ?? "not run"}</Pill>
              <Pill tone={reviewedWorkflowCount ? "cyan" : "slate"}>{`${reviewedWorkflowCount} triaged`}</Pill>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Remaining review", voteReviewAudit.totals?.remainingUnresolvedVoteActions ?? 0],
              ["Ambiguous", voteReviewAudit.ambiguousVoteActions?.length ?? 0],
              ["Attendance", voteReviewAudit.attendanceReviewActions?.length ?? 0],
              ["Distribution", voteReviewAudit.distributionReviewActions?.length ?? 0],
              ["Unmatched voting names", sprint2Readiness.gates?.attendanceIdentity?.unmatchedVotingMemberNames ?? identityBuckets.reduce((sum, row) => sum + row.count, 0)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-50">{value}</p>
              </div>
            ))}
          </div>

          {sprint2Readiness.recommendation ? <p className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-500/10 p-3 text-sm leading-6 text-emerald-100">{sprint2Readiness.recommendation}</p> : null}

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-50">Vote review queue</h2>
                <p className="text-xs text-slate-500">{voteReviewItems.length} item{voteReviewItems.length === 1 ? "" : "s"}</p>
              </div>
              {voteReviewItems.length ? voteReviewItems.slice(0, 12).map((item) => {
                const state = reviewState[item.meeting_item_id];
                const snippet = item.outcome?.sourceSnippet ?? item.sourceSnippet ?? item.outcome?.raw ?? "";
                return (
                  <article key={`${item.reviewType}-${item.meeting_item_id}`} className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={item.reviewType === "distribution_review" ? "amber" : item.reviewType === "attendance_review" ? "cyan" : "red"}>{item.bucket}</Pill>
                          <Pill tone={workflowTone(state?.status)}>{state?.status?.replaceAll("_", " ") ?? "pending"}</Pill>
                        </div>
                        <h3 className="mt-3 text-sm font-semibold leading-6 text-slate-100">{summarize(item.title, 180)}</h3>
                      </div>
                      {item.source_url ? <a href={item.source_url} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100">Source</a> : null}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-400">{summarize(snippet, 360)}</p>
                    <p className="mt-2 text-xs text-amber-100">Reason: {item.reason}</p>
                    {state?.updatedAt ? <p className="mt-2 text-xs text-slate-500">Last triaged by {state.reviewerName ?? "admin"} · {formatDate(state.updatedAt)}</p> : null}
                    <ReviewWorkflowForm itemId={item.meeting_item_id} reviewType={item.reviewType} currentStatus={state?.status} currentNotes={state?.notes} />
                  </article>
                );
              }) : <p className="rounded-xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-400">No vote attribution review items remain.</p>}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-50">Identity quality</h2>
                <p className="text-xs text-slate-500">Top unmatched voting-member names</p>
              </div>
              {identityBuckets.length ? identityBuckets.slice(0, 12).map((item) => {
                const state = reviewState[item.itemId];
                return (
                  <article key={item.itemId} className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-100">{item.personName}</h3>
                        <p className="mt-1 text-xs text-slate-500">{item.organizationId} · {item.attendanceStatus} · {item.count} occurrence{item.count === 1 ? "" : "s"}</p>
                      </div>
                      <Pill tone={workflowTone(state?.status)}>{state?.status?.replaceAll("_", " ") ?? "pending"}</Pill>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-400">{summarize(item.sample, 260)}</p>
                    <ReviewWorkflowForm itemId={item.itemId} reviewType="identity_quality" currentStatus={state?.status} currentNotes={state?.notes} />
                  </article>
                );
              }) : <p className="rounded-xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-400">No unmatched eligible voting-member names remain.</p>}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <SectionHeading eyebrow="Run now" title="Allowlisted operations" description="Admins submit operation IDs and validated parameters only. Arbitrary shell commands and workflow names are rejected." />
            <div className="mt-5 space-y-4">
              {OPERATION_DEFINITIONS.map((definition) => (
                <form key={definition.id} action={startAdminOperation} className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
                  <input type="hidden" name="operationType" value={definition.id} />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-50">{definition.label}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-400">{definition.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Pill tone={definition.backend === "local_process" ? "green" : "amber"}>{definition.backend.replaceAll("_", " ")}</Pill>
                        <Pill>{definition.productionAvailability.replaceAll("_", " ")}</Pill>
                        {definition.requiresNetwork ? <Pill tone="amber">network</Pill> : <Pill tone="green">offline ok</Pill>}
                      </div>
                    </div>
                    <button className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">Run</button>
                  </div>
                  {definition.allowedArgs.length ? (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {definition.allowedArgs.slice(0, 6).map((arg) => (
                        <label key={arg} className="text-xs text-slate-400">
                          {arg}
                          <input name={arg} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" placeholder={arg.includes("only") || arg === "offline" || arg === "force" ? "true/on for flag" : ""} />
                        </label>
                      ))}
                    </div>
                  ) : null}
                </form>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <SectionHeading eyebrow="Current run" title="Pipeline and backend status" description="Production worker and durable storage are explicit readiness states, not implied." />
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <p>Pipeline run: <span className="text-slate-100">{pipeline.runId ?? "No run artifact"}</span></p>
                <p>Canonical trust audit: <span className="text-slate-100">{production.status ?? "audit pending"}</span> · {production.provenance?.runId ?? "no promoted run"}</p>
                <p>Trust-service plan: <span className="text-slate-100">{trustPlan.generatedAt ? `${trustPlan.services?.length ?? 0} services` : "not generated"}</span></p>
                <p>Current-environment audit: <span className="text-slate-100">{currentEnvironmentAudit.status ?? "not generated"}</span> · {currentEnvironmentAudit.provenance?.executionEnvironment ?? "unknown environment"}</p>
                <p>Latest degraded audit: <span className="text-slate-100">{degradedAudit?.status ?? "none recorded"}</span> · {degradedAudit?.provenance?.executionEnvironment ?? "no environment"}</p>
                <p>Completed: {formatDate(pipeline.completedAt)}</p>
                <p>Network: {pipeline.environment?.networkAvailable ? "available" : "unavailable"} {pipeline.environment?.networkReason ? `· ${pipeline.environment.networkReason}` : ""}</p>
                <p>Worker backend: <span className="text-amber-200">{production.worker ?? "worker_unconfigured"}</span></p>
                <p>Identity storage: <span className="text-amber-200">{production.identityStorage ?? "durable_identity_storage_unconfigured"}</span></p>
                <p>Operation storage: <span className="text-amber-200">{operationStorage.durable?.status ?? production.operationStorage ?? "durable_operations_unconfigured"}</span></p>
                <p>Database diagnostic: <span className="text-amber-200">{database.connectivity?.classification ?? "audit pending"}</span></p>
                <p>Queue: <span className="text-slate-100">{production.queue?.depth ?? workerQueue.worker?.queueDepth ?? 0}</span> queued · <span className="text-slate-100">{production.queue?.deadLetters ?? workerQueue.worker?.deadLetters ?? 0}</span> dead letters</p>
                <p>Local operation records: <span className="text-slate-100">{operationStorage.localDevelopmentStore?.records ?? operations.length}</span></p>
                <p>Stale operation records: <span className="text-slate-100">{operationStorage.localDevelopmentStore?.staleRecords ?? 0}</span></p>
                <p>Email provider: <span className="text-amber-200">{production.emailProvider ?? "email_provider_unconfigured"}</span></p>
                <p>Latest email test: <span className="text-amber-200">{emailTest.status ?? "not run"}</span> · durable worker {emailTest.queuedThroughDurableWorker ? "yes" : "no"} · confirmed {emailTest.productionConfirmed ? "yes" : "no"}</p>
                <p>Evidence storage: <span className="text-amber-200">{production.evidenceStorage ?? "verification_evidence_storage_unconfigured"}</span></p>
                <p>Latest evidence smoke: <span className="text-amber-200">{evidenceSmoke.status ?? "not run"}</span> · storage {evidenceSmoke.storageStatus ?? "unknown"} · purge {evidenceSmoke.purgeSucceeded ? "yes" : "no"}</p>
                <p>Browser session storage: <span className="text-amber-200">{browserSessionStorage.status ?? production.browserSessionStorage ?? "browser_session_storage_unconfigured"}</span></p>
                <p>Latest browser-session smoke: <span className="text-amber-200">{browserSmoke.status ?? "not run"}</span> · storage {browserSmoke.storageStatus ?? "unknown"} · revoked {browserSmoke.revocationRecorded ? "yes" : "no"}</p>
                <p>Latest worker smoke: <span className="text-amber-200">{workerSmoke.status ?? "not run"}</span> · heartbeat {workerSmoke.workerHeartbeatRecorded ? "yes" : "no"}</p>
                <p>Officials coverage: <span className={officialsCoverage.failures?.length ? "text-rose-200" : "text-emerald-200"}>{officialsCoverage.failures?.length ? `${officialsCoverage.failures.length} failure(s)` : officialsCoverage.generatedAt ? "guard passing" : "audit pending"}</span></p>
                <p>Carson City officials: <span className="text-slate-100">{officialsCoverage.totals?.carsonCityRuntimeOfficials ?? "audit pending"}</span> current runtime records</p>
                <p>Carson source evidence: <span className="text-slate-100">{officialsEvidence.runId ?? "not retrieved"}</span> · {officialsEvidence.provenance?.executionEnvironment ?? "unknown env"} · {officialsEvidence.provenance?.networkCapability ?? "unknown network"}</p>
                <p>Carson cached official sources: <span className="text-slate-100">{officialsEvidence.totals?.cachedFiles ?? officialsHealth.audit?.totals?.withCachedHtml ?? 0}</span> · latest hash <span className="text-slate-100">{latestSourceHash ? `${latestSourceHash.slice(0, 12)}...` : "none"}</span></p>
                <p>Carson reconciliation: <span className={officialsReconciliation.promotion?.eligible ? "text-emerald-200" : "text-amber-200"}>{officialsReconciliation.promotion?.status ?? "not run"}</span> · parsed {officialsReconciliation.parser?.recordsParsed ?? 0} · review {officialsReconciliation.parser?.reviewQueueRecords ?? 0}</p>
                <p>Canonical officials promotion: <span className={officialsPromotion.status === "promoted" ? "text-emerald-200" : "text-amber-200"}>{officialsPromotion.status ?? (officialsHealth.canonicalPromotion ? "promoted" : "not promoted")}</span> · records {officialsPromotion.recordsPromoted ?? "pending"} · run {officialsPromotion.promotedFromRunId ?? officialsHealth.canonicalPromotion?.promotedFromRunId ?? "none"}</p>
                <p>GitHub officials worker: <span className={githubNetworkWorker.status === "passed" ? "text-emerald-200" : "text-amber-200"}>{githubNetworkWorker.status ?? "audit pending"}</span> · protected promotion {githubNetworkWorker.workflow?.protectedPromotionJobPresent ? "configured" : "pending"} · persistence {githubNetworkWorker.persistenceMode?.defaultWhenDurableStorageMissing ?? "unknown"}</p>
                <p>Next officials refresh: <span className="text-slate-100">{formatDate(nextOfficialsRefresh)}</span></p>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <SectionHeading eyebrow="Officials" title="Carson City source evidence" description="Generated artifacts expose status, hashes, and review counts only. Raw official-directory HTML stays in the private cache." />
              <div className="mt-4 space-y-3">
                {carsonSources.length ? carsonSources.map((source) => (
                  <div key={source.sourceId} className="rounded-xl border border-white/10 bg-slate-950/35 p-3 text-sm text-slate-300">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-slate-100">{source.sourceId}</p>
                      <Pill tone={source.cachedPath ? "green" : source.sourceHealth === "blocked" ? "amber" : "slate"}>{source.sourceHealth ?? source.retrievalStatus ?? "unknown"}</Pill>
                    </div>
                    <p className="mt-2">Checked: {formatDate(source.lastCheckedAt)} · Changed: {formatDate(source.lastChangedAt)}</p>
                    <p className="mt-1 text-xs text-slate-500">Hash: {source.contentHash ? `${source.contentHash.slice(0, 20)}...` : "No verified cached source yet"}</p>
                  </div>
                )) : <p className="text-sm text-slate-400">No Carson City official source-health records are available yet.</p>}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <SectionHeading eyebrow="History" title="Operation records" description="Local filesystem operation records are development-only until a database or durable worker is configured." />
              <div className="mt-4 space-y-3">
                {operations.length ? operations.slice(0, 12).map((operation) => (
                  <div key={operation.id} className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-100">{operation.operationType}</p>
                        <p className="text-xs text-slate-500">{operation.actorUserId} · {formatDate(operation.createdAt)}</p>
                      </div>
                      <Pill tone={operation.status === "succeeded" ? "green" : operation.status === "failed" ? "red" : operation.status === "blocked_by_environment" ? "amber" : "slate"}>{operation.status}</Pill>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{operation.progressSummary}</p>
                    {operation.status === "failed" || operation.status === "blocked_by_environment" ? (
                      <form action={retryOperationAction} className="mt-3">
                        <input type="hidden" name="operationId" value={operation.id} />
                        <button className="text-xs font-semibold text-cyan-200">Retry linked operation</button>
                      </form>
                    ) : null}
                  </div>
                )) : <p className="text-sm text-slate-400">No admin operations have been recorded yet.</p>}
              </div>
            </section>

            {selectedOperation ? (
              <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <SectionHeading eyebrow="Sanitized logs" title={selectedOperation.operationType} description="Log preview is redacted and truncated. Raw logs are not public." />
                <pre className="mt-4 max-h-72 overflow-auto rounded-xl border border-white/10 bg-slate-950 p-3 text-xs leading-5 text-slate-300">{stdoutPreview || stderrPreview || "No log output recorded."}</pre>
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
