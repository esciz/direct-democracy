import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "public-meeting-document-cache-audit.json");

type CacheRecord = {
  documentId: string;
  stableLocalPath: string;
  contentHash: string | null;
  fileSize: number | null;
  documentType: string;
  extractionStatus: string;
  ocrStatus: string;
  sourceVersion: number;
  versions?: Array<{ contentHash: string; localPath: string; sourceVersion: number }>;
};

type VerificationRecord = {
  documentId: string;
  classification: string;
  detectedMimeType: string;
  quarantine: boolean;
  hashMatches: boolean;
};

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

const index = readJson<{ records?: CacheRecord[] }>("public-meeting-document-cache-index.json", { records: [] });
const verification = readJson<{ records?: VerificationRecord[] }>("public-meeting-content-verification.json", { records: [] });
const records = index.records ?? [];
const verificationByDocument = new Map((verification.records ?? []).map((record) => [record.documentId, record]));
const failures: string[] = [];

for (const record of records) {
  if (!record.documentId) failures.push("Cache record missing documentId");
  if (!record.stableLocalPath) failures.push(`Cache record ${record.documentId} missing stableLocalPath`);
  if (record.stableLocalPath && !existsSync(path.isAbsolute(record.stableLocalPath) ? record.stableLocalPath : path.join(process.cwd(), record.stableLocalPath))) {
    failures.push(`Cache record ${record.documentId} points to missing local file`);
  }
  if (!record.contentHash) failures.push(`Cache record ${record.documentId} missing contentHash`);
  if (!record.fileSize || record.fileSize < 1) failures.push(`Cache record ${record.documentId} missing fileSize`);
  if (!record.versions?.length) failures.push(`Cache record ${record.documentId} missing source versions`);
  const verified = verificationByDocument.get(record.documentId);
  if (verified && !verified.hashMatches) failures.push(`Cache record ${record.documentId} failed verification hash check`);
}

const audit = {
  generatedAt: new Date().toISOString(),
  totals: {
    cacheRecords: records.length,
    localFilesPresent: records.filter((record) => {
      const localPath = record.stableLocalPath ? (path.isAbsolute(record.stableLocalPath) ? record.stableLocalPath : path.join(process.cwd(), record.stableLocalPath)) : "";
      return Boolean(localPath && existsSync(localPath));
    }).length,
    recordsWithHashes: records.filter((record) => Boolean(record.contentHash)).length,
    recordsWithVersions: records.filter((record) => Boolean(record.versions?.length)).length,
    pdfs: records.filter((record) => record.documentType === "packet" || /\.pdf$/i.test(record.stableLocalPath)).length,
    extractionPending: records.filter((record) => record.extractionStatus === "pending").length,
    ocrRequired: records.filter((record) => record.ocrStatus === "required").length,
    verifiedPdf: (verification.records ?? []).filter((record) => record.classification === "verified_pdf").length,
    verifiedHtml: (verification.records ?? []).filter((record) => record.classification === "verified_html").length,
    verifiedText: (verification.records ?? []).filter((record) => record.classification === "verified_text").length,
    mimeMismatch: (verification.records ?? []).filter((record) => record.classification === "mime_mismatch").length,
    quarantined: (verification.records ?? []).filter((record) => record.quarantine).length,
    failures: failures.length,
  },
  failures,
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);

if (failures.length) {
  console.error("Public meeting document cache audit failed:");
  for (const failure of failures.slice(0, 40)) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Public meeting document cache audit passed.");
console.log(JSON.stringify(audit.totals, null, 2));
