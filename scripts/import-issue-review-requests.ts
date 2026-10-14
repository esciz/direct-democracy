import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const DEFAULT_MANIFEST = "data/manual-sources/issues/review-requests/manifest.json";
const DEPRECATED_COMMUNITY_CASE_MANIFEST = "data/manual-sources/community-cases/manifest.json";
const DEFAULT_RUNTIME = "data/generated/issue-review-requests-runtime.json";
const DEFAULT_REPORT = "data/generated/issue-review-requests-report.json";

type IssueEvidence = {
  id?: string;
  title?: string;
  evidenceType?: string;
  sourceUrl?: string | null;
  localPath?: string | null;
  extractedSummary?: string | null;
  reviewStatus?: string | null;
};

type IssueReviewRequest = {
  id?: string;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  community?: string | null;
  jurisdictionName?: string | null;
  status?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  proposedSummary?: string | null;
  aiReviewStatus?: string | null;
  identifiedOfficials?: string[];
  identifiedAgencies?: string[];
  identifiedJurisdictions?: string[];
  identifiedCourtCaseNumbers?: string[];
  relatedCaseIds?: string[];
  relatedMeetingIds?: string[];
  relatedVoteIds?: string[];
  relatedOfficialIds?: string[];
  relatedNewsIds?: string[];
  relatedSpendingRecordIds?: string[];
  relatedProjectIds?: string[];
  evidence?: IssueEvidence[];
  sourceUrl?: string | null;
  exclusionReason?: string | null;
  migratedFrom?: string | null;
};

type Manifest = {
  records?: IssueReviewRequest[];
};

type DeprecatedCommunityCase = {
  id?: string;
  title?: string | null;
  description?: string | null;
  community?: string | null;
  issueCategory?: string | null;
  agencyInvolved?: string | null;
  courtName?: string | null;
  caseNumber?: string | null;
  supportingDocuments?: IssueEvidence[];
  reviewStatus?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
};

function checksum(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 12);
}

function argValue(name: string, fallback: string) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function isUnsafe(record: IssueReviewRequest) {
  const text = [record.title, record.description, record.exclusionReason].filter(Boolean).join(" ").toLowerCase();
  return (
    /\b(sealed|confidential|juvenile|protected|non[- ]public|minor child|ssn|social security|doxx|harass)\b/.test(text) ||
    /\b\d{3}-\d{2}-\d{4}\b/.test(text) ||
    /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(text)
  );
}

function inferCourtCaseNumbers(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ");
  return unique([...text.matchAll(/\b(?:case\s*(?:no\.?|number)?\s*)?([A-Z]?\d{2,6}(?:-[A-Z0-9]+)?)\b/gi)].map((match) => match[1]));
}

function inferAgencies(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ");
  const agencies = [
    "State of Nevada",
    "Nevada Supreme Court",
    "Nevada Court of Appeals",
    "Reno City Council",
    "Washoe County",
    "Clark County",
    "Carson City",
    "School District",
    "District Court",
  ];
  return agencies.filter((agency) => text.toLowerCase().includes(agency.toLowerCase()));
}

function toRuntimeRecord(record: IssueReviewRequest) {
  const now = new Date().toISOString();
  const id = record.id ?? `issue_request_${checksum(record)}`;
  const description = record.description ?? "";
  const evidence = (record.evidence ?? []).map((entry, index) => ({
    id: entry.id ?? `${id}_evidence_${index + 1}`,
    title: entry.title ?? "Supporting material",
    evidenceType: entry.evidenceType ?? "other",
    sourceUrl: entry.sourceUrl ?? null,
    localPath: entry.localPath ?? null,
    extractedSummary: entry.extractedSummary ?? null,
    reviewStatus: entry.reviewStatus ?? "submitted",
  }));
  const identifiedCourtCaseNumbers = unique([...(record.identifiedCourtCaseNumbers ?? []), ...inferCourtCaseNumbers(record.title, description)]);
  const identifiedAgencies = unique([...(record.identifiedAgencies ?? []), ...inferAgencies(record.title, description, record.jurisdictionName)]);
  const status = record.status === "verified" || record.status === "resolved" || record.status === "archived" || record.status === "under_review" ? record.status : "submitted";

  return {
    id,
    title: record.title ?? "Issue pending review",
    description,
    category: record.category ?? "Other",
    community: record.community ?? record.jurisdictionName ?? "Community pending",
    jurisdictionName: record.jurisdictionName ?? record.community ?? "Community pending",
    status,
    submittedAt: record.submittedAt ?? now,
    reviewedAt: record.reviewedAt ?? null,
    proposedSummary:
      record.proposedSummary ??
      (description ? `A submitted issue about ${record.title ?? "a civic concern"} needs review. Supporting materials should be checked before public summary or linking.` : null),
    aiReviewStatus: record.aiReviewStatus ?? (description ? "generated" : "not_started"),
    identifiedOfficials: record.identifiedOfficials ?? [],
    identifiedAgencies,
    identifiedJurisdictions: unique([...(record.identifiedJurisdictions ?? []), record.jurisdictionName, record.community]),
    identifiedCourtCaseNumbers,
    relatedCaseIds: record.relatedCaseIds ?? [],
    relatedMeetingIds: record.relatedMeetingIds ?? [],
    relatedVoteIds: record.relatedVoteIds ?? [],
    relatedOfficialIds: record.relatedOfficialIds ?? [],
    relatedNewsIds: record.relatedNewsIds ?? [],
    relatedSpendingRecordIds: record.relatedSpendingRecordIds ?? [],
    relatedProjectIds: record.relatedProjectIds ?? [],
    evidence,
    migratedFrom: record.migratedFrom ?? null,
  };
}

function fromDeprecatedCommunityCase(record: DeprecatedCommunityCase): IssueReviewRequest {
  return {
    id: record.id ? `migrated_${record.id}` : undefined,
    title: record.title,
    description: record.description,
    category: record.issueCategory ?? "Other",
    community: record.community,
    jurisdictionName: record.community,
    status: record.reviewStatus === "verified" ? "verified" : "submitted",
    submittedAt: record.submittedAt,
    reviewedAt: record.reviewedAt,
    evidence: record.supportingDocuments,
    identifiedAgencies: unique([record.agencyInvolved, record.courtName]),
    identifiedCourtCaseNumbers: unique([record.caseNumber]),
    migratedFrom: "deprecated_community_case",
  };
}

async function main() {
  const manifestPath = argValue("--manifest", DEFAULT_MANIFEST);
  const runtimePath = argValue("--runtime", DEFAULT_RUNTIME);
  const reportPath = argValue("--report", DEFAULT_REPORT);
  const deprecatedCommunityPath = argValue("--deprecated-community-cases", DEPRECATED_COMMUNITY_CASE_MANIFEST);
  const [manifest, deprecatedCommunityManifest] = await Promise.all([
    readJson<Manifest>(manifestPath, { records: [] }),
    readJson<{ records?: DeprecatedCommunityCase[] }>(deprecatedCommunityPath, { records: [] }),
  ]);
  const migrated = (deprecatedCommunityManifest.records ?? []).map(fromDeprecatedCommunityCase);
  const records = [...(manifest.records ?? []), ...migrated];
  const exclusions: Array<{ id?: string; title?: string | null; reason: string }> = [];
  const runtimeRecords = [];

  for (const record of records) {
    if (record.exclusionReason) {
      exclusions.push({ id: record.id, title: record.title, reason: "has_exclusion_reason" });
      continue;
    }
    if (isUnsafe(record)) {
      exclusions.push({ id: record.id, title: record.title, reason: "privacy_or_safety_risk" });
      continue;
    }
    runtimeRecords.push(toRuntimeRecord(record));
  }

  const generatedAt = new Date().toISOString();
  const counts = {
    manifestRecords: records.length,
    runtimeRecords: runtimeRecords.length,
    submitted: runtimeRecords.filter((record) => record.status === "submitted").length,
    underReview: runtimeRecords.filter((record) => record.status === "under_review").length,
    verified: runtimeRecords.filter((record) => record.status === "verified").length,
    resolved: runtimeRecords.filter((record) => record.status === "resolved").length,
    archived: runtimeRecords.filter((record) => record.status === "archived").length,
    needsReview: runtimeRecords.filter((record) => record.status === "submitted" || record.status === "under_review").length,
    linkedRecords: runtimeRecords.filter(
      (record) =>
        record.relatedCaseIds.length ||
        record.relatedMeetingIds.length ||
        record.relatedVoteIds.length ||
        record.relatedOfficialIds.length ||
        record.relatedNewsIds.length ||
        record.relatedSpendingRecordIds.length ||
        record.relatedProjectIds.length,
    ).length,
    migratedCommunityCases: migrated.length,
  };

  await fs.mkdir(path.dirname(runtimePath), { recursive: true });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(runtimePath, `${JSON.stringify({ schemaVersion: 1, generatedAt, sourceManifest: manifestPath, counts, records: runtimeRecords }, null, 2)}\n`);
  await fs.writeFile(reportPath, `${JSON.stringify({ generatedAt, sourceManifest: manifestPath, runtimePath, counts, exclusions }, null, 2)}\n`);
  console.log(JSON.stringify({ import: "issue-review-requests", ...counts, runtimePath, reportPath, exclusions }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
