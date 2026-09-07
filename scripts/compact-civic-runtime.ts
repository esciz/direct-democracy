import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { selectArtifactPaths } from "@/lib/dataops/blob-checkpoint";

// Only generated public runtime files are normalized. Full worker evidence,
// source caches, identity records and source JSON in other roots are untouched.
async function main() {
  const root = process.cwd();
  const graph = JSON.parse(await readFile(path.join(root, "data/generated/accountability-graph.json"), "utf8"));
  const summary = { generatedAt: graph.generatedAt, sourceArtifacts: graph.sourceArtifacts, totals: graph.totals, communitySummaries: graph.communitySummaries };
  if (!summary.communitySummaries || !summary.totals) throw new Error("missing_accountability_summary");
  const runtime = path.join(root, "data/generated/accountability-graph-runtime.json");
  await writeFile(`${runtime}.tmp`, JSON.stringify(summary) + "\n");
  await rename(`${runtime}.tmp`, runtime);
  let before = 0; let after = 0;
  const files = await selectArtifactPaths(root, "release");
  for (const relative of files) {
    const file = path.join(root, relative);
    const original = await readFile(file, "utf8");
    const compact = JSON.stringify(JSON.parse(original)) + "\n";
    before += Buffer.byteLength(original); after += Buffer.byteLength(compact);
    if (compact === original) continue;
    await writeFile(`${file}.tmp`, compact);
    await rename(`${file}.tmp`, file);
  }
  console.log(JSON.stringify({ files: files.length, bytesBefore: before, bytesAfter: after, fullWorkerGraphPreserved: true }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
