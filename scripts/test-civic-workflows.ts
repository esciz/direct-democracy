import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const civic = readFileSync(".github/workflows/civic-data-production.yml", "utf8");
const application = readFileSync(".github/workflows/application-build.yml", "utf8");
const collection = civic.split("\n  publish:")[0];
const publication = civic.split("\n  publish:")[1].split("\n  source-coverage:")[0];

// A prebuild after prepare caused real publication failures. Check the orchestration
// boundary alongside the executable snapshot-mutation/handoff regression.
for (const workflow of [collection, publication]) {
  assert.doesNotMatch(workflow, /npm run (?:prebuild|build|typecheck)|next build/);
}
const ordered = ["dataops:pipeline", "dataops:runtime:compact", "apply-reporting-policy.ts", "site:launch-audit", "dataops:release:prepare", "export-candidate", "actions/upload-artifact"];
let previous = -1;
for (const command of ordered) {
  const index = collection.indexOf(command, previous + 1);
  assert.ok(index > previous, `Missing or out-of-order collection operation: ${command}`);
  previous = index;
}
assert.match(publication, /needs: refresh/);
assert.match(publication, /github.event_name == 'push' \|\| inputs.publish/, "Code-triggered data refreshes must also publish their validated candidate");
assert.match(publication, /actions\/download-artifact/);
assert.ok(publication.indexOf("import-candidate") < publication.indexOf("dataops:release:publish"));
assert.doesNotMatch(publication, /dataops:pipeline|dataops:release:prepare|apply-reporting-policy/);
assert.match(collection, /name: civic-release-candidate-\$\{\{ github.run_id \}\}/);
assert.match(publication, /name: civic-release-candidate-\$\{\{ github.run_id \}\}/);
assert.match(civic, /needs.refresh.outputs.collection_outcome == 'failure'/);
assert.match(civic, /github\.event\.schedule == '17 6 \* \* \*'/);
assert.match(civic, /SCHEDULE" != "17 6 \* \* \*"/);
assert.match(civic, /cancel-in-progress: false/);
assert.match(civic, /push:\s+branches: \[main\]\s+paths:/);
assert.ok(civic.includes("'lib/public-meetings/**'"), "Parser fixes must schedule regenerated civic data");
for (const source of ["lib/financials/**", "scripts/collect-nevada-financials.ts", "scripts/compact-civic-runtime.ts"]) {
  assert.ok(civic.includes(`'${source}'`), "Finance and packaging fixes must regenerate the public release");
}
assert.match(civic, /GITHUB_EVENT_NAME" == "schedule" && "\$SCHEDULE" !=/, "Code-triggered refresh includes a new finance integrity audit");
assert.match(civic, /all_source_shards:/);
assert.match(civic, /database_source:/);
assert.match(civic, /inputs.database_source == ''/);
const targetedDatabase = civic.split("\n  database-source:")[1].split("\n  publish:")[0];
assert.match(targetedDatabase, /inputs.database_source != ''/);
assert.match(targetedDatabase, /--only="\$DATABASE_SOURCE"/);
assert.match(targetedDatabase, /timeout-minutes: 5/);
assert.doesNotMatch(targetedDatabase, /dataops:pipeline|dataops:release:publish|dataops:checkpoint/);
assert.match(civic, /ALL_SOURCE_SHARDS" == "true".*--all-source-shards/);
type Plan = { allSourceShards: boolean; stages: Array<{ id: string; commands: string[][] }> };
const plan = (...args: string[]): Plan => JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "scripts/run-dataops-pipeline.ts", "--dry-run", ...args], { encoding: "utf8" }));
const routine = plan();
const catchup = plan("--all-source-shards");
const command = (value: Plan, name: string) => value.stages.flatMap(stage => stage.commands).find(row => row.includes(`scripts/${name}.ts`))!;
assert.equal(routine.allSourceShards, false);
assert.equal(catchup.allSourceShards, true);
assert.ok(command(routine, "collect-nevada-financials").includes("--scheduled"));
assert.ok(command(catchup, "collect-nevada-financials").includes("--full"));
assert.ok(command(catchup, "collect-nevada-organizations").includes("--first-pass"));
assert.ok(command(catchup, "refresh-civic-database").includes("--all-source-shards"));
assert.ok(!command(catchup, "download-nevada-fec-political-ads").includes("--scheduled"));
assert.ok(command(catchup, "download-nevada-fec-political-ads").includes("--limit=1600"), "Catch-up keeps acquisition bounds");
assert.ok(command(catchup, "bootstrap-public-meeting-sources").includes("--scheduled"), "Catch-up retains resumable browser time budget");
assert.ok(command(catchup, "bootstrap-public-meeting-sources").includes("--all-source-shards"));
assert.ok(!catchup.stages.flatMap(stage => stage.commands).flat().includes("--force"), "Catch-up must not remove pipeline locks or bypass evidence caching");
assert.ok(!plan("--meetings-only", "--all-source-shards").stages.some(stage => ["refresh-public-data", "public-records", "refresh-civic-database"].includes(stage.id)), "Scope remains explicit");
const bootstrap = readFileSync("scripts/bootstrap-public-meeting-sources.ts", "utf8");
assert.match(bootstrap, /if \(SCHEDULED && !ALL_SOURCE_SHARDS\)/);
assert.match(application, /\n  push:/);
assert.match(application, /\n  pull_request:/);
assert.doesNotMatch(application, /\n  schedule:|secrets\.|dataops:checkpoint:restore|--trigger-deploy/);
for (const command of ["npm run typecheck", "npm run build", "npm run meetings:bundle:audit", "test-civic-workflows.ts"]) assert.ok(application.includes(command), command);
console.log("Civic workflows: frozen data handoff, separate application build, publication retry boundary and explicit source failure status passed.");
