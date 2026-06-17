import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  ensureNvSosDirs,
  inferReportType,
  listFilesRecursive,
  NV_SOS_PATHS,
  readJsonFile,
  readNvSosSources,
  safeFileStem,
  sha256,
  stripHtml,
  writeJsonFile,
  type NvSosExpandedSource,
  type NvSosExtractedDocument,
  type NvSosFetchLogEntry,
} from "../lib/nv-sos/pipeline";

const execFileAsync = promisify(execFile);

async function extractPdfText(buffer: Buffer) {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text.trim();
  } catch (error) {
    console.warn(`[nv-sos] pdf embedded text extraction failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return "";
  }
}

async function commandAvailable(command: string) {
  try {
    await execFileAsync("which", [command]);
    return true;
  } catch {
    return false;
  }
}

async function extractPdfOcr(cachedPath: string) {
  const hasPdftoppm = await commandAvailable("pdftoppm");
  const hasTesseract = await commandAvailable("tesseract");
  if (!hasPdftoppm || !hasTesseract) return "";

  const tempDir = await mkdtemp(path.join(tmpdir(), "nv-sos-ocr-"));
  try {
    const imagePrefix = path.join(tempDir, "page");
    await execFileAsync("pdftoppm", ["-f", "1", "-l", "3", "-png", cachedPath, imagePrefix], { timeout: 120000 });
    const images = (await readdir(tempDir)).filter((fileName) => fileName.endsWith(".png")).sort();
    const chunks: string[] = [];
    for (const image of images) {
      const outputBase = path.join(tempDir, image.replace(/\.png$/, ""));
      await execFileAsync("tesseract", [path.join(tempDir, image), outputBase], { timeout: 120000 });
      chunks.push(await readFile(`${outputBase}.txt`, "utf8"));
    }
    return chunks.join("\n").trim();
  } catch (error) {
    console.warn(`[nv-sos] pdf OCR fallback failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return "";
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function titleFromHtmlText(text: string) {
  return text.split("\n").map((line) => line.trim()).find(Boolean)?.slice(0, 160) ?? null;
}

async function extractFromLogEntry(entry: NvSosFetchLogEntry): Promise<NvSosExtractedDocument | null> {
  if (!entry.cached_path || !entry.sha256) return null;
  if (entry.status !== "success_html" && entry.status !== "success_pdf") return null;

  const cachedPath = path.join(process.cwd(), entry.cached_path);
  const buffer = await readFile(cachedPath);
  const digest = sha256(buffer);
  const contentKind = entry.status === "success_pdf" ? "pdf" : "html";
  let text = "";
  let extractionMethod: NvSosExtractedDocument["extraction_method"] = "html_text";
  let needsOcr = false;

  if (contentKind === "pdf") {
    text = await extractPdfText(buffer);
    extractionMethod = text.length >= 80 ? "pdf_embedded_text" : "pdf_text_pending_ocr";
    needsOcr = text.length < 80;
    if (needsOcr) {
      const ocrText = await extractPdfOcr(cachedPath);
      if (ocrText.length >= 80) {
        text = ocrText;
        extractionMethod = "pdf_ocr_text";
        needsOcr = false;
      } else {
        text = text || "[OCR pending: embedded PDF text was empty or too short, and local OCR tooling was unavailable or did not produce usable text.]";
      }
    }
  } else {
    text = stripHtml(buffer.toString("utf8"));
  }

  const textPath = path.join(NV_SOS_PATHS.textDir, `${digest}.txt`);
  await writeFile(textPath, `${text}\n`, "utf8");

  return {
    source_id: entry.source_id,
    source_url: entry.source_url,
    source_type: entry.source_type,
    content_kind: contentKind,
    sha256: digest,
    cached_path: entry.cached_path,
    text_path: path.relative(process.cwd(), textPath),
    extracted_at: new Date().toISOString(),
    title: contentKind === "html" ? titleFromHtmlText(text) : inferReportType(text),
    text_length: text.length,
    extraction_method: extractionMethod,
    needs_ocr: needsOcr,
  };
}

async function main() {
  await ensureNvSosDirs();
  const [seedFetchLog, expandedFetchLog, seedSources, expandedSources] = await Promise.all([
    readJsonFile<NvSosFetchLogEntry[]>(NV_SOS_PATHS.fetchLog, []),
    readJsonFile<NvSosFetchLogEntry[]>(NV_SOS_PATHS.expandedFetchLog, []),
    readNvSosSources(),
    readJsonFile<NvSosExpandedSource[]>(NV_SOS_PATHS.expandedSources, []),
  ]);
  const fetchLog = [...seedFetchLog, ...expandedFetchLog];
  const latestByDocumentKey = new Map<string, NvSosFetchLogEntry>();

  for (const entry of fetchLog) {
    if (entry.cached_path && (entry.status === "success_html" || entry.status === "success_pdf")) {
      latestByDocumentKey.set(`${entry.source_id}:${entry.source_url.toLowerCase()}`, entry);
    }
  }

  const coveredSourceIds = new Set([...latestByDocumentKey.values()].map((entry) => entry.source_id));
  const notFoundSourceIds = new Set(fetchLog.filter((entry) => entry.status === "not_found").map((entry) => entry.source_id));
  const sourceHints = [
    ...seedSources.map((source) => ({ source_id: source.id, source_type: source.source_type, source_url: source.source_url })),
    ...expandedSources.map((source) => ({ source_id: source.source_id, source_type: source.source_type, source_url: source.source_url })),
  ];
  const cachedHtmlFiles = await listFilesRecursive(NV_SOS_PATHS.htmlDir);
  for (const source of sourceHints) {
    if (coveredSourceIds.has(source.source_id)) continue;
    if (notFoundSourceIds.has(source.source_id)) continue;
    const sourceStem = safeFileStem(source.source_id);
    const fallbackCandidates = [];
    for (const filePath of cachedHtmlFiles.filter((candidatePath) => path.basename(candidatePath).startsWith(sourceStem))) {
      const buffer = await readFile(filePath);
      const preview = buffer.subarray(0, Math.min(buffer.length, 4096)).toString("utf8");
      if (buffer.length <= 1000 || /Request unsuccessful|Incapsula incident ID|Access Denied|_Incapsula_Resource|Page does not exist - Secretary of State, Nevada|The page you have requested (?:can't be found|does not exist)/i.test(preview)) continue;
      const fileStat = await stat(filePath);
      fallbackCandidates.push({ filePath, modifiedAt: fileStat.mtimeMs, bytes: buffer.length, digest: sha256(buffer) });
    }
    const fallback = fallbackCandidates.sort((left, right) => right.modifiedAt - left.modifiedAt).at(0);
    if (!fallback) continue;
    const relative = path.relative(process.cwd(), fallback.filePath);
    latestByDocumentKey.set(`${source.source_id}:${source.source_url.toLowerCase()}`, {
      source_id: source.source_id,
      source_type: source.source_type,
      source_url: source.source_url,
      fetched_at: new Date(fallback.modifiedAt).toISOString(),
      status: "success_html",
      http_status: null,
      content_type: "text/html",
      sha256: fallback.digest,
      bytes: fallback.bytes,
      cached_path: relative,
      required_cookies: [],
      used_cookie_file: false,
      error: "Using previous successful cache because current fetch did not return source HTML.",
    });
  }

  if (!fetchLog.length && !latestByDocumentKey.size) {
    const htmlFiles = await listFilesRecursive(NV_SOS_PATHS.htmlDir);
    const pdfFiles = await listFilesRecursive(NV_SOS_PATHS.pdfDir);
    for (const filePath of [...htmlFiles, ...pdfFiles]) {
      const relative = path.relative(process.cwd(), filePath);
      const isPdf = relative.toLowerCase().endsWith(".pdf");
      latestByDocumentKey.set(`manual-cache-${relative}`, {
        source_id: `manual-cache-${path.basename(filePath)}`,
        source_type: isPdf ? "show_document" : "campaign_finance_report",
        source_url: `local-cache:${relative}`,
        fetched_at: new Date().toISOString(),
        status: isPdf ? "success_pdf" : "success_html",
        http_status: null,
        content_type: isPdf ? "application/pdf" : "text/html",
        sha256: null,
        bytes: 0,
        cached_path: relative,
        required_cookies: [],
        used_cookie_file: false,
        error: null,
      });
    }
  }

  const extracted = (await Promise.all([...latestByDocumentKey.values()].map(extractFromLogEntry))).filter(Boolean) as NvSosExtractedDocument[];
  await writeJsonFile(NV_SOS_PATHS.extractedDocuments, extracted);
  console.log(`Extracted text from ${extracted.length} Nevada SoS cached document(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
