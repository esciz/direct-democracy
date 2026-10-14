import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { PACKED_CIVIC_FILES, packedCivicPath } from "@/lib/dataops/packed-runtime";

export async function packCivicRuntime(root = process.cwd()) {
  const results = [];
  for (const name of PACKED_CIVIC_FILES) {
    const original = path.join(root, "data/generated", name);
    const packedPath = packedCivicPath(original);
    const source = await readFile(original).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!source) { await rm(packedPath, { force: true }); continue; }
    JSON.parse(source.toString("utf8"));
    const packed = gzipSync(source, { level: 9 });
    if (!gunzipSync(packed).equals(source)) throw new Error(`packed_runtime_roundtrip_failed:${name}`);
    await writeFile(`${packedPath}.tmp`, packed);
    await rename(`${packedPath}.tmp`, packedPath);
    results.push({ name, bytes: source.length, packedBytes: packed.length });
  }
  return results;
}

if (process.argv[1]?.endsWith("pack-civic-runtime.ts")) {
  packCivicRuntime().then(result => console.log(JSON.stringify({ lossless: true, files: result }))).catch(error => {
    console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1;
  });
}
