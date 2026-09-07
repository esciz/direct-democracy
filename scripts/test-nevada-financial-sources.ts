import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { finiteMoney, sourceDate, fetchFinancialBuffer, fetchFinancialCache, type FinancialSourceAttempt } from "../lib/financials/source-cache";
import { fecSnapshot, parseTransparencyPage, transparencyIdentityMatches } from "./collect-nevada-financials";

async function main() {
const folder = await mkdtemp(path.join(tmpdir(), "dd-finance-test-"));
const server = createServer((request, response) => {
  if (request.url === "/slow") { response.writeHead(200); response.write("partial"); return; }
  if (request.url === "/large") { response.writeHead(200); response.end("x".repeat(1024)); return; }
  response.end('{"results":[]}');
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const baseUrl = `http://127.0.0.1:${address.port}`;
try {
  for (const value of [null, undefined, "", " ", false, true, [], {}, "not-money"]) assert.equal(finiteMoney(value), null);
  assert.equal(finiteMoney(0), 0);
  assert.equal(finiteMoney("123.45"), 123.45);
  assert.equal(sourceDate("2026-06-30T00:00:00Z"), "2026-06-30");
  assert.equal(sourceDate("2026"), null);
  assert.equal(transparencyIdentityMatches("Zach Conine", "Zachary Conine", "https://www.transparencyusa.org/nv/candidate/zachary-conine", { "Zach Conine": "zachary-conine" }), true);
  assert.equal(transparencyIdentityMatches('Angela "Angie" Gianoli', "Angie Gianoli", "https://www.transparencyusa.org/nv/candidate/angie-gianoli", {}), true);
  assert.equal(transparencyIdentityMatches("Zach Conine", "Unrelated Candidate", "https://www.transparencyusa.org/nv/candidate/zachary-conine", { "Zach Conine": "zachary-conine" }), false);
  const fec = { candidate_id: "H0NV00000", name: "TEST, CANDIDATE", office: "H", office_full: "House", state: "NV", district: "1", cycle: 2026, receipts: null, disbursements: 0 };
  assert.equal(fecSnapshot(fec), null, "Missing money must never create zero campaign totals");
  assert.equal(fecSnapshot({ ...fec, receipts: 0 })?.totalRaised, 0, "Explicit reported zero remains valid");
  const html = '<title>Test Candidate - Nevada Candidate - Transparency USA</title><span class="user-display-stat-counter">$1,234</span><span class="user-display-stat-title">Contributions</span><span class="user-display-stat-counter">$500</span><span class="user-display-stat-title">Expenditures</span>';
  const snapshot = parseTransparencyPage(html, "https://www.transparencyusa.org/nv/candidate/test", 2026, "2026-09-06T00:00:00Z");
  assert.equal(snapshot?.totalRaised, 1234);
  assert.equal(snapshot?.coverageEnd, null, "Retrieval date cannot become a reporting cutoff");
  assert.equal(parseTransparencyPage(html.replace("$1,234", ""), "https://www.transparencyusa.org/nv/candidate/test", 2026, "2026-09-06T00:00:00Z"), null);
  await assert.rejects(fetchFinancialBuffer(`${baseUrl}/slow`, { timeoutMs: 80 }), /abort|timed out/i);
  await assert.rejects(fetchFinancialBuffer(`${baseUrl}/large`, { maxBytes: 10 }), /byte limit/);

  const file = path.join(folder, "cache.json");
  const attempts: FinancialSourceAttempt[] = [];
  const validate = (body: Buffer) => { if (!Array.isArray(JSON.parse(body.toString()).results)) throw new Error("Invalid response"); };
  const first = await fetchFinancialCache(`${baseUrl}/good?api_key=never-log-this`, file, true, { attempts, validate });
  assert.equal(first?.status, "fetched");
  assert.ok(!JSON.stringify(attempts).includes("never-log-this"));
  const failingFetch = async () => new Response("<html>Access denied</html>");
  const cached = await fetchFinancialCache(`${baseUrl}/good?api_key=never-log-this`, file, true, { attempts, validate, fetchImpl: failingFetch });
  assert.equal(cached?.status, "cached_after_error");
  assert.equal(cached?.fetchedAt, first?.fetchedAt);
  assert.equal(await readFile(file, "utf8"), '{"results":[]}');
  assert.equal(cached?.timestampBasis, "retrieval_metadata");
  const missing = await fetchFinancialCache(`${baseUrl}/missing`, path.join(folder, "absent"), false, { attempts, validate });
  assert.equal(missing, null);
  assert.equal(attempts.at(-1)?.status, "unavailable");
  const legacy = path.join(folder, "legacy.json");
  await writeFile(legacy, '{"results":[]}');
  await utimes(legacy, new Date("2025-01-01T00:00:00Z"), new Date("2025-01-01T00:00:00Z"));
  const legacyResult = await fetchFinancialCache(`${baseUrl}/legacy`, legacy, false, { validate });
  assert.equal(legacyResult?.fetchedAt, (await stat(legacy)).mtime.toISOString());
  assert.equal(legacyResult?.timestampBasis, "legacy_file_mtime");
  console.log("Finance source tests passed: unknown amounts, actual reporting periods, full-body timeouts, size cap, invalid response rejection, last-good retention, cache timestamps, and secret-safe logs.");
} finally {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await rm(folder, { recursive: true, force: true });
}

}
main().catch(error => { console.error(error); process.exitCode = 1; });
