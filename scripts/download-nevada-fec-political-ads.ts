import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fetchFecBulk, fetchFecPage, isPaidCommunication, mergeFecRecords, nextCursor, type FecCommunicationRecord, type FecCursor } from "../lib/political-ads/fec-collection";

const IMPORT_DIR = path.join(process.cwd(), "data/imports/political-ads");
const OUTPUT_PATH = path.join(IMPORT_DIR, "fec-nevada-independent-expenditures.json");
const STATE_PATH = path.join(IMPORT_DIR, "fec-collection-state.json");
type CycleState = { nextCursor: FecCursor | null; lastAttemptAt: string; lastSuccessAt?: string; status: string; reportedCount?: number; pages?: number; error?: string };
function getArg(name: string, fallback: string) { return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback; }
function readJson<T>(file: string, fallback: T): T { if (!fs.existsSync(file)) return fallback; return JSON.parse(fs.readFileSync(file, "utf8")) as T; }
function atomicJson(file: string, value: unknown) { const temporary = `${file}.${process.pid}.tmp`; fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`); fs.renameSync(temporary, file); }
function requestedCycles() {
  const explicit = getArg("cycles", "").split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 2010 && n <= 2030 && n % 2 === 0);
  if (explicit.length) return [...new Set(explicit)].sort((a, b) => b - a);
  const current = Math.ceil(new Date().getUTCFullYear() / 2) * 2;
  const cycles = Array.from({ length: (current - 2012) / 2 + 1 }, (_, i) => current - i * 2);
  return process.argv.includes("--scheduled") ? [current, cycles[1 + Math.floor(Date.now() / 86_400_000) % (cycles.length - 1)]] : cycles;
}
function publicError(error: unknown) { return (error instanceof Error ? error.message : String(error)).replace(/api_key=[^&\s]+/gi, "api_key=[redacted]"); }

async function main() {
  const requested = Number.parseInt(getArg("limit", "1600"), 10);
  const limit = Number.isFinite(requested) ? Math.min(10_000, Math.max(100, requested)) : 1600;
  const cycles = requestedCycles();
  const minDate = getArg("min-date", "2012-01-01");
  const bulkOnly = process.argv.includes("--bulk-only");
  const apiKey = process.env.FEC_API_KEY || "DEMO_KEY";
  const previous = readJson<{ records?: FecCommunicationRecord[] }>(OUTPUT_PATH, {});
  const state = readJson<{ cycles: Record<string, CycleState> }>(STATE_PATH, { cycles: {} });
  const collected: FecCommunicationRecord[] = [];
  const successfulCycles: number[] = [], bulkFallbackCycles: number[] = [];
  const failedCycles: Array<{ cycle: number; reason: string }> = [];
  const cycleResults: Array<{ cycle: number; status: string; pages: number; downloaded: number; reportedCount: number | null }> = [];
  const now = new Date().toISOString();
  const pagesPerCycle = Math.max(1, Math.ceil(limit / Math.max(1, cycles.length) / 100));
  for (const cycle of cycles) {
    if (`${cycle}-12-31` < minDate) continue;
    const old = state.cycles[String(cycle)];
    let cursor = old?.nextCursor ?? null;
    let count: number | null = null;
    let pages = 0;
    let status = "partial";
    const rows: FecCommunicationRecord[] = [];
    let apiFailure: string | null = null;
    if (!bulkOnly) {
      try {
        const endpoint = new URL("https://api.open.fec.gov/v1/schedules/schedule_e/");
        Object.entries({ api_key: apiKey, candidate_office_state: "NV", min_date: `${cycle - 1}-01-01` > minDate ? `${cycle - 1}-01-01` : minDate, max_date: `${cycle}-12-31`, sort: "-expenditure_date", per_page: "100", most_recent: "true" }).forEach(([key, value]) => endpoint.searchParams.set(key, value));
        // Always refresh the newest page. Resume a saved backfill cursor with the remaining budget.
        let activeCursor: FecCursor | null = null;
        const seen = new Set<string>();
        for (let index = 0; index < pagesPerCycle; index++) {
          const pageUrl = new URL(endpoint);
          Object.entries(activeCursor ?? {}).forEach(([key, value]) => pageUrl.searchParams.set(key, String(value)));
          const payload = await fetchFecPage(pageUrl);
          pages++; count = payload.pagination?.count ?? count;
          rows.push(...(payload.results ?? []).map((row) => ({ ...row, source_dataset: "api_schedule_e" as const })));
          const next = nextCursor(payload);
          if (!(payload.results?.length) || payload.results.length < 100 || !next) { cursor = null; status = "complete_window"; break; }
          const signature = JSON.stringify(next);
          if (seen.has(signature)) throw new Error("FEC repeated a pagination cursor; stopped to retain progress.");
          seen.add(signature);
          activeCursor = index === 0 && cursor ? cursor : next;
          cursor = activeCursor;
        }
        successfulCycles.push(cycle);
      } catch (error) { apiFailure = publicError(error); }
    }
    if (bulkOnly || apiFailure) {
      try {
        const bulk = await fetchFecBulk(cycle);
        rows.push(...bulk); bulkFallbackCycles.push(cycle); successfulCycles.push(cycle);
        status = "notices_only"; // Bulk is not a replacement for all Schedule E filings.
      } catch (error) {
        status = rows.length ? "partial_failure" : "failed";
        failedCycles.push({ cycle, reason: [apiFailure, `bulk: ${publicError(error)}`].filter(Boolean).join("; ") });
      }
    }
    const eligible = rows.filter((row) => row.candidate_office_state === "NV" && isPaidCommunication(row)).map((row) => ({ ...row, source_url: row.source_url ?? row.pdf_url ?? (row.image_number ? `https://docquery.fec.gov/cgi-bin/fecimg/?${row.image_number}` : `https://www.fec.gov/data/independent-expenditures/?candidate_id=${encodeURIComponent(row.candidate_id ?? "")}`) }));
    collected.push(...eligible);
    state.cycles[String(cycle)] = { ...old, nextCursor: cursor, lastAttemptAt: now, ...(status !== "failed" && status !== "partial_failure" ? { lastSuccessAt: now } : {}), status, pages, ...(count !== null ? { reportedCount: count } : {}), ...(apiFailure ? { error: apiFailure } : { error: undefined }) };
    cycleResults.push({ cycle, status, pages, downloaded: eligible.length, reportedCount: count });
  }
  const existing = previous.records ?? [];
  const records = mergeFecRecords(existing, collected);
  const output = {
    generatedAt: now,
    source: { provider: "fec", endpoint: "https://api.open.fec.gov/v1/schedules/schedule_e/", candidateOfficeState: "NV", minDate, cycles, successfulCycles: [...new Set(successfulCycles)], bulkFallbackCycles, failedCycles, sourceUrl: "https://api.open.fec.gov/developers/", usedDemoKey: !process.env.FEC_API_KEY, bulkOnly,
      coverageBoundary: "Bounded Schedule E collection with retained history and cursor backfill. Bulk fallback contains 24/48-hour notices only. Filings can overlap or amend prior notices; listed amounts must not be summed as reconciled spending or treated as reviewed creative.", cycleResults },
    totals: { requested: limit, downloadedRaw: collected.length, downloadedThisRun: collected.length, retainedExisting: existing.length, downloaded: records.length, addedRecords: records.length - existing.length, successfulCycles: new Set(successfulCycles).size, bulkFallbackCycles: bulkFallbackCycles.length, failedCycles: failedCycles.length },
    records,
  };
  fs.mkdirSync(IMPORT_DIR, { recursive: true });
  atomicJson(OUTPUT_PATH, output); atomicJson(STATE_PATH, state);
  console.log(JSON.stringify({ ...output.totals, cycleResults, failedCycles, output: OUTPUT_PATH }, null, 2));
  if (failedCycles.length) process.exitCode = 1;
}
main().catch((error) => { console.error(publicError(error)); process.exitCode = 1; });
