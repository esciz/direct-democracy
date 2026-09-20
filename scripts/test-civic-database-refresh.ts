import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createPlaceholderAdapter } from "../lib/civic-data/adapters/base";
import { nevadaSecretaryOfStateAdapter } from "../lib/civic-data/adapters/nevada-secretary-of-state";
import { NEVADA_BETA_SOURCE_DEFINITIONS } from "../lib/civic-data/source-definitions";
async function main() {
  const plan = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "scripts/refresh-civic-database.ts", "--dry-run", "--all-source-shards"], { encoding: "utf8" }));
  assert.equal(plan.sources.length, NEVADA_BETA_SOURCE_DEFINITIONS.length);
  assert.equal(plan.allSources, true);
  assert.ok(plan.budgetMs < 900_000);
  assert.ok(plan.perSourceMs < plan.budgetMs);
  const source = NEVADA_BETA_SOURCE_DEFINITIONS.find(source => source.slug === "nevada-secretary-of-state-election-results")!;
  const context = { source, mode: "scheduled" as const, cursor: null, requestedAt: new Date() };
  for (const adapter of [createPlaceholderAdapter({ key: "county-election-office", displayName: "Unimplemented source" }), nevadaSecretaryOfStateAdapter]) {
    const result = await adapter.sync(context);
    assert.equal(result.status, "ERROR", "Unimplemented parsers must not update successful-refresh timestamps");
    assert.equal(result.recordsSeen, 0);
  }
  console.log("Bounded database refresh and honest placeholder status tests passed");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
