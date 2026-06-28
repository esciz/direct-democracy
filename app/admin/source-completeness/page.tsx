import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type OrganizationReport = {
  organizationId: string;
  bodyName: string;
  jurisdiction: string | null;
  meetingsImported: number;
  agendas: number;
  packets: number;
  minutes: number;
  attendanceCoverage: number;
  voteCoverage: number;
  namedVoteCoverage: number;
  aggregateVoteCoverage: number;
  readinessScore: number;
};

type ReadinessArtifact = {
  generatedAt: string;
  records: Array<{
    meetingId: string;
    bodyName: string;
    jurisdiction: string | null;
    meetingDate: string;
    hasAttendance: boolean;
    hasVoteOutcome: boolean;
    blockedReason: string[];
  }>;
  organizationReports: OrganizationReport[];
  audit: {
    totals: Record<string, number>;
    sourceTypeCounts: Record<string, number>;
  };
};

type RosterAudit = {
  bodyReports?: Array<{
    label: string;
    organizationId: string;
    covered: boolean;
    votingMembers: number;
    unmatchedMembers: number;
    blocker: string | null;
  }>;
};

type AttendanceArtifact = {
  records?: Array<{
    meetingId: string;
    personName: string;
    bodyId: string | null;
    organizationId: string | null;
    attendanceStatus: string;
    votingEligibility: string;
    matchConfidence: string;
    sourceDocument: string | null;
    reason: string;
  }>;
};

type VoteAudit = {
  attendanceReviewActions?: Array<{ meeting_id: string; title: string; reason: string; source_url?: string | null }>;
  distributionReviewActions?: Array<{ meeting_id: string; title: string; reason: string; source_url?: string | null }>;
};

type MinutesAudit = {
  records?: Array<{
    meetingId: string;
    bodyName: string;
    jurisdiction: string | null;
    meetingDate: string | null;
    extractionQuality: string;
    hasAttendanceSection: boolean;
    hasRollCall: boolean;
    hasActionResult: boolean;
    hasVoteCount: boolean;
    cachedSourceTooThin: boolean;
    sourceSnippet: string;
  }>;
};

type ActionResultsAudit = {
  totals?: Record<string, number>;
};

type ActionResultsArtifact = {
  records?: Array<{
    id: string;
    meetingId: string;
    meetingItemId: string;
    actionTitle: string;
    agendaItemId: string | null;
    sourceUrl?: string | null;
    needsReview: boolean;
    reviewReason: string | null;
  }>;
};

type DocumentAudit = {
  totals?: Record<string, number>;
  officialScorecardsSafe?: boolean;
  blocker?: string | null;
  topReviewQueues?: {
    sourceGaps?: Array<{ meetingId: string; bodyName: string; jurisdiction: string | null; recommendedNextAction: string; missingFields: string[] }>;
    parserGaps?: Array<{ meetingId: string; bodyName: string; jurisdiction: string | null; recommendedNextAction: string; missingFields: string[] }>;
    missingAttendance?: Array<{ meetingId: string; bodyName: string; jurisdiction: string | null; recommendedNextAction: string; missingFields: string[] }>;
  };
};

type RetrievalAudit = {
  audit?: { totals?: Record<string, number> };
};

type SourceHealth = {
  sourceHealth?: Array<{
    organizationId: string | null;
    jurisdiction: string | null;
    sourcePlatform: string;
    sourceHost: string | null;
    documents: number;
    queued: number;
    cached: number;
    extracted: number;
    ocrRequired: number;
    failed: number;
    sourceGaps: number;
    retrievalHealth: number;
    extractionHealth: number;
    ocrHealth: number;
  }>;
};

type OcrAudit = {
  audit?: {
    runtime?: { tesseractAvailable?: boolean; pdftoppmAvailable?: boolean; ocrAvailable?: boolean };
    totals?: Record<string, number>;
  };
};

type TrustAudit = {
  totals?: Record<string, number>;
  participationPolicy?: { noVoteWeighting?: boolean; residentAndVoterRightsEqual?: boolean; segmentationOnly?: string[] };
};

type DataopsMonitoring = {
  records?: Array<{
    sourceId: string;
    sourceOwner: string;
    jurisdiction: string | null;
    sourceCategory: string;
    sourcePlatform: string;
    sourceHost: string | null;
    nextCheckAt: string | null;
    healthStatus: string;
    freshnessStatus: string;
    failureReason: string | null;
    documentCounts: {
      discovered: number;
      queued: number;
      cached: number;
      extracted: number;
      ocrRequired: number;
      failed: number;
    };
  }>;
  audit?: { totals?: Record<string, number> };
};

type RetrievalRun = {
  audit?: { totals?: Record<string, number> };
};

type CacheAudit = {
  totals?: Record<string, number>;
};

type PipelineRun = {
  runId?: string;
  completedAt?: string;
  environment?: { networkAvailable?: boolean; networkReason?: string | null; offline?: boolean };
  stagesFailed?: number;
  stagesSkipped?: number;
  metrics?: Record<string, number>;
  stages?: Array<{ id: string; status: string; error: string | null; durationMs: number }>;
};

type ContentVerification = {
  audit?: { totals?: Record<string, number> };
};

type OcrResults = {
  audit?: { totals?: Record<string, number> };
};

type FreshnessAudit = {
  totals?: Record<string, number>;
};

type CacheManifest = {
  audit?: {
    totals?: Record<string, number | boolean>;
    retentionPolicy?: {
      commitBinaryCacheToGit?: boolean;
      recommendedDurableStorage?: string;
      operatorCommands?: Record<string, string>;
    };
  };
};

type CacheStorageAudit = {
  generatedAt?: string;
  status?: string;
  backend?: string;
  storageRootFingerprint?: string | null;
  bucketConfigured?: boolean;
  totals?: Record<string, number>;
  operatorCommands?: Record<string, string>;
};

type SourceWaitReport = {
  generatedAt?: string;
  stage?: string;
  totals?: Record<string, number>;
  byJurisdiction?: Array<{ key: string; count: number }>;
  byBody?: Array<{ key: string; count: number }>;
};

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");

function readGenerated<T>(fileName: string, fallback: T): T {
  const filePath = path.join(GENERATED_DIR, fileName);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function readReadiness(): ReadinessArtifact | null {
  return readGenerated<ReadinessArtifact | null>("vote-attribution-readiness.json", null);
}

function BlockerList({ title, description, items }: { title: string; description: string; items: Array<{ id: string; title: string; detail: string; href?: string | null }> }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-slate-200">{items.length}</span>
      </div>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.slice(0, 8).map((item) => {
            const content = (
              <>
                <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
              </>
            );
            return item.href ? (
              <a key={item.id} href={item.href} target="_blank" rel="noreferrer" className="block rounded-xl border border-white/10 bg-slate-950/35 p-3 hover:border-cyan-300/25">
                {content}
              </a>
            ) : (
              <div key={item.id} className="rounded-xl border border-white/10 bg-slate-950/35 p-3">{content}</div>
            );
          })
        ) : (
          <p className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">No current blockers in this category.</p>
        )}
      </div>
    </div>
  );
}

export default function SourceCompletenessPage() {
  const readiness = readReadiness();
  const reports = readiness?.organizationReports ?? [];
  const rosterAudit = readGenerated<RosterAudit>("governing-body-roster-audit.json", {});
  const attendanceArtifact = readGenerated<AttendanceArtifact>("public-meeting-attendance.json", { records: [] });
  const voteAudit = readGenerated<VoteAudit>("public-meeting-vote-extraction-audit.json", {});
  const minutesAudit = readGenerated<MinutesAudit>("minutes-extraction-audit.json", { records: [] });
  const actionResultsArtifact = readGenerated<ActionResultsArtifact>("public-meeting-action-results.json", { records: [] });
  const actionResultsAudit = readGenerated<ActionResultsAudit>("public-meeting-action-results-audit.json", {});
  const documentAudit = readGenerated<DocumentAudit>("public-meeting-document-audit.json", {});
  const retrievalAudit = readGenerated<RetrievalAudit>("public-meeting-retrieval-queue.json", {});
  const sourceHealth = readGenerated<SourceHealth>("public-meeting-source-health.json", { sourceHealth: [] });
  const ocrAudit = readGenerated<OcrAudit>("public-meeting-ocr-audit.json", {});
  const trustAudit = readGenerated<TrustAudit>("trust-foundation-audit.json", {});
  const dataopsMonitoring = readGenerated<DataopsMonitoring>("dataops-monitoring-status.json", { records: [] });
  const retrievalRun = readGenerated<RetrievalRun>("dataops-retrieval-run.json", {});
  const cacheAudit = readGenerated<CacheAudit>("public-meeting-document-cache-audit.json", {});
  const pipelineRun = readGenerated<PipelineRun>("dataops-pipeline-run.json", {});
  const contentVerification = readGenerated<ContentVerification>("public-meeting-content-verification.json", {});
  const ocrResults = readGenerated<OcrResults>("public-meeting-ocr-results.json", {});
  const freshnessAudit = readGenerated<FreshnessAudit>("dataops-freshness-audit.json", {});
  const cacheManifest = readGenerated<CacheManifest>("public-meeting-cache-manifest.json", {});
  const cacheStorageAudit = readGenerated<CacheStorageAudit>("public-meeting-cache-storage-audit.json", {});
  const cacheBlobStorageAudit = readGenerated<CacheStorageAudit>("public-meeting-cache-storage-audit.vercel_blob.json", {});
  const sourceWaitReport = readGenerated<SourceWaitReport>("public-meeting-source-wait-report.json", {});
  const missingRoster = (rosterAudit.bodyReports ?? [])
    .filter((report) => !report.covered || report.blocker)
    .map((report) => ({ id: report.organizationId, title: report.label, detail: report.blocker ?? "Roster coverage missing." }));
  const missingAttendance = (readiness?.records ?? [])
    .filter((record) => record.blockedReason.includes("missing_attendance") && record.hasVoteOutcome)
    .map((record) => ({ id: record.meetingId, title: record.bodyName, detail: `${record.jurisdiction ?? "Unknown jurisdiction"} · ${new Date(record.meetingDate).toLocaleDateString()} · vote outcome present but attendance is not verified.` }));
  const unresolvedDistribution = (voteAudit.distributionReviewActions ?? [])
    .map((action) => ({ id: action.meeting_id, title: action.title, detail: action.reason, href: action.source_url }));
  const unmatchedAttendance = (attendanceArtifact.records ?? [])
    .filter((record) => record.matchConfidence === "unmatched_name")
    .map((record) => ({ id: `${record.meetingId}-${record.personName}-${record.attendanceStatus}`, title: record.personName, detail: `${record.votingEligibility} · ${record.attendanceStatus} · ${record.reason}` }));
  const ambiguousAttendance = (attendanceArtifact.records ?? [])
    .filter((record) => record.matchConfidence === "ambiguous_name")
    .map((record) => ({ id: `${record.meetingId}-${record.personName}-${record.attendanceStatus}`, title: record.personName, detail: `${record.organizationId ?? record.bodyId ?? "Unknown body"} · ${record.reason}` }));
  const unreadableMinutes = (minutesAudit.records ?? [])
    .filter((record) => record.extractionQuality === "unreadable" || record.extractionQuality === "blocked" || record.cachedSourceTooThin)
    .map((record) => ({ id: record.meetingId, title: record.bodyName, detail: `${record.jurisdiction ?? "Unknown jurisdiction"} · ${record.meetingDate ? new Date(record.meetingDate).toLocaleDateString() : "No date"} · ${record.extractionQuality}` }));
  const parsedNoAttendance = (minutesAudit.records ?? [])
    .filter((record) => (record.extractionQuality === "full_text" || record.extractionQuality === "partial_text") && !record.hasAttendanceSection && !record.hasRollCall)
    .map((record) => ({ id: record.meetingId, title: record.bodyName, detail: `${record.jurisdiction ?? "Unknown jurisdiction"} · minutes parsed, no attendance signal detected.` }));
  const actionUnlinked = (actionResultsArtifact.records ?? [])
    .filter((record) => !record.agendaItemId || record.needsReview)
    .map((record) => ({ id: record.id, title: record.actionTitle, detail: record.reviewReason ?? "Action result detected but agenda item linkage is incomplete.", href: record.sourceUrl }));
  const sourceGaps = (documentAudit.topReviewQueues?.sourceGaps ?? []).map((record) => ({
    id: record.meetingId,
    title: record.bodyName,
    detail: `${record.jurisdiction ?? "Unknown jurisdiction"} · ${record.missingFields.join(", ") || record.recommendedNextAction}`,
  }));
  const parserGaps = (documentAudit.topReviewQueues?.parserGaps ?? []).map((record) => ({
    id: record.meetingId,
    title: record.bodyName,
    detail: `${record.jurisdiction ?? "Unknown jurisdiction"} · ${record.missingFields.join(", ") || record.recommendedNextAction}`,
  }));
  const retrievalGaps = (sourceHealth.sourceHealth ?? [])
    .filter((record) => record.sourceGaps > 0)
    .sort((left, right) => right.sourceGaps - left.sourceGaps)
    .map((record) => ({
      id: `${record.organizationId ?? "unknown"}-${record.sourcePlatform}-${record.sourceHost ?? "local"}`,
      title: record.organizationId ?? record.sourceHost ?? record.sourcePlatform,
      detail: `${record.jurisdiction ?? "Unknown jurisdiction"} · ${record.sourcePlatform} · ${record.sourceGaps} source gaps · retrieval ${Math.round(record.retrievalHealth * 100)}%`,
    }));
  const ocrGaps = (sourceHealth.sourceHealth ?? [])
    .filter((record) => record.ocrRequired > 0)
    .map((record) => ({
      id: `ocr-${record.organizationId ?? "unknown"}-${record.sourcePlatform}`,
      title: record.organizationId ?? record.sourcePlatform,
      detail: `${record.ocrRequired} documents likely need OCR · runtime ${ocrAudit.audit?.runtime?.ocrAvailable ? "available" : "not available"}`,
    }));
  const staleSources = (dataopsMonitoring.records ?? [])
    .filter((record) => record.healthStatus === "stale" || record.healthStatus === "degraded")
    .sort((left, right) => right.documentCounts.queued - left.documentCounts.queued)
    .map((record) => ({
      id: record.sourceId,
      title: record.sourceOwner,
      detail: `${record.jurisdiction ?? "Unknown jurisdiction"} · ${record.healthStatus} · ${record.documentCounts.queued} queued · next check ${record.nextCheckAt ? new Date(record.nextCheckAt).toLocaleString() : "not scheduled"}`,
    }));
  const failingSources = (dataopsMonitoring.records ?? [])
    .filter((record) => record.healthStatus === "failing" || record.healthStatus === "blocked")
    .map((record) => ({
      id: record.sourceId,
      title: record.sourceOwner,
      detail: `${record.jurisdiction ?? "Unknown jurisdiction"} · ${record.failureReason ?? record.freshnessStatus}`,
    }));
  const sourceWaitBodies = (sourceWaitReport.byBody ?? []).map((record) => ({
    id: `source-wait-${record.key}`,
    title: record.key,
    detail: `${record.count} decision(s) waiting on minutes or result sources.`,
  }));
  const stageFailures = (pipelineRun.stages ?? [])
    .filter((record) => record.status === "failed" || record.status === "skipped")
    .map((record) => ({
      id: record.id,
      title: record.id,
      detail: `${record.status}${record.error ? ` · ${record.error}` : ""}`,
    }));

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Internal operations</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Source completeness dashboard</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Readiness is based on imported meetings, agendas, packets, minutes, attendance, vote outcomes, named votes, and roster matches. Low-readiness bodies are the next ingestion priorities.
        </p>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Meetings", readiness?.audit.totals.meetings ?? 0],
            ["With minutes", readiness?.audit.totals.meetingsWithMinutes ?? 0],
            ["With attendance", readiness?.audit.totals.meetingsWithAttendance ?? 0],
            ["With named votes", readiness?.audit.totals.meetingsWithNamedVotes ?? 0],
            ["Action results", actionResultsAudit.totals?.actionResultsExtracted ?? 0],
            ["Docs recovered", documentAudit.totals?.textExtracted ?? 0],
            ["Queued docs", retrievalAudit.audit?.totals?.queued ?? 0],
            ["Cached docs", cacheAudit.totals?.cacheRecords ?? retrievalAudit.audit?.totals?.cachedByDataops ?? 0],
            ["Changed docs", retrievalRun.audit?.totals?.changed ?? 0],
            ["Network blocked", retrievalRun.audit?.totals?.blockedByNetwork ?? 0],
            ["OCR required", ocrAudit.audit?.totals?.ocrRequired ?? 0],
            ["OCR successes", ocrResults.audit?.totals?.ocrSucceeded ?? 0],
            ["Valid PDFs", contentVerification.audit?.totals?.verifiedPdf ?? 0],
            ["MIME mismatch", contentVerification.audit?.totals?.mimeMismatch ?? 0],
            ["Quarantined", contentVerification.audit?.totals?.quarantined ?? 0],
            ["Sources monitored", dataopsMonitoring.audit?.totals?.sourcesMonitored ?? 0],
            ["Stale sources", dataopsMonitoring.audit?.totals?.stale ?? 0],
            ["Failing sources", dataopsMonitoring.audit?.totals?.failing ?? 0],
            ["Pipeline failures", pipelineRun.stagesFailed ?? 0],
            ["Freshness failures", freshnessAudit.totals?.failures ?? 0],
            ["Trust roles", trustAudit.totals?.platformRoles ?? 0],
            ["Scorecards", documentAudit.officialScorecardsSafe ? "Ready" : "Blocked"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Evidence cache</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Runtime source cache and source-wait retry</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-50/80">
                Binary meeting documents are runtime evidence and should stay out of git. Commit the manifest, hashes, source URLs, and extracted indexes; store PDFs/HTML in durable object storage.
              </p>
            </div>
            <div className="rounded-xl border border-cyan-200/20 bg-black/20 px-3 py-2 text-xs font-semibold text-cyan-50">
              Retry: <span className="font-mono">npm run meetings:source-wait:retry</span>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Manifest docs", cacheManifest.audit?.totals?.cachedDocuments ?? 0],
              ["Manifest GB", typeof cacheManifest.audit?.totals?.cachedBytes === "number" ? (cacheManifest.audit.totals.cachedBytes / 1_000_000_000).toFixed(2) : "0.00"],
              ["Object-store docs", cacheStorageAudit.totals?.objectsPresent ?? 0],
              ["Object-store GB", typeof cacheStorageAudit.totals?.bytesPresent === "number" ? (cacheStorageAudit.totals.bytesPresent / 1_000_000_000).toFixed(2) : "0.00"],
              ["Blob status", cacheBlobStorageAudit.status ?? "not_configured"],
              ["Source-wait decisions", sourceWaitReport.totals?.sourceWaitDecisions ?? 0],
              ["Related remote docs", sourceWaitReport.totals?.relatedRemoteDocuments ?? 0],
              ["Latest downloads", sourceWaitReport.totals?.latestDownloads ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-cyan-200/15 bg-black/20 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100/70">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-cyan-50/70">
            Durable storage target: {cacheManifest.audit?.retentionPolicy?.recommendedDurableStorage ?? "object_or_blob_storage_with_content_hash_keys"}. Binary cache committed to git: {cacheManifest.audit?.retentionPolicy?.commitBinaryCacheToGit ? "yes" : "no"}.
            {" "}Storage audit: {cacheStorageAudit.status ?? "not_run"} via {cacheStorageAudit.backend ?? "local_filesystem"}{cacheStorageAudit.storageRootFingerprint ? ` at ${cacheStorageAudit.storageRootFingerprint}` : ""}.
            {" "}Blob audit: {cacheBlobStorageAudit.status ?? "not_run"}.
            {" "}Full export: <span className="font-mono">{cacheStorageAudit.operatorCommands?.fullExport ?? cacheManifest.audit?.retentionPolicy?.operatorCommands?.fullExport ?? "npm run meetings:cache-storage:export -- --limit=all"}</span>.
            {" "}Blob export: <span className="font-mono">{cacheStorageAudit.operatorCommands?.vercelBlobSmoke ?? cacheManifest.audit?.retentionPolicy?.operatorCommands?.vercelBlobSmoke ?? "npm run meetings:cache-storage:blob-smoke"}</span>.
          </p>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <BlockerList title="Source-wait bodies" description="Decision cards waiting for minutes/result sources rather than parser fixes." items={sourceWaitBodies} />
          <BlockerList title="Missing rosters" description="Priority bodies without a source-backed voting roster." items={missingRoster} />
          <BlockerList title="Missing attendance" description="Vote-like meetings where aggregate attribution is blocked by missing attendance." items={missingAttendance} />
          <BlockerList title="Unresolved distributions" description="Vote counts that do not reconcile cleanly with verified present voters." items={unresolvedDistribution} />
          <BlockerList title="Unmatched attendance names" description="Names parsed from attendance sections that need official roster matching." items={unmatchedAttendance} />
          <BlockerList title="Ambiguous attendance matches" description="Attendance names that matched more than one possible roster member." items={ambiguousAttendance} />
          <BlockerList title="Unreadable minutes" description="Minutes exist but cached text is unreadable, blocked, or too thin." items={unreadableMinutes} />
          <BlockerList title="Parsed minutes, no attendance" description="Minutes text was parsed, but no attendance section was detected." items={parsedNoAttendance} />
          <BlockerList title="Action result linkage" description="Action results that need review or lack an agenda item number." items={actionUnlinked} />
          <BlockerList title="Source gaps" description="Meetings blocked because source documents are missing or not cached." items={sourceGaps} />
          <BlockerList title="Parser gaps" description="Meetings where source exists but extraction/review still needs work." items={parserGaps} />
          <BlockerList title="Retrieval health" description="Source platforms with queued or remote-only documents." items={retrievalGaps} />
          <BlockerList title="OCR health" description="PDFs likely requiring OCR or manual review before extraction." items={ocrGaps} />
          <BlockerList title="Stale or degraded sources" description="Monitored sources where freshness is limited by uncached or unextracted evidence." items={staleSources} />
          <BlockerList title="Failing or blocked sources" description="Sources with failures, missing feed URLs, or blocked retrieval paths." items={failingSources} />
          <BlockerList title="Pipeline stage issues" description="Current automated pipeline stages that failed or were intentionally skipped." items={stageFailures} />
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-[minmax(220px,1.5fr)_repeat(8,minmax(80px,1fr))] gap-0 bg-white/[0.06] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            <span>Organization</span>
            <span>Meetings</span>
            <span>Agendas</span>
            <span>Packets</span>
            <span>Minutes</span>
            <span>Attendance</span>
            <span>Votes</span>
            <span>Named</span>
            <span>Score</span>
          </div>
          <div className="divide-y divide-white/10">
            {reports.length ? (
              reports.map((report) => (
                <div key={report.organizationId} className="grid grid-cols-[minmax(220px,1.5fr)_repeat(8,minmax(80px,1fr))] gap-0 px-4 py-3 text-sm text-slate-300">
                  <span>
                    <span className="block font-semibold text-slate-100">{report.bodyName}</span>
                    <span className="text-xs text-slate-500">{report.jurisdiction}</span>
                  </span>
                  <span>{report.meetingsImported}</span>
                  <span>{report.agendas}</span>
                  <span>{report.packets}</span>
                  <span>{report.minutes}</span>
                  <span>{report.attendanceCoverage}</span>
                  <span>{report.voteCoverage}</span>
                  <span>{report.namedVoteCoverage}</span>
                  <span className={report.readinessScore < 0.35 ? "text-amber-200" : "text-emerald-200"}>{Math.round(report.readinessScore * 100)}%</span>
                </div>
              ))
            ) : (
              <p className="p-5 text-sm text-slate-400">Run npm run attribution:readiness to generate source completeness data.</p>
            )}
          </div>
        </section>

        {pipelineRun.runId ? (
          <p className="mt-4 text-xs text-slate-500">
            Pipeline {pipelineRun.runId} · network {pipelineRun.environment?.networkAvailable ? "available" : "unavailable"} · completed {pipelineRun.completedAt ? new Date(pipelineRun.completedAt).toLocaleString() : "pending"}
          </p>
        ) : null}
        {readiness?.generatedAt ? <p className="mt-2 text-xs text-slate-500">Generated {new Date(readiness.generatedAt).toLocaleString()}</p> : null}
      </div>
    </main>
  );
}
