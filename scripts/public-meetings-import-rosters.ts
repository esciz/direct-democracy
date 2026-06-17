import { importAndReportPublicMeetingOfficialRosters } from "@/lib/public-meetings/official-rosters";

async function main() {
  const result = await importAndReportPublicMeetingOfficialRosters();
  console.log("Public meeting official roster import complete");
  console.log(`Seeded rosters: ${result.seededRosterCount}`);
  console.log(`Seeded members: ${result.seededMemberCount}`);
  console.log(`Imported/upserted members: ${result.importedMemberCount}`);
  const bodiesNeedingRosters = result.report.body_reports.filter((body) => body.roll_call_review_items > 0 && !body.has_roster);
  const bodiesMissingSurnames = result.report.body_reports.filter((body) => body.missing_surnames.length > 0);
  console.log(`Bodies with roll-call review items but no roster: ${bodiesNeedingRosters.length}`);
  console.log(`Bodies with unmatched surname-only actors: ${bodiesMissingSurnames.length}`);
  for (const body of bodiesMissingSurnames.slice(0, 20)) {
    console.log(`- ${body.body_name} (${body.jurisdiction}): missing ${body.missing_surnames.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
