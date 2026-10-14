import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, utimes, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { checkPublicSource, mapConcurrent } from "../lib/civic-sources/source-health";
import { federalCourtLayer, isStateAppellateCase, mergeReviewedCourtRecords } from "../lib/civic-sources/court-records";

async function main() {
  const server = createServer((req, res) => {
    if (req.url === "/403") { res.writeHead(403); res.end("Forbidden"); }
    else if (req.url === "/challenge") { res.end("<title>Just a moment</title><div>cf-chl-x</div>"); }
    else if (req.url === "/stall") { res.writeHead(200); res.write("<html>"); }
    else res.end("<html><h1>Official organization</h1></html>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const temporary = await mkdtemp(path.join(os.tmpdir(), "dd-public-source-test-"));
  try {
    const old = { checkedAt: "2026-01-01T00:00:00Z", ok: true, status: 200 };
    const restricted = await checkPublicSource(`${base}/403`, old);
    assert.equal(restricted.ok, false); assert.equal(restricted.outcome, "access_restricted"); assert.equal(restricted.lastSuccessfulAt, old.checkedAt);
    assert.equal((await checkPublicSource(`${base}/challenge`)).outcome, "challenge");
    const began = Date.now(); assert.equal((await checkPublicSource(`${base}/stall`, null, 50)).ok, false); assert.ok(Date.now() - began < 1000);
    assert.equal((await checkPublicSource(`${base}/good`)).ok, true);
    let active = 0, peak = 0;
    await mapConcurrent(Array.from({ length: 12 }), 3, async () => { active++; peak = Math.max(peak, active); await new Promise((resolve) => setTimeout(resolve, 5)); active--; });
    assert.equal(peak, 3);
    const stateAppeals = { courtName: "Nevada Court of Appeals", courtLevel: "state" };
    assert.equal(federalCourtLayer(stateAppeals), null); assert.equal(isStateAppellateCase(stateAppeals), true);
    assert.equal(isStateAppellateCase({ courtName: "First Judicial District Court", courtLevel: "state" }), false);
    assert.equal(federalCourtLayer({ courtName: "United States Court of Appeals for the Ninth Circuit", courtLevel: "federal" }), "circuit_appellate");
    const record = { id: "old", caseNumber: "1", courtName: "Nevada Supreme Court", reviewStatus: "approved", publicVisibilityStatus: "public", isRealCourtRecord: true };
    assert.equal(mergeReviewedCourtRecords([record], [], []).length, 1, "Partial imports retain history");
    assert.equal(mergeReviewedCourtRecords([record], [], [{ ...record, publicVisibilityStatus: "sealed" }]).length, 0, "Explicit exclusions remove old public runtime rows");
    const rawDir = path.join(temporary, "data/raw/nevada-organizations"); const seedDir = path.join(temporary, "data/seed");
    await mkdir(rawDir, { recursive: true }); await mkdir(seedDir, { recursive: true });
    const csv = "EIN,NAME,CITY,STATE,SUBSECTION,STATUS,TAX_PERIOD,NTEE_CD,SORT_NAME\n123456789,TEST PUBLIC ORGANIZATION,CARSON CITY,NV,03,01,202512,B01,\n";
    const cache = path.join(rawDir, "irs-eo-bmf-nevada.csv"); await writeFile(cache, csv); await utimes(cache, new Date(0), new Date(0));
    await writeFile(path.join(seedDir, "nevada-public-organization-catalog.json"), JSON.stringify({ version: 1, updatedAt: "2026-09-01", sources: [{ id: "irs-eo-bmf-nevada", sourceUrl: `${base}/challenge`, cadenceDays: 7 }], organizations: [{ id: "fixture", name: "Test", category: "nonprofit", organizationType: "nonprofit", description: "test", scope: "local", communityIds: ["carson-city"], headquarters: "Carson City", websiteUrl: `${base}/good`, affiliationUrl: `${base}/good`, issueTags: [], irsNames: ["TEST PUBLIC ORGANIZATION"] }] }));
    const root = process.cwd();
    const exitCode = await new Promise<number | null>((resolve, reject) => { const child = spawn(process.execPath, ["--import", path.join(root, "node_modules/tsx/dist/loader.mjs"), path.join(root, "scripts/collect-nevada-organizations.ts"), "--first-pass"], { cwd: temporary, env: { ...process.env, DATAOPS_NETWORK_ENABLED: "true" }, stdio: "ignore" }); child.on("error", reject); child.on("exit", resolve); });
    assert.equal(exitCode, 1, "An invalid fresh IRS response must report degraded collection");
    assert.equal(await readFile(cache, "utf8"), csv, "A challenge response must not overwrite last good IRS evidence");
    const output = JSON.parse(await readFile(path.join(temporary, "data/generated/nevada-public-organizations.json"), "utf8"));
    assert.equal(output.irsSourceHealth.status, "cached_after_failure"); assert.equal(output.records[0].registry.irsMatched, true); assert.equal(output.records[0].websiteHealth.ok, true, "Other source work must continue after IRS failure");
    console.log("Public source collection: real status/challenge/body-deadline detection, last-success metadata, bounded concurrency, court classification/history/privacy, and IRS last-good recovery passed.");
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); await rm(temporary, { recursive: true, force: true }); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
