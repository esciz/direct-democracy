import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractPdfTextIsolated, preferredNativePdfBackend } from "../lib/public-meetings/pdf-native-text";

async function main() {
  const root = mkdtempSync(path.join(os.tmpdir(), "meeting-pdf-isolation-test-"));
  try {
    const source = path.join(root, "source.pdf");
    const hanging = path.join(root, "hanging.mjs");
    const good = path.join(root, "good.mjs");
    writeFileSync(source, "%PDF fixture");
    writeFileSync(hanging, "while (true) {}\n");
    writeFileSync(good, 'process.send({ text: "Recovered next document" }, () => process.exit(0));\n');
    const started = Date.now();
    const timeout = await extractPdfTextIsolated(source, { workerPath: hanging, timeoutMs: 150 });
    assert.match(timeout.failureReason ?? "", /^pdf_native_text_timeout:150ms$/);
    assert.ok(Date.now() - started < 3000, "A CPU-bound child must be killed without hanging the collector");
    const next = await extractPdfTextIsolated(source, { workerPath: good, timeoutMs: 3000 });
    assert.deepEqual(next, { text: "Recovered next document", failureReason: null }, "Processing continues after a timeout");
    const limit = await extractPdfTextIsolated(source, { workerPath: hanging, timeoutMs: 150, maxBytes: 1 });
    assert.match(limit.failureReason ?? "", /^pdf_native_text_size_limit:/, "Oversized files are rejected before worker execution");
    const missing = await extractPdfTextIsolated(path.join(root, "missing.pdf"));
    assert.equal(missing.failureReason, "pdf_native_text_source_unreadable");

    const stream = "BT /F1 12 Tf 20 200 Td (Official meeting motion approved) Tj ET";
    const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [];
    for (const [index, body] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${body}\nendobj\n`; }
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    writeFileSync(source, pdf);
    const native = await extractPdfTextIsolated(source);
    assert.equal(native.failureReason, null, "The actual PDF worker must return native text successfully");
    assert.match(native.text, /Official meeting motion approved/);
    const bin = path.join(root, "tools"); mkdirSync(bin);
    const originalPath = process.env.PATH;
    const stub = (name: string, code: string) => { const file = path.join(bin, name); writeFileSync(file, `#!${process.execPath}\n${code}\n`); chmodSync(file, 0o755); };
    const pageText = "Minutes: members reviewed public comments and approved the transportation budget after considering staffing, maintenance, accessibility, safety, community concerns, financial reports, district priorities and construction schedules. ".repeat(8);
    try {
      process.env.PATH = bin;
      const allPages = Array.from({ length: 16 }, (_, index) => `PAGE_${index + 1}\n${pageText}`).join("\f") + "\f";
      stub("pdfinfo", "process.stdout.write('Pages: 16\\n')");
      stub("pdftotext", `process.stdout.write(process.argv.includes('-v')?'fixture Poppler':${JSON.stringify(allPages)})`);
      assert.equal(preferredNativePdfBackend(), "poppler");
      const poppler = await extractPdfTextIsolated(source);
      assert.equal(poppler.backend, "poppler", "Poppler must be preferred over the fallback parser");
      assert.equal(poppler.coverage, "complete");
      assert.equal(poppler.pagesDetected, 16);
      assert.equal(poppler.pagesWithText, 16);
      assert.ok(poppler.text.includes("PAGE_1\n") && poppler.text.includes("PAGE_16\n"));
      const capped = await extractPdfTextIsolated(source, { maxTextChars: 500 });
      assert.equal(capped.text.length, 500);
      assert.equal(capped.truncated, true);
      assert.equal(capped.coverage, "partial", "Output limits must not claim complete extraction");
      assert.match(capped.failureReason ?? "", /pdf_native_text_truncated/);
      stub("pdftotext", `process.stdout.write(${JSON.stringify("\f".repeat(15) + pageText + "\f")})`);
      const sparse = await extractPdfTextIsolated(source);
      assert.equal(sparse.coverage, "partial", "Only the final page containing native text is incomplete");
      assert.equal(sparse.pagesProcessed, 16);
      assert.equal(sparse.pagesWithText, 1);
      stub("pdftotext", `process.stdout.write(${JSON.stringify(Array.from({ length: 16 }, () => "SCANNED ARCHIVE HEADER PAGE NUMBER ".repeat(20)).join("\f") + "\f")})`);
      const markers = await extractPdfTextIsolated(source);
      assert.equal(markers.coverage, "partial", "Repeated header words are not substantive native page evidence");
      assert.equal(markers.pagesWithText, 0);
      stub("pdftotext", "process.exit(3)");
      const rejected = await extractPdfTextIsolated(source);
      assert.match(rejected.failureReason ?? "", /native_tool_exit:pdftotext:3/);
      assert.equal(rejected.text, "", "A Poppler failure must not silently substitute potentially incomplete fallback text");
      rmSync(path.join(bin, "pdftotext"));
      assert.equal(preferredNativePdfBackend(), "pdf-parse");
      const fallback = await extractPdfTextIsolated(source);
      assert.equal(fallback.backend, "pdf-parse");
      assert.equal(fallback.coverage, "unknown", "Fallback text has no verified page completeness");
      assert.match(fallback.text, /Official meeting motion approved/);
    } finally { process.env.PATH = originalPath; }

    if (process.platform !== "win32") {
      const marker = path.join(root, "grandchild-ticks.txt");
      const grandchildWorker = path.join(root, "grandchild.mjs");
      writeFileSync(grandchildWorker, `import { spawn } from 'node:child_process';\nspawn(process.execPath,['-e',${JSON.stringify(`const fs=require('node:fs'); fs.writeFileSync(${JSON.stringify(marker)},'start'); setInterval(()=>fs.appendFileSync(${JSON.stringify(marker)},'tick'),20);`)}],{stdio:'ignore'});\nwhile(true){}\n`);
      const groupTimeout = await extractPdfTextIsolated(source, { workerPath: grandchildWorker, timeoutMs: 500 });
      assert.match(groupTimeout.failureReason ?? "", /pdf_native_text_timeout/);
      assert.ok(existsSync(marker), "Fixture subprocess must have started before the hard timeout");
      const stopped = readFileSync(marker, "utf8");
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(readFileSync(marker, "utf8"), stopped, "Timed-out parser subprocesses must not survive their process group");
    }
    console.log("PDF isolation passed: Poppler preference, missing-tool fallback, page coverage, bounded output, hard timeout/process-group cleanup, source limits, and real PDF extraction.");
  } finally { rmSync(root, { recursive: true, force: true }); }
}

main().catch((error) => { console.error(error); process.exit(1); });
