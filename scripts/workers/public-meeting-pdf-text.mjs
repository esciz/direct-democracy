import { readFileSync, statSync } from "node:fs";
import { spawn } from "node:child_process";

// If the collector stops, terminate its worker rather than leaving an orphan parser.
let activeTool;
process.on("disconnect", () => { activeTool?.kill("SIGKILL"); process.exit(1); });

const [filePath, maxBytesValue, maxTextCharsValue, timeoutValue] = process.argv.slice(2);
const maxBytes = Number(maxBytesValue);
const maxTextChars = Number(maxTextCharsValue);
const deadline = Date.now() + Number(timeoutValue || 15000);

function runTool(command, args, captureLimit, trackPages = false) {
  return new Promise((resolve, reject) => {
    const tool = spawn(command, args, { stdio: ["ignore", "pipe", "ignore"] });
    activeTool = tool;
    let text = "";
    let truncated = false;
    let timedOut = false;
    let currentPageChars = 0;
    let currentPageWords = 0;
    let pendingWord = "";
    const currentPageVocabulary = new Set();
    let pagesProcessed = 0;
    let pagesWithText = 0;
    const addWords = value => {
      for (const word of value.toLowerCase().match(/\p{L}[\p{L}\p{M}'’-]{2,}/gu) ?? []) {
        if (word.length > 64) continue;
        currentPageWords = Math.min(40, currentPageWords + 1);
        if (currentPageVocabulary.size < 20) currentPageVocabulary.add(word);
      }
    };
    const finishPage = () => {
      addWords(pendingWord);
      pagesProcessed += 1;
      if (currentPageChars >= 300 && currentPageWords >= 40 && currentPageVocabulary.size >= 20) pagesWithText += 1;
      currentPageChars = 0; currentPageWords = 0; pendingWord = ""; currentPageVocabulary.clear();
    };
    const timer = setTimeout(() => { timedOut = true; tool.kill("SIGKILL"); }, Math.max(1, deadline - Date.now() - 100));
    tool.stdout.setEncoding("utf8");
    tool.stdout.on("data", chunk => {
      const available = Math.max(0, captureLimit - text.length);
      if (chunk.length > available) truncated = true;
      text += chunk.slice(0, available);
      if (trackPages) {
        const pieces = chunk.split("\f");
        for (let index = 0; index < pieces.length; index += 1) {
          currentPageChars += pieces[index].replace(/\s/g, "").length;
          // Keep a bounded vocabulary and only a short unfinished token across
          // chunks. Repeated headers cannot prove substantive page coverage.
          const words = pendingWord + pieces[index];
          const trailing = words.match(/[\p{L}\p{M}'’-]+$/u)?.[0] ?? "";
          addWords(words.slice(0, words.length - trailing.length));
          pendingWord = trailing.length <= 64 ? trailing : "";
          if (index < pieces.length - 1) finishPage();
        }
      }
    });
    tool.on("error", error => { clearTimeout(timer); activeTool = undefined; reject(error); });
    tool.on("close", code => {
      clearTimeout(timer); activeTool = undefined;
      if (timedOut) return reject(new Error(`native_tool_timeout:${command}`));
      if (code !== 0) return reject(new Error(`native_tool_exit:${command}:${code}`));
      if (trackPages && currentPageChars > 0) finishPage();
      resolve({ text, truncated, pagesProcessed, pagesWithText });
    });
  });
}

try {
  if (!filePath || !Number.isFinite(maxBytes) || !Number.isFinite(maxTextChars) || statSync(filePath).size > maxBytes) throw new Error("PDF size or extraction limit is invalid");
  let result;
  try {
    const native = await runTool("pdftotext", ["-layout", "-enc", "UTF-8", filePath, "-"], maxTextChars, true);
    let pagesDetected = null;
    try {
      const info = await runTool("pdfinfo", [filePath], 16_000);
      const match = info.text.match(/^Pages:\s+(\d+)/im);
      if (match) pagesDetected = Number(match[1]);
    } catch { /* Missing page inspection cannot justify complete coverage. */ }
    result = { ...native, backend: "poppler", pagesDetected,
      coverage: native.truncated ? "partial" : pagesDetected && native.pagesProcessed === pagesDetected
        ? native.pagesWithText === pagesDetected ? "complete" : "partial" : "unknown" };
  } catch (error) {
    // A Poppler parse error/timeout must not silently fall back to a parser
    // known to omit pages. Fallback is for installations without the utility.
    if (error?.code !== "ENOENT" && error?.code !== "EACCES") throw error;
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: readFileSync(filePath) });
    let text;
    try { text = (await parser.getText()).text ?? ""; }
    finally { await parser.destroy(); }
    result = { text: text.slice(0, maxTextChars), truncated: text.length > maxTextChars, backend: "pdf-parse",
      pagesDetected: null, pagesProcessed: null, pagesWithText: null, coverage: "unknown" };
  }
  process.send?.(result, () => process.exit(0));
} catch (error) {
  process.send?.({ error: error instanceof Error ? error.message : String(error) }, () => process.exit(1));
}
