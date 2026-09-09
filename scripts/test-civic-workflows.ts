import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
assert.match(publication, /actions\/download-artifact/);
assert.ok(publication.indexOf("import-candidate") < publication.indexOf("dataops:release:publish"));
assert.doesNotMatch(publication, /dataops:pipeline|dataops:release:prepare|apply-reporting-policy/);
assert.match(collection, /name: civic-release-candidate-\$\{\{ github.run_id \}\}/);
assert.match(publication, /name: civic-release-candidate-\$\{\{ github.run_id \}\}/);
assert.match(civic, /needs.refresh.outputs.collection_outcome == 'failure'/);
assert.match(civic, /cancel-in-progress: false/);
assert.match(application, /\n  push:/);
assert.match(application, /\n  pull_request:/);
assert.doesNotMatch(application, /\n  schedule:|secrets\.|dataops:checkpoint:restore|--trigger-deploy/);
for (const command of ["npm run typecheck", "npm run build", "npm run meetings:bundle:audit", "test-civic-workflows.ts"]) assert.ok(application.includes(command), command);
console.log("Civic workflows: frozen data handoff, separate application build, publication retry boundary and explicit source failure status passed.");
