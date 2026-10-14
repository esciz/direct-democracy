import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

type GeneratedArtifact<T> = {
  available: boolean;
  path: string;
  data: T | null;
};

type RetrievalQueueArtifact = {
  generatedAt?: string;
  records?: RetrievalQueueRecord[];
  audit?: {
    totals?: Record<string, number>;
    stateCounts?: Record<string, number>;
  };
};

export type RetrievalQueueRecord = {
  id?: string;
  documentId?: string;
  meetingId?: string;
  organizationId?: string;
  jurisdiction?: string;
  documentType?: string;
  sourceUrl?: string;
  sourceHost?: string;
  retrievalState?: string;
  retrievalStatus?: string;
  priorityBody?: boolean;
  queuedAt?: string;
  lastRetrievedAt?: string | null;
  nextRetryAfter?: string | null;
  retryCount?: number;
  extractionMethod?: string;
  extractionConfidence?: number;
  ocrRequired?: boolean;
  failureReason?: string | null;
  recommendedNextAction?: string;
};

type SourceCompletenessArtifact = {
  generatedAt?: string;
  totals?: SourceCompletenessTotals;
  meetingRecords?: MeetingReadinessRecord[];
};

export type SourceCompletenessTotals = {
  meetingsScored?: number;
  highQualityMeetings?: number;
  mediumQualityMeetings?: number;
  lowQualityMeetings?: number;
  insufficientMeetings?: number;
  meetingsReadyForAccountability?: number;
  meetingsBlockedBySourceGaps?: number;
  meetingsBlockedByOcr?: number;
  meetingsBlockedByParserGaps?: number;
};

export type MeetingReadinessRecord = {
  meetingId?: string;
  bodyName?: string;
  jurisdiction?: string;
  meetingDate?: string;
  documentCoverageScore?: number;
  attendanceCoverage?: number;
  motionSecondCoverage?: number;
  voteAttributionCoverage?: number;
  agendaItemLinkageConfidence?: number;
  sourceQuality?: string;
  accountabilityReadinessScore?: number;
  documentsDiscovered?: number;
  localDocuments?: number;
  extractedDocuments?: number;
  queuedDocuments?: number;
  ocrRequiredDocuments?: number;
  missingFields?: string[];
  recommendedNextAction?: string;
};

type AccountabilityReadinessArtifact = {
  generatedAt?: string;
  totals?: SourceCompletenessTotals;
  officialScorecardsSafe?: boolean;
  blocker?: string;
  highestValueNextActions?: MeetingReadinessRecord[];
};

type DocumentAuditArtifact = {
  generatedAt?: string;
  totals?: Record<string, number>;
  officialScorecardsSafe?: boolean;
  blocker?: string;
  topReviewQueues?: {
    sourceGaps?: MeetingReadinessRecord[];
    parserGaps?: MeetingReadinessRecord[];
    missingAttendance?: MeetingReadinessRecord[];
  };
  failures?: string[];
};

type OcrAuditArtifact = {
  generatedAt?: string;
  records?: OcrAuditRecord[];
  audit?: {
    runtime?: Record<string, boolean>;
    totals?: Record<string, number>;
  };
};

export type OcrAuditRecord = {
  documentId?: string;
  meetingId?: string;
  documentType?: string;
  sourceUrl?: string;
  localCached?: boolean;
  nativeTextLength?: number;
  scannedPdfLikely?: boolean;
  ocrRequired?: boolean;
  ocrAvailable?: boolean;
  ocrStatus?: string;
  extractionMethod?: string;
  extractionConfidence?: number;
  failureReason?: string | null;
};

type SourceHealthArtifact = {
  generatedAt?: string;
  sourceHealth?: SourceHealthRecord[];
  audit?: RetrievalQueueArtifact["audit"];
};

export type SourceHealthRecord = {
  sourceHost?: string;
  sourcePlatform?: string;
  jurisdiction?: string;
  documents?: number;
  queued?: number;
  extracted?: number;
  ocrRequired?: number;
  failed?: number;
  unavailable?: number;
  retrievalHealth?: string;
  extractionHealth?: string;
  ocrHealth?: string;
};

type TrustFoundationArtifact = {
  generatedAt?: string;
  totals?: Record<string, number>;
  roleModel?: { id?: string; label?: string; votingRightsGroup?: string }[];
  participationPolicy?: {
    noVoteWeighting?: boolean;
    residentAndVoterRightsEqual?: boolean;
    segmentationOnly?: string[];
  };
  claimsModel?: {
    domains?: string[];
    stakeholderClaimTypes?: string[];
    organizationClaimTypes?: string[];
  };
  verificationPolicy?: Record<string, unknown>;
  securityControls?: { id?: string; label?: string; status?: string; purpose?: string }[];
  dataDomainSeparation?: { id?: string; label?: string; purpose?: string; domain?: string; contains?: string[]; separationRule?: string }[];
  failures?: string[];
};

type StakeholderAnalyticsArtifact = {
  generatedAt?: string;
  policy?: {
    minimumCohortSize?: number;
    hiddenWeighting?: boolean;
    voteWeight?: number;
    unrestrictedCrossFilteringAllowed?: boolean;
    individualRecordsExposed?: boolean;
  };
  totals?: {
    questionsAnalyzed?: number;
    totalResponses?: number;
    verifiedResponses?: number;
    publicSegments?: number;
    suppressedSegments?: number;
  };
  records?: StakeholderAnalyticsRecord[];
};

export type StakeholderAnalyticsRecord = {
  questionId?: string;
  questionText?: string;
  entityName?: string | null;
  entityType?: string | null;
  jurisdictionName?: string;
  responseCount?: number;
  verifiedResponseCount?: number;
  publicSegments?: number;
  suppressedSegments?: number;
  segments?: Array<
    | { segmentId?: string; label?: string; suppressed: true; reason?: string; minimumCohortSize?: number }
    | { segmentId?: string; label?: string; suppressed: false; count?: number; yes?: number; no?: number; skip?: number; supportPercent?: number; voteWeight?: number }
  >;
};

async function readGeneratedArtifact<T>(relativePath: string): Promise<GeneratedArtifact<T>> {
  const filePath = path.join(process.cwd(), relativePath);
  if (!existsSync(filePath)) {
    return { available: false, path: relativePath, data: null };
  }

  try {
    return {
      available: true,
      path: relativePath,
      data: JSON.parse(await readFile(filePath, "utf8")) as T,
    };
  } catch {
    return { available: false, path: relativePath, data: null };
  }
}

function numberFromRecord(record: Record<string, number> | undefined, key: string) {
  return typeof record?.[key] === "number" ? record[key] : 0;
}

function percent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function topRecords<T>(records: T[] | undefined, count = 6) {
  return (records ?? []).slice(0, count);
}

export async function getGovCrmOperationsDashboard() {
  const [retrievalQueue, sourceCompleteness, accountabilityReadiness, documentAudit, ocrAudit, sourceHealth, trustFoundation, stakeholderAnalytics] =
    await Promise.all([
      readGeneratedArtifact<RetrievalQueueArtifact>("data/generated/public-meeting-retrieval-queue.json"),
      readGeneratedArtifact<SourceCompletenessArtifact>("data/generated/public-meeting-source-completeness.json"),
      readGeneratedArtifact<AccountabilityReadinessArtifact>("data/generated/public-meeting-accountability-readiness.json"),
      readGeneratedArtifact<DocumentAuditArtifact>("data/generated/public-meeting-document-audit.json"),
      readGeneratedArtifact<OcrAuditArtifact>("data/generated/public-meeting-ocr-audit.json"),
      readGeneratedArtifact<SourceHealthArtifact>("data/generated/public-meeting-source-health.json"),
      readGeneratedArtifact<TrustFoundationArtifact>("data/generated/trust-foundation-audit.json"),
      readGeneratedArtifact<StakeholderAnalyticsArtifact>("data/generated/stakeholder-analytics-runtime.json"),
    ]);

  const retrievalTotals = retrievalQueue.data?.audit?.totals;
  const documentTotals = documentAudit.data?.totals;
  const sourceTotals = sourceCompleteness.data?.totals ?? accountabilityReadiness.data?.totals;
  const ocrTotals = ocrAudit.data?.audit?.totals;
  const trustTotals = trustFoundation.data?.totals;

  const documents = numberFromRecord(retrievalTotals, "documents") || numberFromRecord(documentTotals, "documents");
  const extracted = numberFromRecord(retrievalTotals, "extracted") || numberFromRecord(documentTotals, "textExtracted");
  const queued = numberFromRecord(retrievalTotals, "queued");
  const ocrRequired = numberFromRecord(retrievalTotals, "ocrRequired") || numberFromRecord(ocrTotals, "ocrRequired");
  const meetingsScored = sourceTotals?.meetingsScored ?? 0;
  const readyMeetings = sourceTotals?.meetingsReadyForAccountability ?? 0;
  const sourceGapMeetings = sourceTotals?.meetingsBlockedBySourceGaps ?? numberFromRecord(documentTotals, "sourceGapMeetings");
  const parserGapMeetings = sourceTotals?.meetingsBlockedByParserGaps ?? numberFromRecord(documentTotals, "parserGapMeetings");

  return {
    generatedAt:
      documentAudit.data?.generatedAt ??
      sourceCompleteness.data?.generatedAt ??
      retrievalQueue.data?.generatedAt ??
      trustFoundation.data?.generatedAt ??
      null,
    artifacts: {
      retrievalQueue,
      sourceCompleteness,
      accountabilityReadiness,
      documentAudit,
      ocrAudit,
      sourceHealth,
      trustFoundation,
      stakeholderAnalytics,
    },
    summary: {
      documents,
      queued,
      extracted,
      localCached: numberFromRecord(documentTotals, "localCached"),
      remoteDiscovered: numberFromRecord(documentTotals, "remoteDiscovered"),
      ocrRequired,
      ocrAvailable: ocrAudit.data?.audit?.runtime?.ocrAvailable ?? false,
      extractionRate: percent(extracted, documents),
      meetingsScored,
      readyMeetings,
      readinessRate: percent(readyMeetings, meetingsScored),
      sourceGapMeetings,
      parserGapMeetings,
      scorecardsSafe: accountabilityReadiness.data?.officialScorecardsSafe ?? documentAudit.data?.officialScorecardsSafe ?? false,
      trustFailures: trustFoundation.data?.failures?.length ?? numberFromRecord(trustTotals, "failures"),
      stakeholderQuestions: stakeholderAnalytics.data?.totals?.questionsAnalyzed ?? 0,
      stakeholderVerifiedResponses: stakeholderAnalytics.data?.totals?.verifiedResponses ?? 0,
      stakeholderPublicSegments: stakeholderAnalytics.data?.totals?.publicSegments ?? 0,
      stakeholderSuppressedSegments: stakeholderAnalytics.data?.totals?.suppressedSegments ?? 0,
    },
    queues: {
      retrieval: topRecords(retrievalQueue.data?.records, 8),
      sourceGaps: topRecords(documentAudit.data?.topReviewQueues?.sourceGaps, 6),
      parserGaps: topRecords(documentAudit.data?.topReviewQueues?.parserGaps, 6),
      missingAttendance: topRecords(documentAudit.data?.topReviewQueues?.missingAttendance, 6),
      nextActions: topRecords(accountabilityReadiness.data?.highestValueNextActions, 8),
      ocr: topRecords((ocrAudit.data?.records ?? []).filter((record) => record.ocrRequired || record.ocrStatus !== "not_required"), 6),
      stakeholderAnalytics: topRecords(stakeholderAnalytics.data?.records, 8),
    },
    health: {
      retrievalStateCounts: retrievalQueue.data?.audit?.stateCounts ?? {},
      sourceHealth: topRecords(sourceHealth.data?.sourceHealth, 8),
      ocrRuntime: ocrAudit.data?.audit?.runtime ?? {},
      trust: {
        roles: topRecords(trustFoundation.data?.roleModel, 6),
        securityControls: topRecords(trustFoundation.data?.securityControls, 8),
        dataDomains: topRecords(trustFoundation.data?.dataDomainSeparation, 4),
        participationPolicy: trustFoundation.data?.participationPolicy ?? null,
        claimDomains: trustFoundation.data?.claimsModel?.domains ?? [],
      },
      stakeholderAnalytics: {
        artifactAvailable: stakeholderAnalytics.available,
        generatedAt: stakeholderAnalytics.data?.generatedAt ?? null,
        policy: stakeholderAnalytics.data?.policy ?? null,
      },
    },
  };
}
