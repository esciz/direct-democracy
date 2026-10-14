/** Read incrementally so oversized or stalled documents cannot monopolize the ingestion worker. */
export async function readBoundedDocumentBody(response: Response, maxBytes: number, signal: AbortSignal): Promise<Buffer> {
  if (!Number.isFinite(maxBytes) || maxBytes < 1) throw new Error("invalid_download_size_limit");
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) {
    void response.body?.cancel().catch(() => undefined);
    throw new Error("download_size_limit_exceeded");
  }
  if (signal.aborted) {
    void response.body?.cancel().catch(() => undefined);
    throw new Error("download_timeout_or_aborted");
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  let onAbort: () => void = () => undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => {
      reject(new Error("download_timeout_or_aborted"));
      void reader.cancel().catch(() => undefined);
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const result = await Promise.race([reader.read(), aborted]);
      if (result.done) break;
      length += result.value.byteLength;
      if (length > maxBytes) {
        void reader.cancel().catch(() => undefined);
        throw new Error("download_size_limit_exceeded");
      }
      chunks.push(result.value);
    }
    return Buffer.concat(chunks, length);
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    signal.removeEventListener("abort", onAbort);
    try { reader.releaseLock(); } catch { /* An aborted native stream may still be releasing its pending read. */ }
  }
}
