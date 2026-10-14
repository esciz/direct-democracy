import "../lib/env/load-local-env";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NEVADA_BETA_SOURCE_DEFINITIONS } from "../lib/civic-data/source-definitions";
import { syncCivicSource } from "../lib/civic-data/service";
import { prisma } from "../lib/prisma";

const sourceSlug = process.argv.find(arg => arg.startsWith("--source="))?.slice(9);
const onlySourceSlug = process.argv.find(arg => arg.startsWith("--only="))?.slice(7);
const allSources = process.argv.includes("--all-source-shards");
const reportPath = path.join(process.cwd(), "data/generated/civic-database-refresh.json");
const budgetMs = 12 * 60_000;
const perSourceMs = 120_000;

async function main() {
  if (onlySourceSlug !== undefined && !NEVADA_BETA_SOURCE_DEFINITIONS.some(source => source.slug === onlySourceSlug)) throw new Error("unknown_civic_source");
  const definitions = NEVADA_BETA_SOURCE_DEFINITIONS.filter(source => !onlySourceSlug || source.slug === onlySourceSlug);
  if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify({ sources: definitions.map(source => source.slug), allSources, onlySourceSlug, budgetMs, perSourceMs }));
    return;
  }
  if (sourceSlug) {
    if (!NEVADA_BETA_SOURCE_DEFINITIONS.some(source => source.slug === sourceSlug)) throw new Error("unknown_civic_source");
    const result = await syncCivicSource(sourceSlug, "scheduled");
    console.log(JSON.stringify({ source: sourceSlug, status: result.status, recordsSeen: result.recordsSeen }));
    if (result.status !== "SUCCESS") process.exitCode = 1;
    return;
  }
  const startedAt = new Date();
  const previous = await prisma.source.findMany({ select: { slug: true, lastCheckedAt: true } });
  const lastChecked = new Map(previous.map(source => [source.slug, source.lastCheckedAt?.getTime() ?? 0]));
  const due = definitions.filter(source => {
    const cadence = source.refreshFrequency?.includes("monthly") ? 30 : source.refreshFrequency?.includes("weekly") ? 7 : 1;
    return allSources || startedAt.getTime() - (lastChecked.get(source.slug) ?? 0) >= cadence * 86_400_000;
  }).sort((a, b) => (lastChecked.get(a.slug) ?? 0) - (lastChecked.get(b.slug) ?? 0) || (a.importPriority ?? 100) - (b.importPriority ?? 100));
  const rows: Array<{ source: string; status: string; checkedAt: string }> = [];
  const save = () => {
    mkdirSync(path.dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify({ startedAt: startedAt.toISOString(), updatedAt: new Date().toISOString(), allSources, onlySourceSlug, registered: NEVADA_BETA_SOURCE_DEFINITIONS.length, due: due.length, results: rows, deferred: due.slice(rows.length).map(source => source.slug) }, null, 2));
  };
  save();
  for (const source of due) {
    const remaining = budgetMs - (Date.now() - startedAt.getTime());
    if (remaining < 15_000) break;
    const attemptStart = new Date();
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/refresh-civic-database.ts", `--source=${source.slug}`], {
      cwd: process.cwd(), env: process.env, stdio: "inherit", timeout: Math.min(perSourceMs, remaining), killSignal: "SIGKILL",
    });
    const status = result.error ? "timeout_or_worker_error" : result.status === 0 ? "success" : "incomplete";
    if (result.error) {
      // Only close attempts started by this bounded child, never historical runs.
      const record = await prisma.source.findUnique({ where: { slug: source.slug }, select: { id: true } });
      if (record) await prisma.$transaction([
        prisma.source.update({ where: { id: record.id }, data: { syncStatus: "ERROR", lastCheckedAt: new Date(), errorLog: "Bounded civic refresh worker did not finish; retained prior records for retry." } }),
        prisma.sourceSyncRun.updateMany({ where: { sourceId: record.id, status: "SYNCING", startedAt: { gte: attemptStart } }, data: { status: "ERROR", completedAt: new Date(), errorLog: "Bounded civic refresh worker did not finish." } }),
      ]);
    }
    rows.push({ source: source.slug, status, checkedAt: new Date().toISOString() });
    save();
  }
  console.log(JSON.stringify({ databaseSourcesAttempted: rows.length, incomplete: rows.filter(row => row.status !== "success").length, deferred: due.length - rows.length }));
  if (rows.length < due.length || rows.some(row => row.status !== "success")) process.exitCode = 1;
}
main().catch(error => { console.error(`Civic database refresh failed: ${error instanceof Error ? error.name : "unknown_error"}`); process.exitCode = 1; }).finally(async () => { if (!process.argv.includes("--dry-run")) await prisma.$disconnect(); });
