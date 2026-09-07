import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, statfs, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { get, head, list, put } from "@vercel/blob";
import { releaseArtifactAllowed, validateManifest, workerArtifactAllowed, type ArtifactEntry, type CivicManifest } from "./artifact-policy";

export async function fileHash(file: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

export async function mapBounded<T, R>(values: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("invalid_artifact_concurrency");
  const results: R[] = new Array(values.length);
  let next = 0;
  let failed = false;
  let firstFailure: unknown;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (!failed && next < values.length) {
      const index = next++;
      try { results[index] = await work(values[index]); }
      catch (error) { if (!failed) firstFailure = error; failed = true; }
    }
  }));
  // Drain already-started work before the caller removes staging files or exits;
  // otherwise Promise.all's early rejection leaves background downloads running.
  if (failed) throw firstFailure;
  return results;
}

async function collectFiles(root: string, directory: string): Promise<string[]> {
  const items = await readdir(path.join(root, directory), { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return []; throw error; });
  const files: string[] = [];
  for (const item of items) {
    const relative = path.posix.join(directory, item.name);
    if (item.isSymbolicLink() || item.name.startsWith(".") || /(?:private|session|cookie|blocked|quarantine)/i.test(item.name)) continue;
    if (item.isDirectory()) files.push(...await collectFiles(root, relative));
    else if (workerArtifactAllowed(relative)) files.push(relative);
  }
  return files;
}

export async function selectArtifactPaths(root: string, kind: CivicManifest["kind"]) {
  if (kind === "release") return (await readdir(path.join(root, "data/generated"))).map((name) => `data/generated/${name}`).filter(releaseArtifactAllowed).sort();
  const files = [...await collectFiles(root, "data/generated"), ...await collectFiles(root, "data/raw"), ...await collectFiles(root, "data/imports/political-ads")];
  // Include historical manually saved official documents only when the existing
  // evidence ledger references them, rather than traversing operator storage.
  const index = JSON.parse(await readFile(path.join(root, "data/generated/public-meeting-document-cache-index.json"), "utf8").catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return "{}"; throw error; }));
  for (const record of index.records ?? []) {
    const name = record.stableLocalPath;
    if (typeof name === "string" && workerArtifactAllowed(name) && name.startsWith("data/manual-sources/") && await stat(path.join(root, name)).then(() => true, () => false)) files.push(name);
  }
  return [...new Set(files)].sort();
}

export async function describeArtifacts(root: string, paths: string[]): Promise<ArtifactEntry[]> {
  return mapBounded(paths, 4, async (relative) => {
    if (!workerArtifactAllowed(relative)) throw new Error("snapshot_path_not_allowed");
    await rejectSymlinkParents(root, relative);
    const file = path.join(root, relative);
    const metadata = await lstat(file);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`artifact_is_not_regular_file:${relative}`);
    const sha256 = await fileHash(file);
    const after = await stat(file);
    if (metadata.size !== after.size || metadata.mtimeMs !== after.mtimeMs) throw new Error(`artifact_changed_during_snapshot:${relative}`);
    return { path: relative, sha256, bytes: metadata.size, objectKey: `civic-data/objects/${sha256}` };
  });
}

export async function existingArtifactObjects() {
  const objects = new Map<string, number>();
  for (const prefix of ["public-meeting-cache/sha256/", "civic-data/objects/"]) {
    let cursor: string | undefined;
    do {
      const result = await list({ prefix, cursor, limit: 1000, abortSignal: AbortSignal.timeout(30_000) });
      for (const blob of result.blobs) objects.set(blob.pathname, blob.size);
      if (!result.hasMore) break;
      cursor = result.cursor;
    } while (cursor);
  }
  return objects;
}

export async function uploadArtifact(root: string, entry: ArtifactEntry, inventory?: Map<string, number>) {
  // Reuse the established content-addressed meeting archive when possible.
  for (const key of [`public-meeting-cache/sha256/${entry.sha256.slice(0, 2)}/${entry.sha256}`, entry.objectKey]) {
    if (inventory) {
      const bytes = inventory.get(key);
      if (bytes === undefined) continue;
      if (bytes !== entry.bytes) throw new Error(`stored_artifact_size_mismatch:${entry.path}`);
      return { ...entry, objectKey: key };
    }
    try {
      const existing = await head(key, { abortSignal: AbortSignal.timeout(30_000) });
      if (existing.size === entry.bytes) return { ...entry, objectKey: key };
      throw new Error(`stored_artifact_size_mismatch:${entry.path}`);
    } catch (error) {
      if (!(error instanceof Error) || !/(not found|does not exist)/i.test(error.message)) throw error;
    }
  }
  if (await fileHash(path.join(root, entry.path)) !== entry.sha256) throw new Error(`artifact_changed_before_upload:${entry.path}`);
  await rejectSymlinkParents(root, entry.path);
  const uploadStream = Readable.from((async function* () {
    const hash = createHash("sha256");
    let bytes = 0;
    for await (const chunk of createReadStream(path.join(root, entry.path))) {
      bytes += chunk.length;
      if (bytes > entry.bytes) throw new Error("artifact_changed_during_stream_upload");
      hash.update(chunk);
      yield chunk;
    }
    if (bytes !== entry.bytes || hash.digest("hex") !== entry.sha256) throw new Error("artifact_changed_during_stream_upload");
  })());
  await put(entry.objectKey, uploadStream, { access: "private", addRandomSuffix: false, contentType: "application/octet-stream", multipart: entry.bytes > 5_000_000, abortSignal: AbortSignal.timeout(300_000) });
  const result = await head(entry.objectKey, { abortSignal: AbortSignal.timeout(30_000) });
  if (result.size !== entry.bytes) throw new Error(`artifact_upload_size_mismatch:${entry.path}`);
  inventory?.set(entry.objectKey, entry.bytes);
  return entry;
}

export async function readManifest(kind: CivicManifest["kind"], id = "latest", readObject = get): Promise<CivicManifest | null> {
  if (id !== "latest" && !/^[a-f0-9]{64}$/.test(id)) throw new Error("invalid_manifest_id");
  const response = await readObject(`civic-data/${kind}/${id}.json`, { access: "private", useCache: false, abortSignal: AbortSignal.timeout(30_000) });
  if (!response) return null;
  if (response.statusCode !== 200 || !response.stream) throw new Error("manifest_read_failed");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for await (const chunk of response.stream as unknown as AsyncIterable<Uint8Array>) {
    bytes += chunk.byteLength;
    if (bytes > 64 * 1024 * 1024) throw new Error("civic_manifest_too_large");
    chunks.push(chunk);
  }
  const value = validateManifest(JSON.parse(Buffer.concat(chunks).toString("utf8")) as CivicManifest, kind);
  if (id !== "latest" && value.id !== id) throw new Error("manifest_path_identity_mismatch");
  return value;
}

export async function saveManifest(manifest: CivicManifest, writeObject = put, readObject = get, options: { rollback?: boolean } = {}) {
  validateManifest(manifest, manifest.kind);
  const existingVersion = await readManifest(manifest.kind, manifest.id, readObject);
  const previous = await readManifest(manifest.kind, "latest", readObject);
  if (options.rollback && !existingVersion) throw new Error("rollback_requires_existing_immutable_manifest");
  if (!options.rollback && previous && Date.parse(previous.createdAt) > Date.parse(manifest.createdAt)) throw new Error("stale_manifest_cannot_replace_latest");
  const body = JSON.stringify(manifest);
  if (!existingVersion) {
    try {
      await writeObject(`civic-data/${manifest.kind}/${manifest.id}.json`, body, { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: "application/json", abortSignal: AbortSignal.timeout(30_000) });
    } catch (error) {
      // A concurrent retry may have created this exact immutable version. A
      // different body cannot share its validated content/provenance identity.
      if (!await readManifest(manifest.kind, manifest.id, readObject)) throw error;
    }
  }
  // Commit point: all immutable objects and the versioned manifest exist first.
  await writeObject(`civic-data/${manifest.kind}/latest.json`, body, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", abortSignal: AbortSignal.timeout(30_000) });
}

async function rejectSymlinkParents(root: string, relative: string) {
  let cursor = root;
  for (const part of relative.split("/")) {
    cursor = path.join(cursor, part);
    const metadata = await lstat(cursor).catch(() => null);
    if (metadata?.isSymbolicLink()) throw new Error("artifact_symlink_forbidden");
  }
}

export async function restoreManifest(root: string, manifest: CivicManifest, readObject = get, options: { renameFile?: typeof rename } = {}) {
  const moveFile = options.renameFile ?? rename;
  validateManifest(manifest, manifest.kind);
  await rejectSymlinkParents(root, ".local/civic-restore");
  await mkdir(path.join(root, ".local/civic-restore"), { recursive: true });
  const stage = await mkdtemp(path.join(root, ".local/civic-restore/attempt-"));
  let restored = 0;
  const changed: ArtifactEntry[] = [];
  const committed: Array<{ destination: string; backup: string | null }> = [];
  let retainRecoveryFiles = false;
  try {
    for (const entry of manifest.files) {
      await rejectSymlinkParents(root, entry.path);
      const destination = path.join(root, entry.path);
      const metadata = await lstat(destination).catch(() => null);
      if (metadata && !metadata.isFile()) throw new Error(`artifact_destination_not_regular_file:${entry.path}`);
      if (metadata?.size === entry.bytes && await fileHash(destination) === entry.sha256) continue;
      changed.push(entry);
    }
    const disk = await statfs(root);
    const available = Number(disk.bavail) * Number(disk.bsize);
    const required = changed.reduce((sum, entry) => sum + entry.bytes, 0);
    if (required > available - 256 * 1024 * 1024) throw new Error("insufficient_disk_space_for_atomic_civic_restore");
    await mapBounded(changed, 4, async (entry) => {
      const staging = path.join(stage, "next", entry.path);
      await mkdir(path.dirname(staging), { recursive: true });
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await readObject(entry.objectKey, { access: "private", useCache: false, abortSignal: AbortSignal.timeout(300_000) });
          if (!response || response.statusCode !== 200 || !response.stream) throw new Error(`missing_artifact:${entry.path}`);
          let bytes = 0;
          const hash = createHash("sha256");
          const verify = new Transform({ transform(chunk: Buffer, _encoding, callback) {
            bytes += chunk.length;
            if (bytes > entry.bytes) { callback(new Error("artifact_download_exceeds_manifest_size")); return; }
            hash.update(chunk); callback(null, chunk);
          }});
          await pipeline(Readable.fromWeb(response.stream as import("node:stream/web").ReadableStream), verify, createWriteStream(staging, { flags: "wx" }));
          if (bytes !== entry.bytes || hash.digest("hex") !== entry.sha256) throw new Error(`artifact_integrity_failed:${entry.path}:expected=${entry.bytes}:received=${bytes}`);
          break;
        } catch (error) {
          await rm(staging, { force: true });
          if (attempt === 3) throw error;
          // A short HTTP 200 or interrupted large-object stream must never be
          // installed. Retry from byte zero and verify the complete object again.
          console.log(`Retrying civic artifact download after integrity/transport failure (${attempt}/3).`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
      restored++;
      if (restored % 500 === 0) console.log(`Restored and verified ${restored}/${changed.length} civic artifacts.`);
    });
    // Preflight directories before changing a live file. Retain originals in the
    // same filesystem so a commit failure can roll back every already moved file.
    for (const entry of changed) {
      await rejectSymlinkParents(root, entry.path);
      await mkdir(path.dirname(path.join(root, entry.path)), { recursive: true });
    }
    try {
      for (const entry of changed) {
        const destination = path.join(root, entry.path);
        const staging = path.join(stage, "next", entry.path);
        await rejectSymlinkParents(root, entry.path);
        const present = await lstat(destination).catch(() => null);
        if (present && !present.isFile()) throw new Error("artifact_destination_changed_during_restore");
        const backup = present ? path.join(stage, "previous", entry.path) : null;
        if (backup) { await mkdir(path.dirname(backup), { recursive: true }); await moveFile(destination, backup); }
        committed.push({ destination, backup });
        await moveFile(staging, destination);
      }
    } catch (error) {
      let rollbackFailed = false;
      for (const item of committed.reverse()) {
        try { await rm(item.destination, { force: true }); if (item.backup) await moveFile(item.backup, item.destination); }
        catch { rollbackFailed = true; }
      }
      if (rollbackFailed) { retainRecoveryFiles = true; throw new Error("civic_restore_rollback_failed_originals_retained_in_staging"); }
      throw error;
    }
    await mkdir(path.join(root, ".local"), { recursive: true });
    const receipt = path.join(root, `.local/civic-${manifest.kind}-restored.json`);
    const pendingReceipt = path.join(stage, "restore-receipt.json");
    await writeFile(pendingReceipt, JSON.stringify({ id: manifest.id, restored, files: manifest.files.length, at: new Date().toISOString() }));
    await rename(pendingReceipt, receipt);
    return { id: manifest.id, restored, files: manifest.files.length };
  } finally {
    // Never reuse staging from a failed attempt. If a rare filesystem rollback
    // fails, retain the original backups for operator recovery.
    if (!retainRecoveryFiles) await rm(stage, { recursive: true, force: true });
  }
}
