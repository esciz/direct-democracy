import fs from "node:fs/promises";

const REPORT_PATH = "data/generated/issue-review-requests-report.json";

async function main() {
  const report = JSON.parse(await fs.readFile(REPORT_PATH, "utf8"));
  console.log(JSON.stringify({ report: "issue-review-requests", ...report.counts, exclusions: report.exclusions ?? [] }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
