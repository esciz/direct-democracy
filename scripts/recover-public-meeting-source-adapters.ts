import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const ADAPTER_TEXT_DIR = path.join(GENERATED_DIR, "public-meeting-adapter-text-cache");
const OUTPUT_PATH = path.join(GENERATED_DIR, "public-meeting-source-adapter-recovery.json");
const DOCUMENT_TEXT_PATH = path.join(GENERATED_DIR, "public-meeting-document-text.json");

type SourceDocument = {
  id: string;
  meetingId: string;
  meetingItemIds?: string[];
  documentType: string;
  sourceUrl: string | null;
  sourceHost: string | null;
  sourcePlatform: string;
};

type DocumentText = {
  id: string;
  documentId: string;
  meetingId: string;
  meetingItemIds?: string[];
  documentType: string;
  sourceUrl: string | null;
  extractedTextPath: string | null;
  extractionMethod: string;
  extractionQuality: string;
  textLength: number;
  confidence: number;
  sourceSnippet: string | null;
  ocrAttempted: boolean;
  ocrAvailable: boolean;
  failureReason: string | null;
  extractedAt: string;
  adapterRecovery?: AdapterRecoverySummary;
};

type AdapterRecoverySummary = {
  adapterId: string;
  recoveryStatus: string;
  recoveryReason: string;
  companionDocumentId: string | null;
  companionSourceUrl: string | null;
};

type RecoveryRecord = {
  adapterId: string;
  documentId: string;
  meetingId: string;
  sourceUrl: string | null;
  recoveryStatus: "recovered_with_companion_agenda" | "manual_review_required" | "not_applicable";
  recoveryReason: string;
  companionDocumentId: string | null;
  companionSourceUrl: string | null;
  outputTextPath: string | null;
  confidence: number;
  sourceReferences: Array<{ label: string; url: string | null; documentId: string | null }>;
};

function readJson<T>(fileNameOrPath: string, fallback: T): T {
  try {
    const filePath = path.isAbsolute(fileNameOrPath) ? fileNameOrPath : path.join(GENERATED_DIR, fileNameOrPath);
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function clipIdFor(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get("clip_id");
  } catch {
    return null;
  }
}

function isGranicusMinutesShell(document: SourceDocument, text: DocumentText | undefined) {
  return (
    document.sourcePlatform === "granicus" &&
    document.sourceUrl?.includes("MinutesViewer.php") &&
    (text?.extractionMethod === "failed" || text?.failureReason === "native_text_too_thin_ocr_unavailable" || (text?.textLength ?? 0) < 120)
  );
}

function snippetFrom(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 700);
}

function recoverAdapters() {
  const generatedAt = new Date().toISOString();
  mkdirSync(ADAPTER_TEXT_DIR, { recursive: true });

  const documents = readJson<{ records?: SourceDocument[] }>("public-meeting-source-documents.json", { records: [] }).records ?? [];
  const documentTextArtifact = readJson<{ generatedAt?: string; records?: DocumentText[]; audit?: unknown }>(DOCUMENT_TEXT_PATH, { records: [] });
  const textRows = documentTextArtifact.records ?? [];
  const textByDocument = new Map(textRows.map((row) => [row.documentId, row]));
  const documentsByMeeting = new Map<string, SourceDocument[]>();

  for (const document of documents) {
    const list = documentsByMeeting.get(document.meetingId) ?? [];
    list.push(document);
    documentsByMeeting.set(document.meetingId, list);
  }

  const replacementRows = new Map<string, DocumentText>();
  const records: RecoveryRecord[] = [];

  for (const document of documents) {
    const text = textByDocument.get(document.id);
    if (!isGranicusMinutesShell(document, text)) continue;

    const clipId = clipIdFor(document.sourceUrl);
    const companion = (documentsByMeeting.get(document.meetingId) ?? []).find((candidate) => {
      return candidate.id !== document.id && candidate.sourcePlatform === "granicus" && candidate.sourceUrl?.includes("AgendaViewer.php") && clipIdFor(candidate.sourceUrl) === clipId;
    });
    const companionText = companion ? textByDocument.get(companion.id) : undefined;

    if (!companion || !companionText || companionText.extractionMethod === "failed" || !companionText.sourceSnippet) {
      records.push({
        adapterId: "granicus-minutes-shell-companion-agenda",
        documentId: document.id,
        meetingId: document.meetingId,
        sourceUrl: document.sourceUrl,
        recoveryStatus: "manual_review_required",
        recoveryReason: "Granicus MinutesViewer returned an empty HTML shell and no usable companion agenda text was available.",
        companionDocumentId: companion?.id ?? null,
        companionSourceUrl: companion?.sourceUrl ?? null,
        outputTextPath: null,
        confidence: 0.1,
        sourceReferences: [
          { label: "Granicus minutes shell", url: document.sourceUrl, documentId: document.id },
          { label: "Companion agenda", url: companion?.sourceUrl ?? null, documentId: companion?.id ?? null },
        ],
      });
      continue;
    }

    const fallbackText = [
      "Adapter recovery note: the Granicus minutes endpoint returned a thin HTML shell rather than readable minutes. Direct Democracy is using the companion Granicus agenda for the same clip as source-backed meeting material. This does not claim completed minutes were recovered.",
      "",
      `Minutes source: ${document.sourceUrl ?? "unknown"}`,
      `Companion agenda source: ${companion.sourceUrl ?? "unknown"}`,
      "",
      companionText.sourceSnippet,
    ].join("\n");
    const textHash = hashText(fallbackText);
    const relativeTextPath = path.join("data", "generated", "public-meeting-adapter-text-cache", `${document.id}-${textHash.slice(0, 12)}.txt`);
    writeFileSync(path.join(process.cwd(), relativeTextPath), `${fallbackText}\n`);

    const recoverySummary: AdapterRecoverySummary = {
      adapterId: "granicus-minutes-shell-companion-agenda",
      recoveryStatus: "recovered_with_companion_agenda",
      recoveryReason: "Granicus MinutesViewer returned an empty HTML shell; companion agenda for the same clip provides the usable source-backed meeting material.",
      companionDocumentId: companion.id,
      companionSourceUrl: companion.sourceUrl,
    };

    replacementRows.set(document.id, {
      ...(text ?? {
        id: `document-text-${document.id}`,
        documentId: document.id,
        meetingId: document.meetingId,
        meetingItemIds: document.meetingItemIds ?? [],
        documentType: document.documentType,
        sourceUrl: document.sourceUrl,
        ocrAttempted: false,
        ocrAvailable: false,
      }),
      extractedTextPath: relativeTextPath,
      extractionMethod: "mixed",
      extractionQuality: "low",
      textLength: fallbackText.length,
      confidence: 0.52,
      sourceSnippet: snippetFrom(fallbackText),
      failureReason: null,
      extractedAt: generatedAt,
      adapterRecovery: recoverySummary,
    });

    records.push({
      adapterId: "granicus-minutes-shell-companion-agenda",
      documentId: document.id,
      meetingId: document.meetingId,
      sourceUrl: document.sourceUrl,
      recoveryStatus: "recovered_with_companion_agenda",
      recoveryReason: recoverySummary.recoveryReason,
      companionDocumentId: companion.id,
      companionSourceUrl: companion.sourceUrl,
      outputTextPath: relativeTextPath,
      confidence: 0.52,
      sourceReferences: [
        { label: "Granicus minutes shell", url: document.sourceUrl, documentId: document.id },
        { label: "Companion agenda", url: companion.sourceUrl, documentId: companion.id },
      ],
    });
  }

  const updatedRows = textRows.map((row) => replacementRows.get(row.documentId) ?? row);
  writeFileSync(DOCUMENT_TEXT_PATH, `${JSON.stringify({ ...documentTextArtifact, generatedAt, records: updatedRows }, null, 2)}\n`);

  const audit = {
    generatedAt,
    totals: {
      adaptersRun: 1,
      granicusMinutesShellsFound: records.length,
      recoveredWithCompanionAgenda: records.filter((record) => record.recoveryStatus === "recovered_with_companion_agenda").length,
      manualReviewRequired: records.filter((record) => record.recoveryStatus === "manual_review_required").length,
      documentTextRowsUpdated: replacementRows.size,
    },
  };

  writeFileSync(OUTPUT_PATH, `${JSON.stringify({ generatedAt, records, audit }, null, 2)}\n`);
  console.log(`Generated public meeting source adapter recovery at ${OUTPUT_PATH}`);
  console.log(JSON.stringify(audit.totals, null, 2));
}

recoverAdapters();
