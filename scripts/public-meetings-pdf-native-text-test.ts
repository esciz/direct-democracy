import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractPdfTextIsolated } from "../lib/public-meetings/pdf-native-text";

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
    console.log("PDF isolation tests passed: CPU-bound hard timeout, next-document continuation, size guard, missing-source recovery, and real native PDF extraction.");
  } finally { rmSync(root, { recursive: true, force: true }); }
}

main().catch((error) => { console.error(error); process.exit(1); });
