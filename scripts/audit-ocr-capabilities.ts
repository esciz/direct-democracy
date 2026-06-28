import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "dataops-ocr-capabilities.json");

const tools = ["pdfinfo", "pdftotext", "pdftoppm", "tesseract", "ocrmypdf"] as const;

function detect(command: string) {
  try {
    const binaryPath = execFileSync("command", ["-v", command], { encoding: "utf8", timeout: 3000 }).trim();
    let version: string | null = null;
    try {
      const output = execFileSync(command, command === "tesseract" ? ["--version"] : ["-v"], { encoding: "utf8", timeout: 5000 });
      version = output.split("\n")[0]?.trim() || null;
    } catch (error) {
      const stderr = error && typeof error === "object" && "stderr" in error ? String((error as { stderr?: Buffer | string }).stderr ?? "") : "";
      version = stderr.split("\n")[0]?.trim() || null;
    }
    return { command, available: true, path: binaryPath, version };
  } catch {
    return { command, available: false, path: null, version: null };
  }
}

const generatedAt = new Date().toISOString();
const records = tools.map((tool) => detect(tool));
const byCommand = new Map(records.map((record) => [record.command, record.available]));
const audit = {
  generatedAt,
  tools: records,
  capabilities: {
    canInspectPdfPages: Boolean(byCommand.get("pdfinfo")),
    canExtractNativePdfText: Boolean(byCommand.get("pdftotext")),
    canRenderPdfPages: Boolean(byCommand.get("pdftoppm")),
    canRunTesseract: Boolean(byCommand.get("tesseract")),
    canRunOcrMyPdf: Boolean(byCommand.get("ocrmypdf")),
    canRunPageOcr: Boolean(byCommand.get("pdftoppm") && byCommand.get("tesseract")),
  },
  limits: {
    maxFileSizeBytes: Number(process.env.DATAOPS_OCR_MAX_FILE_SIZE_BYTES ?? 50_000_000),
    maxPagesPerDocument: Number(process.env.DATAOPS_OCR_MAX_PAGES ?? 10),
    subprocessTimeoutMs: Number(process.env.DATAOPS_OCR_TIMEOUT_MS ?? 30_000),
  },
  installHint: byCommand.get("pdftoppm") && byCommand.get("tesseract") ? null : "Install Poppler utilities and Tesseract, then rerun npm run meetings:documents:ocr.",
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log(`Generated OCR capability audit at ${OUTPUT_PATH}`);
console.log(JSON.stringify(audit.capabilities, null, 2));
