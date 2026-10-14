import { buildManualMeetingSourceReport } from "@/lib/public-meetings/manual-sources";
import { buildPublicMeetingRosterCoverageReport } from "@/lib/public-meetings/official-rosters";

async function main() {
  const [report, rosterReport] = await Promise.all([
    buildManualMeetingSourceReport(),
    buildPublicMeetingRosterCoverageReport(),
  ]);
  console.log("Public meeting provider coverage");
  console.log("provider | automated | automated meetings | manual | cached files | pages | pdfs | json | manual meetings | manual items | votes/actions | official actions | voting cards approved/needs | surname-only | auto-matched | suggested | approved visible | roll-call parsed | roll-call review | topic outcomes | named votes | low-conf pdf | questions ready/context/financial/vote | needs review | interactive");
  for (const entry of report) {
    console.log(
      `${entry.provider_id} | ${entry.automated_status} | ${entry.automated_meetings} | ${entry.manual_status} | ${entry.manual_cached_files} | ${entry.manual_detail_pages} | ${entry.manual_pdfs} | ${entry.manual_json} | ${entry.manual_parsed_meetings} | ${entry.manual_parsed_items} | ${entry.manual_votes_or_actions} | ${entry.manual_official_actions} | ${entry.manual_meeting_voting_cards_approved}/${entry.manual_meeting_voting_cards_needs_review} | ${entry.manual_surname_only_actors} | ${entry.manual_auto_matched_actors} | ${entry.manual_suggested_match_actors} | ${entry.manual_approved_visible_actions} | ${entry.manual_roll_call_parsed} | ${entry.manual_roll_call_review_items} | ${entry.manual_parsed_topic_outcomes} | ${entry.manual_parsed_named_vote_records} | ${entry.manual_low_confidence_pdf_records} | ${entry.manual_question_ready}/${entry.manual_question_needs_context}/${entry.manual_question_needs_financial_review}/${entry.manual_question_needs_vote_outcome} | ${entry.manual_needs_review} | ${entry.interactive_session_needed ? "yes" : "no"}`,
    );
    if (entry.boarddocs_failures?.length) console.log(`  BoardDocs failures: ${entry.boarddocs_failures.map((failure) => `${failure.url} (${failure.reason})`).join("; ")}`);
    if (entry.parser_gaps?.length) console.log(`  parser gaps: ${entry.parser_gaps.join("; ")}`);
    if (entry.next_recommended_action) console.log(`  next: ${entry.next_recommended_action}`);
    if (entry.notes) console.log(`  notes: ${entry.notes}`);
    if (entry.manual_status === "missing") console.log(`  manifest: ${entry.manual_manifest_path}`);
  }
  const bodiesWithRollCallNoRoster = rosterReport.body_reports.filter((body) => body.roll_call_review_items > 0 && !body.has_roster);
  const bodiesWithMissingSurnames = rosterReport.body_reports.filter((body) => body.missing_surnames.length > 0);
  const bodiesWithRosterNeed = rosterReport.body_reports.filter((body) => body.roll_call_review_items > 0 || body.surname_only_actions.length > 0);
  const coveredBodies = bodiesWithRosterNeed.filter((body) => body.has_roster).length;
  const coveragePercent = bodiesWithRosterNeed.length ? Math.round((coveredBodies / bodiesWithRosterNeed.length) * 100) : 100;
  console.log("");
  console.log("Official roster coverage");
  console.log(`seeded rosters: ${rosterReport.seeded_roster_count}`);
  console.log(`seeded members: ${rosterReport.seeded_member_count}`);
  console.log(`bodies needing roster coverage: ${bodiesWithRosterNeed.length}`);
  console.log(`coverage by body: ${coveredBodies}/${bodiesWithRosterNeed.length} (${coveragePercent}%)`);
  console.log(`bodies with roll-call review items but no roster: ${bodiesWithRollCallNoRoster.length}`);
  console.log(`bodies with surname-only actors missing from rosters: ${bodiesWithMissingSurnames.length}`);
  const topRollCallBodies = rosterReport.body_reports
    .filter((body) => body.roll_call_review_items > 0)
    .sort((left, right) => right.roll_call_review_items - left.roll_call_review_items)
    .slice(0, 12);
  if (topRollCallBodies.length) {
    console.log("top bodies by roll-call review count:");
    for (const body of topRollCallBodies) {
      console.log(`  ${body.roll_call_review_items} | ${body.has_roster ? "roster" : "no roster"} | ${body.body_name} (${body.jurisdiction})`);
    }
  }
  for (const body of bodiesWithRollCallNoRoster.slice(0, 20)) {
    console.log(`  missing roster: ${body.body_name} (${body.jurisdiction}) -> ${body.roll_call_review_items} roll-call review items`);
  }
  for (const body of bodiesWithMissingSurnames.slice(0, 20)) {
    console.log(`  missing surnames: ${body.body_name} (${body.jurisdiction}) -> ${body.missing_surnames.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
