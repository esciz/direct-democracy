import "@/lib/env/load-local-env";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { get as blobGet } from "@vercel/blob";
import { archiveGet, archivePut, r2Configuration } from "@/lib/dataops/archive-store";
import { fileHash, mapBounded, readManifest, saveManifest } from "@/lib/dataops/blob-checkpoint";
import type { ArtifactEntry } from "@/lib/dataops/artifact-policy";

// Only the current complete worker archive and public release are required for
// cutover. Historical Blob snapshots are retained, never deleted by this tool.
// This avoids copying hundreds of GB of obsolete intermediate JSON versions.
async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("migration_source_blob_token_required");
  process.env.CIVIC_ARCHIVE_BACKEND = "r2";
  const source = await Promise.all([readManifest("worker", "latest", blobGet), readManifest("release", "latest", blobGet)]);
  const [worker, release] = source;
  if (!worker || !release) throw new Error("migration_requires_both_source_manifests");
  const files = new Map<string, ArtifactEntry>();
  for (const manifest of [worker, release]) for (const entry of manifest.files) {
    const previous = files.get(entry.objectKey);
    if (previous && (previous.sha256 !== entry.sha256 || previous.bytes !== entry.bytes)) throw new Error("migration_conflicting_object_identity");
    files.set(entry.objectKey, entry);
  }
  const bytes = [...files.values()].reduce((sum, item) => sum + item.bytes, 0);
  console.log(JSON.stringify({ mode: process.argv.includes("--copy") ? "copy_and_verify" : "dry_run", workerId: worker.id, releaseId: release.id, objects: files.size, bytes, gb: bytes / 1e9, historicalBlobObjects: "retained", profileMedia: "unchanged" }));
  if (!process.argv.includes("--copy")) return;
  r2Configuration();
  if (process.env.GITHUB_ACTIONS !== "true" && !process.argv.includes("--approve")) throw new Error("migration_copy_requires_approval");
  const directory = await mkdtemp(path.join(os.tmpdir(), "civic-r2-migration-"));
  let copied = 0; let verified = 0; let sourceBytes = 0;
  async function verifyR2(entry: ArtifactEntry) {
    const response = await archiveGet(entry.objectKey, { access: "private", abortSignal: AbortSignal.timeout(300_000) });
    if (!response) return false;
    if (response.statusCode !== 200 || !response.stream) throw new Error("migration_r2_read_failed");
    const hash = createHash("sha256"); let size = 0;
    for await (const chunk of Readable.fromWeb(response.stream as import("node:stream/web").ReadableStream)) {
      size += chunk.length;
      if (size > entry.bytes) throw new Error("migration_r2_size_mismatch");
      hash.update(chunk);
    }
    if (size !== entry.bytes || hash.digest("hex") !== entry.sha256) throw new Error("migration_r2_hash_mismatch");
    return true;
  }
  try {
    await mapBounded([...files.values()], 3, async entry => {
      if (!await verifyR2(entry)) {
        const staged = path.join(directory, createHash("sha256").update(entry.objectKey).digest("hex"));
        let local = path.join(process.cwd(), entry.path);
        const available = await stat(local).catch(() => null);
        if (!available?.isFile() || available.size !== entry.bytes || await fileHash(local) !== entry.sha256) {
          local = staged;
          const response = await blobGet(entry.objectKey, { access: "private", abortSignal: AbortSignal.timeout(300_000) });
          if (!response || response.statusCode !== 200 || !response.stream) throw new Error("migration_source_object_missing");
          const hash = createHash("sha256"); let size = 0;
          const verifier = new Transform({ transform(chunk: Buffer, _encoding, next) {
            size += chunk.length;
            if (size > entry.bytes) { next(new Error("migration_source_size_exceeded")); return; }
            hash.update(chunk); next(null, chunk);
          } });
          await pipeline(Readable.fromWeb(response.stream as import("node:stream/web").ReadableStream), verifier, createWriteStream(staged, { flags: "wx" }));
          if (size !== entry.bytes || hash.digest("hex") !== entry.sha256) throw new Error("migration_source_hash_mismatch");
          sourceBytes += size;
        }
        await archivePut(entry.objectKey, createReadStream(local), { access: "private", multipart: true, contentType: "application/octet-stream", abortSignal: AbortSignal.timeout(300_000) });
        await verifyR2(entry);
        await rm(staged, { force: true });
        copied++;
      }
      verified++;
      if (verified % 100 === 0) console.log(JSON.stringify({ verified, total: files.size, copied, sourceBytes }));
    });
    // A stale migration cannot quietly replace a newer collection. The workflow
    // also shares the production single-writer lock across the full operation.
    for (const manifest of [worker, release]) {
      const latest = await readManifest(manifest.kind, "latest", blobGet);
      if (latest?.id !== manifest.id) throw new Error("migration_source_changed_retry_required");
    }
    // Publish discoverable manifests only after every referenced byte verified.
    for (const manifest of [worker, release]) await saveManifest(manifest);
    for (const manifest of [worker, release]) {
      if ((await readManifest(manifest.kind))?.id !== manifest.id) throw new Error("migration_manifest_verification_failed");
    }
    console.log(JSON.stringify({ status: "r2_archive_verified_ready_for_cutover", workerId: worker.id, releaseId: release.id, verified, copied, sourceBytes, sourceDeleted: false }));
  } finally { await rm(directory, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "civic_r2_migration_failed"); process.exitCode = 1; });
