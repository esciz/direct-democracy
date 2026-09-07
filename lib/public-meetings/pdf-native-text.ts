import { fork } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";

export type PdfNativeTextResult = { text: string; failureReason: string | null };

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
    const child = fork(workerPath, [filePath, String(maxBytes), String(maxTextChars)], {
      silent: true,
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
      child.kill("SIGKILL");
    }, timeoutMs);
    child.on("message", (message: unknown) => {
      if (timedOut || !message || typeof message !== "object") return;
      const payload = message as { text?: unknown; error?: unknown };
      if (typeof payload.text === "string" && payload.text.length <= maxTextChars) result = { text: payload.text, failureReason: null };
      else if (typeof payload.error === "string") result = { text: "", failureReason: `pdf_native_text_failed:${payload.error.slice(0, 300)}` };
    });
    child.on("error", (error) => finish({ text: "", failureReason: `pdf_native_text_worker_error:${error.message}` }));
    child.on("close", (code, signal) => finish(result ?? { text: "", failureReason: `pdf_native_text_worker_exit:${signal ?? code ?? "unknown"}` }));
  });
}
