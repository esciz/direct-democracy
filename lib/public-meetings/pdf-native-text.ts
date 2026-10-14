import { fork, spawnSync } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";

export const NATIVE_PDF_EXTRACTOR_VERSION = 3;
export type PdfNativeBackend = "poppler" | "pdf-parse";
export type PdfNativeTextResult = { text: string; failureReason: string | null; backend?: PdfNativeBackend; pagesDetected?: number | null;
  pagesProcessed?: number | null; pagesWithText?: number | null; coverage?: "complete" | "partial" | "unknown"; truncated?: boolean };

export function preferredNativePdfBackend(): PdfNativeBackend {
  const result = spawnSync("pdftotext", ["-v"], { stdio: "ignore", timeout: 2000 });
  return result.error ? "pdf-parse" : "poppler";
}

/** A malformed public PDF cannot retain the collector's event loop or memory indefinitely. */
export async function extractPdfTextIsolated(filePath: string, options: {
  timeoutMs?: number;
  maxBytes?: number;
  maxTextChars?: number;
  workerPath?: string;
} = {}): Promise<PdfNativeTextResult> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxBytes = options.maxBytes ?? 50 * 1024 * 1024;
  const maxTextChars = options.maxTextChars ?? 450_000;
  if (![timeoutMs, maxBytes, maxTextChars].every((limit) => Number.isFinite(limit) && limit > 0)) throw new Error("PDF extraction limits must be finite positive numbers");
  try {
    const info = await stat(filePath);
    if (info.size > maxBytes) return { text: "", failureReason: `pdf_native_text_size_limit:${info.size}>${maxBytes}` };
  } catch {
    return { text: "", failureReason: "pdf_native_text_source_unreadable" };
  }
  return new Promise((resolve) => {
    const workerPath = options.workerPath ?? path.join(process.cwd(), "scripts/workers/public-meeting-pdf-text.mjs");
    const child = fork(workerPath, [filePath, String(maxBytes), String(maxTextChars), String(timeoutMs)], {
      silent: true,
      detached: process.platform !== "win32",
      execArgv: ["--max-old-space-size=384"],
    });
    let result: PdfNativeTextResult | null = null;
    let settled = false;
    let timedOut = false;
    const finish = (value: PdfNativeTextResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    // Drain diagnostics without accumulating unbounded PDF parser logs in the parent.
    child.stdout?.resume();
    child.stderr?.resume();
    const timer = setTimeout(() => {
      timedOut = true;
      result = { text: "", failureReason: `pdf_native_text_timeout:${timeoutMs}ms` };
      // Poppler is a subprocess of the isolated worker. Kill its process group
      // too, so a hung native parser cannot survive the collector's timeout.
      if (process.platform !== "win32" && child.pid) {
        try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
      } else child.kill("SIGKILL");
    }, timeoutMs);
    child.on("message", (message: unknown) => {
      if (timedOut || !message || typeof message !== "object") return;
      const payload = message as { text?: unknown; error?: unknown; backend?: unknown; pagesDetected?: unknown; pagesProcessed?: unknown; pagesWithText?: unknown; coverage?: unknown; truncated?: unknown };
      if (typeof payload.text === "string" && payload.text.length <= maxTextChars) {
        result = { text: payload.text, failureReason: payload.truncated === true ? `pdf_native_text_truncated:${maxTextChars}` : null };
        if (payload.backend === "poppler" || payload.backend === "pdf-parse") result.backend = payload.backend;
        if (payload.coverage === "complete" || payload.coverage === "partial" || payload.coverage === "unknown") result.coverage = payload.coverage;
        for (const key of ["pagesDetected", "pagesProcessed", "pagesWithText"] as const) if (payload[key] === null || Number.isSafeInteger(payload[key]) && Number(payload[key]) >= 0) result[key] = payload[key] as number | null;
        if (typeof payload.truncated === "boolean") result.truncated = payload.truncated;
      }
      else if (typeof payload.error === "string") result = { text: "", failureReason: `pdf_native_text_failed:${payload.error.slice(0, 300)}` };
    });
    child.on("error", (error) => finish({ text: "", failureReason: `pdf_native_text_worker_error:${error.message}` }));
    child.on("close", (code, signal) => finish(result ?? { text: "", failureReason: `pdf_native_text_worker_exit:${signal ?? code ?? "unknown"}` }));
  });
}
