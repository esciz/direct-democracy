import assert from "node:assert/strict";
import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { archiveBackend, archiveGet, archiveHead, archiveList, archivePut, assertArchiveKey, r2Configuration, r2Store } from "@/lib/dataops/archive-store";

async function main() {
  assert.equal(archiveBackend({}), "vercel_blob");
  assert.throws(() => archiveBackend({ CIVIC_ARCHIVE_BACKEND: "typo" }), /invalid/);
  assert.throws(() => r2Configuration({}), /missing/);
  const key = `civic-data/objects/${"a".repeat(64)}`;
  assertArchiveKey(key);
  for (const invalid of ["https://example.com/a", "profile-media/a", "civic-data/../secret", "civic-data/objects/no-hash"]) assert.throws(() => assertArchiveKey(invalid));
  Object.assign(process.env, {
    CIVIC_ARCHIVE_BACKEND: "r2", CIVIC_R2_ACCOUNT_ID: "a".repeat(32), CIVIC_R2_BUCKET: "test-civic-archive",
    CIVIC_R2_ACCESS_KEY_ID: "fixture", CIVIC_R2_SECRET_ACCESS_KEY: "fixture",
  });
  const store = r2Store();
  const send = store.client.send;
  let command: unknown;
  let result: unknown;
  let failure: unknown;
  store.client.send = (async (value: unknown) => { command = value; if (failure) throw failure; return result; }) as typeof send;
  try {
    result = { Body: { transformToWebStream: () => new Response("evidence").body } };
    const response = await archiveGet(key, { access: "private" });
    assert.ok(command instanceof GetObjectCommand);
    assert.equal(await new Response(response?.stream).text(), "evidence");
    failure = { $metadata: { httpStatusCode: 404 } };
    assert.equal(await archiveGet(key, { access: "private" }), null);
    await assert.rejects(archiveHead(key), /not found/);
    failure = new Error("AccessDenied");
    await assert.rejects(archiveGet(key, { access: "private" }), /AccessDenied/);
    await assert.rejects(archiveHead(key), /AccessDenied/);
    failure = undefined;
    result = { ContentLength: 8 };
    assert.equal((await archiveHead(key)).size, 8);
    assert.ok(command instanceof HeadObjectCommand);
    result = { Contents: [{ Key: key, Size: 8 }], IsTruncated: true, NextContinuationToken: "page-2" };
    assert.deepEqual(await archiveList({ prefix: "civic-data/objects/", cursor: "page-1" }), { blobs: [{ pathname: key, size: 8 }], hasMore: true, cursor: "page-2" });
    assert.ok(command instanceof ListObjectsV2Command);
    assert.equal(command.input.ContinuationToken, "page-1");
    result = {};
    await archivePut("civic-data/worker/latest.json", "{}", { access: "private", allowOverwrite: true });
    assert.ok(command instanceof PutObjectCommand);
    assert.equal(command.input.IfNoneMatch, undefined);
    await archivePut(`civic-data/worker/${"a".repeat(64)}.json`, "{}", { access: "private", allowOverwrite: false });
    assert.ok(command instanceof PutObjectCommand);
    assert.equal(command.input.IfNoneMatch, "*");
    delete process.env.CIVIC_R2_SECRET_ACCESS_KEY;
    await assert.rejects(archiveGet(key, { access: "private" }), /missing_civic_archive_setting/);
  } finally { store.client.send = send; store.client.destroy(); }
  console.log("Civic R2 archive: scoped paths, streaming reads, pagination, immutable manifests and no Blob fallback passed.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
