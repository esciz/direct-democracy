import { SectionHeading } from "@/components/ui/section-heading";
import { readIdentityStore } from "@/lib/identity/storage";
import { requireAdminPage } from "@/lib/admin/permissions";
import { reviewResidencyClaimAction, reviewVoterClaimAction } from "@/app/admin/identity/actions";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-50">{value}</p>
    </div>
  );
}

function redactEmail(email: string) {
  const [localPart = "", domain = ""] = email.split("@");
  return domain ? `${localPart.slice(0, 2) || "**"}***@${domain}` : `${localPart.slice(0, 2) || "**"}***`;
}

function assistantBadgeClass(confidence: string) {
  switch (confidence) {
    case "high":
      return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
    case "medium":
      return "border-amber-300/25 bg-amber-300/10 text-amber-100";
    default:
      return "border-rose-300/25 bg-rose-300/10 text-rose-100";
  }
}

type AdminIdentityPageProps = {
  searchParams?: Promise<{ voterStatus?: string }>;
};

const VOTER_STATUS_FILTERS = [
  { id: "pending", label: "Pending", statuses: ["pending", "pending_manual_review"] },
  { id: "needs_information", label: "Needs info", statuses: ["needs_information"] },
  { id: "matched", label: "Matched", statuses: ["matched"] },
  { id: "rejected", label: "Rejected", statuses: ["rejected"] },
  { id: "all", label: "All", statuses: [] },
] as const;

function claimDateLabel(value: string | null | undefined) {
  if (!value) return "date unavailable";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminIdentityPage({ searchParams }: AdminIdentityPageProps) {
  await requireAdminPage("identity.view");
  const params = searchParams ? await searchParams : {};
  const store = readIdentityStore();
  const residency = store.verificationClaims.filter((claim) => claim.claimType === "residency");
  const voter = store.verificationClaims.filter((claim) => claim.claimType === "voter");
  const accountsById = new Map(store.accounts.map((account) => [account.id, account]));
  const pendingResidencyClaims = residency.filter((claim) => claim.status === "pending" || claim.status === "pending_manual_review");
  const pendingVoterClaims = voter.filter((claim) => claim.status === "pending" || claim.status === "pending_manual_review");
  const activeVoterFilter = VOTER_STATUS_FILTERS.find((filter) => filter.id === params.voterStatus) ?? VOTER_STATUS_FILTERS[0];
  const filteredVoterClaims = activeVoterFilter.id === "all"
    ? voter
    : voter.filter((claim) => activeVoterFilter.statuses.includes(claim.status as never));
  const recentReviewedVoterClaims = voter
    .filter((claim) => !["pending", "pending_manual_review"].includes(claim.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);
  const accountStatuses = countBy(store.accounts.map((account) => account.status));
  const residencyStatuses = countBy(residency.map((claim) => claim.status));
  const voterStatuses = countBy(voter.map((claim) => claim.status));
  const production = readGenerated<{
    status?: string;
    identityStorage?: string;
    operationStorage?: string;
    browserSessionStorage?: string;
    emailProvider?: string;
    mfa?: string;
    evidenceStorage?: string;
    worker?: string;
    queue?: { depth?: number | null; deadLetters?: number | null; staleRunning?: number | null };
    backup?: string;
    restore?: string;
    ownerAdmin?: { passwordRotationRequired?: boolean; passwordRotated?: boolean };
    provenance?: { runId?: string; executionEnvironment?: string };
  }>("production-trust-readiness.json", {});
  const currentEnvironmentAudit = readCurrentEnvironmentAudit<TrustAuditSummary>({});
  const degradedAudit = readLatestDegradedAudit();
  const database = readGenerated<{ connectivity?: { classification?: string }; identity?: { status?: string; ready?: boolean }; checks?: { expiredActiveSessions?: { count?: number | null } | null }; backup?: string; restore?: string }>("database-health-audit.json", {});
  const operationStorage = readGenerated<{ durable?: { status?: string; ready?: boolean } }>("durable-operation-storage-audit.json", {});
  const cutover = readGenerated<{ status?: string; migrations?: { dryRun?: { status?: string } | null; apply?: { status?: string } | null } }>("identity-cutover-audit.json", {});
  const evidencePurge = readGenerated<{ dueForPurge?: number }>("evidence-purge-audit.json", {});
  const evidenceSmoke = readGenerated<{ status?: string; purgeSucceeded?: boolean }>("evidence-storage-smoke-test.json", {});
  const browserSessions = readGenerated<{ status?: string; localRecords?: number; expiredRecords?: number }>("browser-session-storage-audit.json", {});
  const browserSmoke = readGenerated<{ status?: string; revocationRecorded?: boolean }>("browser-session-smoke-test.json", {});
  const workerSmoke = readGenerated<{ status?: string; workerHeartbeatRecorded?: boolean }>("worker-smoke-test.json", {});
  const emailTest = readGenerated<{ status?: string; queuedThroughDurableWorker?: boolean }>("email-test-audit.json", {});

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Public-platform admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Identity and verification</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Review accounts, verification claims, privacy requests, and Trusted Citizen grants. This is public-platform identity administration, not GovCRM.
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Accounts" value={store.accounts.length} />
          <Metric label="Email unverified" value={store.accounts.filter((account) => account.emailVerificationStatus !== "verified").length} />
          <Metric label="MFA enrollment required" value={store.accounts.filter((account) => account.mfaEnrollmentRequired).length} />
          <Metric label="Recent security events" value={store.securityEvents.length} />
          <Metric label="Residency claims" value={residency.length} />
          <Metric label="Voter claims" value={voter.length} />
          <Metric label="Profile claims" value={store.profileClaims.length} />
          <Metric label="Privacy requests" value={store.privacyRequests.length} />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Identity storage" value={production.identityStorage ?? "audit pending"} />
          <Metric label="Canonical trust" value={production.status ?? "audit pending"} />
          <Metric label="Current env audit" value={currentEnvironmentAudit.provenance?.executionEnvironment ?? "audit pending"} />
          <Metric label="Latest degraded" value={degradedAudit?.status ?? "none recorded"} />
          <Metric label="Database" value={database.connectivity?.classification ?? (database.identity?.ready ? "healthy" : database.identity?.status ?? "audit pending")} />
          <Metric label="Operation storage" value={operationStorage.durable?.ready ? "configured" : operationStorage.durable?.status ?? "audit pending"} />
          <Metric label="Active sessions" value={store.sessions.filter((session) => !session.revokedAt).length} />
          <Metric label="Email provider" value={production.emailProvider ?? "audit pending"} />
          <Metric label="Email test" value={emailTest.status ?? "not run"} />
          <Metric label="MFA" value={production.mfa ?? "audit pending"} />
          <Metric label="Evidence storage" value={production.evidenceStorage ?? "audit pending"} />
          <Metric label="Evidence smoke" value={evidenceSmoke.status ?? "not run"} />
          <Metric label="Evidence purge due" value={evidencePurge.dueForPurge ?? 0} />
          <Metric label="Cutover audit" value={cutover.status ?? "audit pending"} />
          <Metric label="Migration apply" value={cutover.migrations?.apply?.status ?? "not applied"} />
          <Metric label="Worker queue" value={production.queue?.depth ?? "audit pending"} />
          <Metric label="Worker smoke" value={workerSmoke.status ?? "not run"} />
          <Metric label="Dead letters" value={production.queue?.deadLetters ?? "audit pending"} />
          <Metric label="Browser sessions" value={browserSessions.status ?? production.browserSessionStorage ?? "audit pending"} />
          <Metric label="Browser smoke" value={browserSmoke.status ?? "not run"} />
          <Metric label="Backups" value={production.backup ?? database.backup ?? "backup_unconfigured"} />
          <Metric label="Restore" value={production.restore ?? database.restore ?? "restore_untested"} />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <SectionHeading eyebrow="Accounts" title="Account states" description="Sensitive identity values are not displayed on this overview." />
            <dl className="mt-4 grid gap-2 text-sm text-slate-300">
              {Object.entries(accountStatuses).map(([status, count]) => <div key={status} className="flex justify-between rounded-xl bg-slate-950/35 p-3"><dt>{status}</dt><dd>{count}</dd></div>)}
            </dl>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <SectionHeading eyebrow="Residency" title="Residency verification queue" description="Exact street addresses and evidence contents are permission-gated and audited elsewhere." />
            <dl className="mt-4 grid gap-2 text-sm text-slate-300">
              {Object.entries(residencyStatuses).map(([status, count]) => <div key={status} className="flex justify-between rounded-xl bg-slate-950/35 p-3"><dt>{status}</dt><dd>{count}</dd></div>)}
            </dl>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <SectionHeading eyebrow="Voters" title="Voter verification queue" description="No live official voter-registration provider is configured. Provider-unconfigured states are shown honestly." />
            <dl className="mt-4 grid gap-2 text-sm text-slate-300">
              {Object.entries(voterStatuses).map(([status, count]) => <div key={status} className="flex justify-between rounded-xl bg-slate-950/35 p-3"><dt>{status}</dt><dd>{count}</dd></div>)}
            </dl>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <SectionHeading eyebrow="Privacy" title="Privacy operations" description="Evidence purge, export, deletion, and consent withdrawal requests are tracked separately from participation data." />
            <div className="mt-4 grid gap-2 text-sm text-slate-300">
              <p className="rounded-xl bg-slate-950/35 p-3">Evidence awaiting deletion: {store.verificationEvidence.filter((evidence) => !evidence.purgedAt).length}</p>
              <p className="rounded-xl bg-slate-950/35 p-3">Consent withdrawals: {store.consentRecords.filter((record) => record.status === "withdrawn").length}</p>
              <p className="rounded-xl bg-slate-950/35 p-3">Trusted Citizen grants: {store.trustedCitizenGrants.length}</p>
              <p className="rounded-xl bg-slate-950/35 p-3">Owner password rotated: {production.ownerAdmin?.passwordRotated ? "yes" : "no"}</p>
              <p className="rounded-xl bg-slate-950/35 p-3">Canonical audit run: {production.provenance?.runId ?? "not promoted"}</p>
              <p className="rounded-xl bg-slate-950/35 p-3">Current audit status: {currentEnvironmentAudit.status ?? "not generated"} ({currentEnvironmentAudit.database?.classification ?? "database not checked"})</p>
              <p className="rounded-xl bg-slate-950/35 p-3">Latest degraded audit: {degradedAudit?.status ?? "none recorded"} ({degradedAudit?.provenance?.executionEnvironment ?? "no environment"})</p>
            </div>
          </div>
        </section>

        <section id="residency-review" className="scroll-mt-28 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <SectionHeading
            eyebrow="Verification review"
            title="Pending residency claims"
            description="Review privacy-preserving residency requests. Raw address evidence is not shown here; approval creates a verified residency claim that can count in stakeholder analytics when privacy thresholds are met."
          />
          <div className="mt-5 space-y-4">
            {pendingResidencyClaims.length ? (
              pendingResidencyClaims.map((claim) => {
                const account = accountsById.get(claim.userId);
                return (
                  <div key={claim.id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{account?.name ?? "Unknown account"}</p>
                        <p className="mt-1 text-xs text-slate-500">{account ? redactEmail(account.email) : claim.userId}</p>
                        <p className="mt-2 text-xs text-slate-400">
                          Jurisdictions: {claim.jurisdictionIds.join(", ") || "not provided"} · Communities: {claim.communityIds.join(", ") || "none"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Evidence disposition: {claim.evidenceDisposition.replaceAll("_", " ")} · Assurance: {claim.assuranceLevel}
                        </p>
                      </div>
                      <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
                        {claim.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <form action={reviewResidencyClaimAction} className="rounded-2xl border border-cyan-300/15 bg-cyan-300/5 p-3">
                        <input type="hidden" name="claimId" value={claim.id} />
                        <input type="hidden" name="decision" value="approve" />
                        <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
                          Approval note
                          <input name="reviewerNotes" placeholder="Optional internal note" className="mt-2 min-h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none" />
                        </label>
                        <button className="mt-3 rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">
                          Approve residency
                        </button>
                      </form>
                      <form action={reviewResidencyClaimAction} className="rounded-2xl border border-rose-300/15 bg-rose-300/5 p-3">
                        <input type="hidden" name="claimId" value={claim.id} />
                        <input type="hidden" name="decision" value="reject" />
                        <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-rose-100">
                          Rejection reason
                          <input name="reviewerNotes" placeholder="Required for a useful rejection" className="mt-2 min-h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none" />
                        </label>
                        <button className="mt-3 rounded-full border border-rose-300/30 px-4 py-2 text-sm font-semibold text-rose-100">
                          Reject request
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-400">
                No residency claims are currently pending manual review.
              </div>
            )}
          </div>
        </section>

        <section id="voter-review" className="scroll-mt-28 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <SectionHeading
            eyebrow="Voter review"
            title="Guided official-portal voter claims"
            description="Review claims submitted after the resident used Nevada's official voter search. Assistant packets triage evidence, but only source-backed matches or reviewer approval can verify a voter claim."
          />
          <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Reviewer checklist</p>
                <h3 className="mt-1 text-base font-semibold text-white">How to verify a guided voter claim</h3>
                <p className="mt-2 max-w-3xl text-cyan-100/80">
                  For Clark and Washoe, exact source-file matches can verify automatically. For Carson City and other non-indexed counties, open the official Nevada voter lookup and compare the submitted fields before approving.
                </p>
              </div>
              <a href="https://www.nvsos.gov/votersearch/" target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">
                Open SOS voter lookup
              </a>
            </div>
            <ol className="mt-4 grid gap-2 text-xs text-cyan-50/90 md:grid-cols-2">
              <li className="rounded-xl bg-slate-950/35 p-3">1. Search the resident in the official lookup.</li>
              <li className="rounded-xl bg-slate-950/35 p-3">2. Confirm the registered name matches the account/person.</li>
              <li className="rounded-xl bg-slate-950/35 p-3">3. Confirm County Voter ID ending, precinct, and county match this packet.</li>
              <li className="rounded-xl bg-slate-950/35 p-3">4. Approve only if status is active or clearly registration-valid; reject or request more info for mismatches.</li>
            </ol>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {VOTER_STATUS_FILTERS.map((filter) => (
              <a
                key={filter.id}
                href={`/admin/identity?voterStatus=${filter.id}#voter-review`}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  activeVoterFilter.id === filter.id
                    ? "border-cyan-300 bg-cyan-300 text-slate-950"
                    : "border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/50"
                }`}
              >
                {filter.label}
              </a>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            {filteredVoterClaims.length ? (
              filteredVoterClaims.map((claim) => {
                const account = accountsById.get(claim.userId);
                const canReview = claim.status === "pending" || claim.status === "pending_manual_review" || claim.status === "needs_information";
                return (
                  <div key={claim.id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{account?.name ?? "Unknown account"}</p>
                        <p className="mt-1 text-xs text-slate-500">{account ? redactEmail(account.email) : claim.userId}</p>
                        <p className="mt-2 text-xs text-slate-400">
                          Provider: {claim.provider.replaceAll("_", " ")} · Jurisdictions: {claim.jurisdictionIds.join(", ") || "not provided"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Evidence disposition: {claim.evidenceDisposition.replaceAll("_", " ")} · Assurance: {claim.assuranceLevel}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Updated: {claimDateLabel(claim.updatedAt)} · Reviewer: {claim.reviewerId ?? "not assigned"}
                        </p>
                        {claim.reviewContext ? (
                          <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
                            <p className="rounded-xl bg-slate-950/50 p-2">Voter ID ending: <span className="font-semibold text-slate-100">{claim.reviewContext.countyVoterIdLast4 ?? "not provided"}</span></p>
                            <p className="rounded-xl bg-slate-950/50 p-2">Precinct: <span className="font-semibold text-slate-100">{claim.reviewContext.electionPrecinct ?? "not provided"}</span></p>
                            <p className="rounded-xl bg-slate-950/50 p-2">County: <span className="font-semibold text-slate-100">{claim.reviewContext.countyOrJurisdiction ?? "not provided"}</span></p>
                          </div>
                        ) : null}
                        {claim.reviewContext?.verificationAssistant ? (
                          <div className="mt-3 rounded-2xl border border-white/10 bg-slate-900/60 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                                {claim.reviewContext.verificationAssistant.outcome.replaceAll("_", " ")}
                              </span>
                              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${assistantBadgeClass(claim.reviewContext.verificationAssistant.confidence)}`}>
                                {claim.reviewContext.verificationAssistant.confidence} confidence
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                                {claim.reviewContext.verificationAssistant.sourceAvailability.replaceAll("_", " ")}
                              </span>
                            </div>
                            <p className="mt-3 text-xs text-slate-400">
                              Recommended action: {claim.reviewContext.verificationAssistant.recommendedAction.replaceAll("_", " ")}
                            </p>
                            <div className="mt-2 grid gap-2 text-xs text-slate-400 lg:grid-cols-2">
                              <p className="rounded-xl bg-slate-950/50 p-2">
                                Signals: {claim.reviewContext.verificationAssistant.extractedSignals.join(", ") || "none"}
                              </p>
                              <p className="rounded-xl bg-slate-950/50 p-2">
                                Missing: {claim.reviewContext.verificationAssistant.missingSignals.join(", ") || "none"}
                              </p>
                            </div>
                            <ul className="mt-2 space-y-1 text-xs text-slate-400">
                              {claim.reviewContext.verificationAssistant.reviewReasons.map((reason) => (
                                <li key={reason}>- {reason}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                      <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
                        {claim.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    {canReview ? (
                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      <form action={reviewVoterClaimAction} className="rounded-2xl border border-cyan-300/15 bg-cyan-300/5 p-3">
                        <input type="hidden" name="claimId" value={claim.id} />
                        <input type="hidden" name="decision" value="approve" />
                        <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
                          Approval note
                          <input name="reviewerNotes" placeholder="Example: SOS lookup confirmed active status, county, precinct, and voter ID ending." className="mt-2 min-h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none" />
                        </label>
                        <button className="mt-3 rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">
                          Approve voter claim
                        </button>
                      </form>
                      <form action={reviewVoterClaimAction} className="rounded-2xl border border-amber-300/15 bg-amber-300/5 p-3">
                        <input type="hidden" name="claimId" value={claim.id} />
                        <input type="hidden" name="decision" value="request_more_info" />
                        <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">
                          Information needed
                          <input name="reviewerNotes" placeholder="Example: Please resubmit with the exact county shown by SOS." className="mt-2 min-h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none" />
                        </label>
                        <button className="mt-3 rounded-full border border-amber-300/30 px-4 py-2 text-sm font-semibold text-amber-100">
                          Request more info
                        </button>
                      </form>
                      <form action={reviewVoterClaimAction} className="rounded-2xl border border-rose-300/15 bg-rose-300/5 p-3">
                        <input type="hidden" name="claimId" value={claim.id} />
                        <input type="hidden" name="decision" value="reject" />
                        <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-rose-100">
                          Rejection reason
                          <input name="reviewerNotes" placeholder="Required for a useful rejection" className="mt-2 min-h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none" />
                        </label>
                        <button className="mt-3 rounded-full border border-rose-300/30 px-4 py-2 text-sm font-semibold text-rose-100">
                          Reject request
                        </button>
                      </form>
                    </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-400">
                        This claim has already been reviewed. The decision remains in the audit trail and the resident can see the current status in claim history.
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-400">
                No guided voter portal claims match the current filter. Approved, rejected, and needs-info decisions remain visible through the filters above.
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <h3 className="text-sm font-semibold text-slate-100">Recently reviewed voter claims</h3>
            <div className="mt-3 grid gap-2">
              {recentReviewedVoterClaims.length ? (
                recentReviewedVoterClaims.map((claim) => {
                  const account = accountsById.get(claim.userId);
                  return (
                    <div key={claim.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.04] p-3 text-xs text-slate-300">
                      <span>{account?.name ?? "Unknown account"} · {account ? redactEmail(account.email) : claim.userId}</span>
                      <span>{claim.status.replaceAll("_", " ")} · {claimDateLabel(claim.updatedAt)}</span>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-xl bg-white/[0.04] p-3 text-sm text-slate-400">No voter review decisions have been recorded yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
