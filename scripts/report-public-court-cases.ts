import fs from "node:fs/promises";

const REPORT_PATH = "data/generated/public-court-cases-report.json";
const RUNTIME_PATH = "data/generated/public-court-cases-runtime.json";

async function readJson(path: string) {
  try {
    return JSON.parse(await fs.readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const [report, runtime] = await Promise.all([readJson(REPORT_PATH), readJson(RUNTIME_PATH)]);
  console.log(
    JSON.stringify(
      {
        report: "public-court-records",
        runtimePath: RUNTIME_PATH,
        reportPath: REPORT_PATH,
        runtimeRecords: runtime?.counts?.runtimeRecords ?? 0,
        manifestRecords: report?.counts?.manifestRecords ?? 0,
        reviewedPublic: report?.counts?.reviewedPublic ?? 0,
        excluded: report?.counts?.excluded ?? 0,
        needsReview: report?.counts?.needsReview ?? 0,
        dbUpserted: report?.counts?.dbUpserted ?? 0,
        dbSkipped: report?.counts?.dbSkipped ?? 0,
        exclusions: report?.exclusions ?? [],
        dbFailures: report?.dbFailures ?? [],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
