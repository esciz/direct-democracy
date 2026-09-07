import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { packCivicRuntime } from "./pack-civic-runtime";
import { PACKED_CIVIC_FILES, packedCivicPath, civicJsonPath, readCivicJson, readCivicJsonSync } from "@/lib/dataops/packed-runtime";

async function main() {
const root = await mkdtemp(path.join(os.tmpdir(), "dd-packed-runtime-"));
try {
  await mkdir(path.join(root, "data/generated"), { recursive: true });
  const fixture = { generatedAt: "2026-09-07T00:00:00Z", records: Array.from({ length: 100 }, (_, id) => ({ id: String(id), vote: "no", review: true, source: "Full original evidence — café", amount: null })) };
  for (const name of PACKED_CIVIC_FILES) await writeFile(path.join(root, "data/generated", name), JSON.stringify(fixture));
  const results = await packCivicRuntime(root);
  assert.equal(results.length, PACKED_CIVIC_FILES.length);
  for (const result of results) {
    assert.ok(result.packedBytes < result.bytes);
    const original = path.join(root, "data/generated", result.name);
    assert.equal(civicJsonPath(original), original, "Worker JSON takes precedence over a previous build copy");
    await rm(original);
    const packed = civicJsonPath(original)!;
    assert.equal(packed, packedCivicPath(original));
    assert.deepEqual(await readCivicJson(packed), fixture, "Production compressed-only read preserves every field and row");
    assert.deepEqual(readCivicJsonSync(packed), fixture);
    await writeFile(original, JSON.stringify({ records: [] }));
    assert.deepEqual(await readCivicJson(civicJsonPath(original)!), { records: [] }, "Fresh collection wins over stale compression");
    const valid = await readFile(packed);
    await writeFile(packed, valid.subarray(0, 20));
    await rm(original);
    await assert.rejects(readCivicJson(packed), "Damaged compressed evidence must never decode into partial records");
  }
  await packCivicRuntime(root);
  for (const name of PACKED_CIVIC_FILES) assert.equal(civicJsonPath(path.join(root, "data/generated", name)), null, "Missing source removes old build copy");
  console.log("Packed civic runtime passed: complete evidence, compressed-only deployment, fresh local precedence and corrupt-file rejection.");
} finally { await rm(root, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
