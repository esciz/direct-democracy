import { importManualPublicMeetingSources } from "@/lib/public-meetings/manual-sources";

async function main() {
  const includeFixtures = process.argv.includes("--include-fixtures");
  const result = await importManualPublicMeetingSources({ includeFixtures });
  console.log("Manual public meeting import complete");
  console.log(`Manual meetings imported: ${result.meetings.length}`);
  console.log(`Manual topic records imported: ${result.items.length}`);
  console.log(`Official actions extracted: ${result.officialActions.length}`);
  console.log(`Draft citizen questions imported: ${result.questions.length}`);
  console.log(`Provider reports: ${result.report.length}`);
  for (const report of result.report) {
    console.log(`- ${report.provider_id}: ${report.status} cached=${report.cached_files} meetings=${report.parsed_meetings} items=${report.parsed_items}`);
  }
  if (result.errors.length) {
    console.log(`Errors: ${result.errors.length}`);
    for (const error of result.errors.slice(0, 8)) {
      console.log(`- ${error.document_id ?? "unknown"}: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
