import assert from "node:assert/strict";
import { readBoundedDocumentBody } from "@/lib/public-meetings/document-download";

async function main() {
  const bytes = await readBoundedDocumentBody(new Response("minutes"), 7, new AbortController().signal);
  assert.equal(bytes.toString(), "minutes");
  await assert.rejects(readBoundedDocumentBody(new Response("minutes", { headers: { "content-length": "90000000" } }), 10, new AbortController().signal), /download_size_limit_exceeded/);
  let oversizeCancelled = false;
  const oversized = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(6)); controller.enqueue(new Uint8Array(6)); }, cancel() { oversizeCancelled = true; } });
  await assert.rejects(readBoundedDocumentBody(new Response(oversized), 10, new AbortController().signal), /download_size_limit_exceeded/);
  assert.equal(oversizeCancelled, true, "Chunked downloads must cancel immediately when the byte budget is exceeded");
  let timeoutCancelled = false;
  const hanging = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(2)); }, cancel() { timeoutCancelled = true; } });
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 20);
  const started = Date.now();
  try { await assert.rejects(readBoundedDocumentBody(new Response(hanging), 10, abort.signal), /download_timeout_or_aborted/); }
  finally { clearTimeout(timer); }
  assert.ok(Date.now() - started < 1000, "A stalled response body must be bounded independently of response headers");
  assert.equal(timeoutCancelled, true);
  const alreadyAborted = new AbortController(); alreadyAborted.abort();
  await assert.rejects(readBoundedDocumentBody(new Response("late"), 10, alreadyAborted.signal), /download_timeout_or_aborted/);
  console.log("Bounded meeting downloads: success, declared size, chunked oversize, stalled body, cancellation, and pre-aborted signal checks passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
