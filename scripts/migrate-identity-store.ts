import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { migrateLocalIdentityToPrisma } from "@/lib/identity/migration";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const dryRun = process.argv.includes("--dry-run");
const apply = process.argv.includes("--apply") || (!dryRun && process.argv.length <= 2);

async function main() {
  const result = await migrateLocalIdentityToPrisma({ dryRun, apply });
  mkdirSync(GENERATED_DIR, { recursive: true });
  const reportName = apply && !dryRun ? "identity-migration-apply-audit.json" : "identity-migration-audit.json";
  writeFileSync(path.join(GENERATED_DIR, reportName), `${JSON.stringify({ generatedAt: new Date().toISOString(), ...result }, null, 2)}\n`);

  if (!result.ok && apply) {
    console.error("Identity migration failed.");
    console.error(JSON.stringify({ status: result.status, warnings: result.warnings, conflicts: result.conflicts }, null, 2));
    process.exit(1);
  }

  console.log(`Identity migration ${dryRun ? "dry run" : apply ? "apply" : "plan"} complete.`);
  console.log(JSON.stringify({ ok: result.ok, status: result.status, wrote: result.wrote, sourceCounts: result.sourceCounts, targetCounts: result.targetCounts }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
