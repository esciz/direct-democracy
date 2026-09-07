import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rename, rm, statfs, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { REQUIRED_RELEASE_FILES, civicManifestId, releaseArtifactAllowed, validateManifest, workerArtifactAllowed, type ArtifactEntry, type CivicManifest } from "@/lib/dataops/artifact-policy";
import { describeArtifacts, mapBounded, readManifest, restoreManifest, saveManifest, selectArtifactPaths } from "@/lib/dataops/blob-checkpoint";
import { releaseGateAt } from "./civic-artifacts";

const at = Date.parse("2026-09-06T12:00:00Z");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const entry = (name: string, body: string): ArtifactEntry => ({ path: `data/generated/${name}`, bytes: Buffer.byteLength(body), sha256: hash(body), objectKey: `civic-data/objects/${hash(body)}` });
function manifest(files: ArtifactEntry[], updates: Partial<CivicManifest> = {}): CivicManifest {
  const value = { schemaVersion: 1 as const, kind: "worker" as const, createdAt: new Date(at).toISOString(), sourceCommit: "b".repeat(40), sourceDirty: false, files, metrics: {}, coverageComplete: false, ...updates };
  return { ...value, id: civicManifestId(value) };
}
const response = (body: string) => ({ statusCode: 200, stream: new Response(body).body });
function memoryStore() {
  const bodies = new Map<string, string>();
  const writes: Array<{ key: string; overwrite?: boolean }> = [];
  const read = (async (key: string) => bodies.has(key) ? response(bodies.get(key)!) : null) as unknown as typeof get;
  const write = (async (key: string, body: string, options: { allowOverwrite?: boolean }) => {
    writes.push({ key, overwrite: options.allowOverwrite });
    if (bodies.has(key) && !options.allowOverwrite) throw new Error("immutable object already exists");
    bodies.set(key, body);
    return {};
  }) as unknown as typeof put;
  return { bodies, writes, read, write };
}
async function writeJson(root: string, name: string, value: unknown) {
  await mkdir(path.join(root, "data/generated"), { recursive: true });
  await writeFile(path.join(root, "data/generated", name), JSON.stringify(value));
}
function generationReport(status = "succeeded", start = at - 120_000) {
  return { runId: "fixture", startedAt: new Date(start).toISOString(), completedAt: new Date(start + 60_000).toISOString(), stages: [{ status, commands: [
    ...["publish-public-meeting-runtime", "generate-voting-cards", "generate-issue-hubs"].map(name => ({ command: ["tsx", `scripts/${name}.ts`], status })),
    { command: ["tsx", "scripts/collect-public-meetings.ts"], status: "failed" },
    { command: ["tsx", "scripts/audit-upcoming-meeting-coverage.ts", "--strict"], status: "failed" },
  ] }] };
}
async function releaseFixture(root: string) {
  const datasets: Record<string, unknown> = {
    "events-runtime.json": [{ id: "meeting", meeting_alias_ids: ["historical-meeting"] }, { id: "other-meeting" }],
    "public-meeting-items-runtime.json": [{ id: "topic", meeting_id: "meeting" }],
    "voting-cards-runtime.json": [{ id: "question", meeting_id: "historical-meeting", topic_item_id: "topic" }],
    "voting-cards.json": { records: [{ id: "decision", meetingId: "historical-meeting" }] },
    "accountability-graph-runtime.json": { generatedAt: new Date(at).toISOString(), communitySummaries: {} },
    "issues-runtime.json": { records: [{ id: "issue", relatedMeetingIds: ["historical-meeting"] }] },
    "nevada-financial-coverage.json": { records: [{ entityType: "official", entityId: "official-one", campaignFinance: { snapshot: { totalRaised: 1200, totalSpent: 800, cashOnHand: null } } }] },
    "nevada-political-ads.json": { ads: [{ id: "ad-filing" }] },
    "nevada-public-organizations.json": { records: [{ id: "organization" }] },
    "public-site-integrity-audit.json": { generatedAt: new Date(at - 60_000).toISOString(), launchReady: false, totals: { critical: 0 } },
    "meetings-pipeline-run.json": generationReport(),
  };
  for (const [name, body] of Object.entries(datasets)) await writeJson(root, name, body);
  return datasets;
}

async function main() {
  const root = await mkdtemp(path.join(os.tmpdir(), "civic-artifacts-"));
  try {
    for (const name of ["../.env", "data/private/identity/identity-store.json", "data/generated/nv-sos-session.json", "data/raw/nv-sos/blocked/cookie.json", "data/generated/../private/a.json", "data/generated/meetings-pipeline-run 2.json", "data/generated/.dataops-pipeline.lock", "data/imports/political-ads/resident-uploads.json", "data/imports/political-ads/fec-api-token.json"]) assert.equal(workerArtifactAllowed(name), false, name);
    for (const name of REQUIRED_RELEASE_FILES) assert.equal(releaseArtifactAllowed(name), true, name);
    for (const name of ["data/imports/political-ads/fec-collection-state.json", "data/imports/political-ads/fec-nevada-independent-expenditures.json", "data/raw/nevada-financials/sitemap.xml", "data/generated/dataops-pipeline-targeted-run.json"]) assert.equal(workerArtifactAllowed(name), true, name);
    assert.equal(releaseArtifactAllowed("data/generated/public-meeting-items.json"), false);
    assert.equal(workerArtifactAllowed("data/generated/public-meeting-document-cache/source/one.pdf"), true);
    assert.equal(releaseArtifactAllowed("data/generated/public-meeting-document-cache/source/one.pdf"), false);
    assert.equal(releaseArtifactAllowed("data/imports/political-ads/fec-collection-state.json"), false);
    const valid = entry("events-runtime.json", "[]");
    const original = manifest([valid]);
    validateManifest(original, "worker");
    for (const change of [{ createdAt: new Date(at + 1000).toISOString() }, { metrics: { meetings: 1 } }, { coverageComplete: true }, { sourceCommit: "c".repeat(40) }, { sourceDirty: true }, { files: [{ ...valid, objectKey: `public-meeting-cache/sha256/${valid.sha256.slice(0, 2)}/${valid.sha256}` }] }]) {
      assert.throws(() => validateManifest({ ...original, ...change }, "worker"), /identity_mismatch/);
    }
    assert.equal(civicManifestId(manifest([valid], { metrics: { a: 1, b: 2 } })), civicManifestId(manifest([valid], { metrics: { b: 2, a: 1 } })));
    assert.throws(() => validateManifest(manifest([{ ...valid, path: "data/private/identity.json" }]), "worker"), /invalid_artifact_entry/);
    assert.throws(() => validateManifest(manifest([{ ...valid, objectKey: "https://attacker.invalid/" }]), "worker"), /invalid_artifact_object_key/);
    assert.throws(() => validateManifest(manifest([valid, valid]), "worker"), /invalid_artifact_entry/);
    assert.throws(() => validateManifest(manifest([valid], { kind: "release" }), "release"), /missing_release_artifact/);
    assert.throws(() => validateManifest(manifest([valid], { metrics: { negative: -1 } }), "worker"), /provenance_or_metrics/);
    assert.throws(() => validateManifest(manifest([valid, { ...valid, path: "data/generated/issues-runtime.json", bytes: valid.bytes + 1 }]), "worker"), /content_hash_size/);

    const started: number[] = [];
    let drain: (() => void) | undefined;
    let settled = false;
    const pending = mapBounded([0, 1, 2, 3], 2, async value => {
      started.push(value);
      if (value === 0) throw new Error("fixture failure");
      await new Promise<void>(resolve => { drain = resolve; });
      settled = true;
      return value;
    });
    const rejected = assert.rejects(pending, /fixture failure/);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(started, [0, 1]);
    assert.equal(settled, false);
    drain!();
    await rejected;
    assert.equal(settled, true, "in-flight work must finish before cleanup");
    assert.deepEqual(started, [0, 1], "failure must stop scheduling more work");

    await mkdir(path.join(root, "data/generated"), { recursive: true });
    await writeFile(path.join(root, valid.path), '["last-good"]');
    const readBad = (async () => response("wrong hash")) as unknown as typeof get;
    await assert.rejects(restoreManifest(root, original, readBad));
    assert.equal(await readFile(path.join(root, valid.path), "utf8"), '["last-good"]');
    let readAttempts = 0;
    const readGood = (async () => response(++readAttempts === 1 ? "[" : "[]")) as unknown as typeof get;
    assert.equal((await restoreManifest(root, original, readGood)).restored, 1);
    assert.equal(readAttempts, 2, "A truncated successful HTTP response is retried and reverified before installation");
    const noRead = (async () => { throw new Error("unchanged files must not download"); }) as unknown as typeof get;
    assert.equal((await restoreManifest(root, original, noRead)).restored, 0);
    assert.deepEqual(await readdir(path.join(root, ".local/civic-restore")), []);

    // Verify all downloads before replacing any current file, including a retry
    // after the first file staged successfully and a later file was corrupt.
    const second = entry("issues-runtime.json", '{"records":[]}');
    const both = manifest([valid, second]);
    await writeFile(path.join(root, valid.path), "old events");
    await writeFile(path.join(root, second.path), "old issues");
    await assert.rejects(restoreManifest(root, both, (async (key: string) => response(key === valid.objectKey ? "[]" : "corrupt")) as unknown as typeof get));
    assert.equal(await readFile(path.join(root, valid.path), "utf8"), "old events");
    assert.equal(await readFile(path.join(root, second.path), "utf8"), "old issues");
    await writeFile(path.join(root, valid.path), "[]");
    assert.equal((await restoreManifest(root, both, (async (key: string) => {
      assert.equal(key, second.objectKey, "retry must never reuse or download already-correct earlier staging");
      return response('{"records":[]}');
    }) as unknown as typeof get)).restored, 1);

    // A filesystem failure during the second commit restores both originals.
    await writeFile(path.join(root, valid.path), "old events");
    await writeFile(path.join(root, second.path), "old issues");
    let interrupted = false;
    await assert.rejects(restoreManifest(root, both, (async (key: string) => response(key === valid.objectKey ? "[]" : '{"records":[]}')) as unknown as typeof get, {
      renameFile: async (source, destination) => {
        if (!interrupted && String(source).includes(`${path.sep}next${path.sep}`) && destination === path.join(root, second.path)) { interrupted = true; throw new Error("fixture commit failure"); }
        return rename(source, destination);
      },
    }), /fixture commit failure/);
    assert.equal(await readFile(path.join(root, valid.path), "utf8"), "old events");
    assert.equal(await readFile(path.join(root, second.path), "utf8"), "old issues");
    assert.deepEqual(await readdir(path.join(root, ".local/civic-restore")), []);

    const disk = await statfs(root);
    const tooMany = Math.ceil(Number(disk.bavail) * Number(disk.bsize) / 1_000_000_000) + 1;
    if (tooMany <= 50_000) await assert.rejects(restoreManifest(root, manifest(Array.from({ length: tooMany }, (_, index) => ({ ...entry(`events-runtime-${index}.json`, String(index)), bytes: 1_000_000_000 }))), noRead), /insufficient_disk_space/);

    const store = memoryStore();
    await saveManifest(original, store.write, store.read);
    assert.deepEqual(store.writes, [{ key: `civic-data/worker/${original.id}.json`, overwrite: false }, { key: "civic-data/worker/latest.json", overwrite: true }]);
    assert.equal((await readManifest("worker", original.id, store.read))?.id, original.id);
    store.writes.length = 0;
    await saveManifest(original, store.write, store.read);
    assert.equal(store.writes.length, 1, "retry only writes latest; immutable version is never overwritten");
    const next = manifest([valid], { createdAt: new Date(at + 1000).toISOString() });
    await saveManifest(next, store.write, store.read);
    await assert.rejects(saveManifest(original, store.write, store.read), /stale_manifest/);
    await saveManifest(original, store.write, store.read, { rollback: true });
    assert.equal((await readManifest("worker", "latest", store.read))?.id, original.id);
    const absent = manifest([valid], { createdAt: new Date(at - 1000).toISOString() });
    await assert.rejects(saveManifest(absent, store.write, store.read, { rollback: true }), /requires_existing_immutable_manifest/);
    assert.equal((await readManifest("worker", "latest", store.read))?.id, original.id);
    store.bodies.set(`civic-data/worker/${next.id}.json`, JSON.stringify(original));
    await assert.rejects(readManifest("worker", next.id, store.read), /path_identity_mismatch/);
    const failed = memoryStore();
    const failedCalls: string[] = [];
    await assert.rejects(saveManifest(original, (async (key: string) => { failedCalls.push(key); throw new Error("fixture upload failed"); }) as unknown as typeof put, failed.read));
    assert.equal(failedCalls.length, 1, "failed immutable-version upload must not update latest");

    await mkdir(path.join(root, "outside"));
    await writeFile(path.join(root, "outside/one.pdf"), "[]");
    await symlink(path.join(root, "outside"), path.join(root, "data/generated/public-meeting-document-cache"));
    const linked = { ...valid, path: "data/generated/public-meeting-document-cache/one.pdf" };
    await assert.rejects(restoreManifest(root, manifest([linked]), readGood), /symlink/);
    await assert.rejects(describeArtifacts(root, [linked.path]), /symlink/);
    await writeJson(root, "public-meeting-document-cache-index.json", { records: [] });
    await writeJson(root, "identity-private.json", {});
    await mkdir(path.join(root, "data/imports/political-ads"), { recursive: true });
    for (const name of ["fec-collection-state.json", "fec-nevada-independent-expenditures.json", "resident-uploads.json"]) await writeFile(path.join(root, "data/imports/political-ads", name), "{}");
    const selected = await selectArtifactPaths(root, "worker");
    assert(!selected.some(name => /identity|outside|resident/.test(name)));
    assert(selected.includes("data/imports/political-ads/fec-collection-state.json"));
    assert(selected.includes("data/imports/political-ads/fec-nevada-independent-expenditures.json"));

    const fixtures = await releaseFixture(root);
    const current = releaseGateAt(root, { at });
    assert.equal(current.coverageComplete, false, "explicit coverage gaps and failed collection must preserve valid last-good data");
    assert.equal(current.metrics.meetings, 2);
    assert.equal(current.metrics.decisions, 1);
    const cases: Array<[string, unknown, RegExp]> = [
      ["public-meeting-items-runtime.json", [{ id: "topic", meeting_id: "missing" }], /topic_missing_meeting/],
      ["voting-cards-runtime.json", [{ id: "question", meeting_id: "other-meeting", topic_item_id: "topic" }], /invalid_topic_reference/],
      ["voting-cards-runtime.json", [{ id: "question", meeting_id: "meeting" }], /invalid_topic_reference/],
      ["voting-cards.json", { records: [{ id: "decision", meetingId: "missing" }] }, /decision_missing_meeting/],
      ["issues-runtime.json", { records: [{ id: "issue", relatedMeetingIds: ["missing"] }] }, /issue_missing_meeting/],
      ["nevada-financial-coverage.json", { records: [{ entityType: "official", entityId: "a", campaignFinance: { snapshot: { totalRaised: null, totalSpent: 0 } } }] }, /invalid_financial_amount/],
      ["nevada-political-ads.json", { ads: [{ id: "duplicate" }, { id: "duplicate" }] }, /invalid_identity/],
      ["nevada-public-organizations.json", { records: [] }, /empty_core_dataset/],
      ["public-site-integrity-audit.json", { generatedAt: new Date(at).toISOString(), launchReady: false, totals: { critical: 1 } }, /integrity_audit/],
      ["public-site-integrity-audit.json", { generatedAt: new Date(at - 25 * 60 * 60_000).toISOString(), launchReady: false, totals: { critical: 0 } }, /integrity_audit/],
      ["meetings-pipeline-run.json", generationReport("failed"), /core_generation_not_verified/],
      ["events-runtime.json", [{ id: "meeting", meeting_alias_ids: ["other-meeting"] }, { id: "other-meeting" }], /ambiguous_meeting_alias/],
    ];
    for (const [name, value, expected] of cases) {
      await writeJson(root, name, value);
      assert.throws(() => releaseGateAt(root, { at }), expected, name);
      await writeJson(root, name, fixtures[name]);
    }
    await writeJson(root, "dataops-pipeline-run.json", { startedAt: new Date(at - 5000).toISOString(), completedAt: "invalid", stages: [] });
    assert.throws(() => releaseGateAt(root, { at }), /collection_run_incomplete/);
    await rm(path.join(root, "data/generated/dataops-pipeline-run.json"));
    await writeJson(root, "meetings-pipeline-targeted-run.json", generationReport("failed", at - 30_000));
    assert.throws(() => releaseGateAt(root, { at }), /core_generation_not_verified/);
    await rm(path.join(root, "data/generated/meetings-pipeline-targeted-run.json"));
    await writeFile(path.join(root, "data/generated/.dataops-pipeline.lock"), "{}");
    assert.throws(() => releaseGateAt(root, { at }), /collector_is_active/);
    assert.equal(releaseGateAt(root, { at, historical: true }).coverageComplete, false);
    await rm(path.join(root, "data/generated/.dataops-pipeline.lock"));

    // Rollback validation uses original audit time, verifies stored bytes, and
    // recomputes the original counts before moving the pointer.
    const historicalFiles = await describeArtifacts(root, Object.keys(fixtures).map(name => `data/generated/${name}`).sort());
    const release = manifest(historicalFiles, { kind: "release", metrics: current.metrics });
    validateManifest(release, "release");
    const restoredRoot = await mkdtemp(path.join(os.tmpdir(), "civic-release-history-"));
    try {
      const objects = new Map(await Promise.all(historicalFiles.map(async file => [file.objectKey, await readFile(path.join(root, file.path), "utf8")] as const)));
      await restoreManifest(restoredRoot, release, (async (key: string) => objects.has(key) ? response(objects.get(key)!) : null) as unknown as typeof get);
      assert.deepEqual(releaseGateAt(restoredRoot, { at: Date.parse(release.createdAt), historical: true }).metrics, release.metrics);
      assert.throws(() => releaseGateAt(restoredRoot, { at: at + 48 * 60 * 60_000 }), /integrity_audit/);
    } finally { await rm(restoredRoot, { recursive: true, force: true }); }
    console.log("Civic artifact regression checks passed: privacy allowlist, FEC checkpoints, immutable provenance, interrupted restore/retry/rollback, disk and symlink boundaries, publication order, release cross-references, failed-generation gates, historical rollback validation.");
  } finally { await rm(root, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
