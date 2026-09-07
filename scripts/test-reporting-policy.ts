import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { routineReportingExclusion, nonPersonExtractionReason } from "@/lib/public-meetings/reporting-policy";
import { firstPassVote, firstPassIdentity, identityReviewBuckets } from "@/lib/admin/operations/first-pass";
import { applyReportingPolicy } from "./apply-reporting-policy";

for (const title of ["Approval of minutes from May 19, 2026", "Consideration and possible approval of the agenda for June 16, 2026", "Adjournment"]) assert.ok(routineReportingExclusion({ title }), title);
for (const title of ["Approve the consent agenda", "Approve minutes and a $25,000 contract", "Approve the budget described in the minutes", "Adopt an ordinance", "Appointment of a board chair", "Consider the zoning application"]) assert.equal(routineReportingExclusion({ title }), null, title);
assert.equal(routineReportingExclusion({ title: "Approval of minutes", source_text: "Approve the minutes and authorize a new lease." }), null);
assert.equal(nonPersonExtractionReason("Donald Sylvantee McMichael Sr."), null);
assert.equal(nonPersonExtractionReason("For-Hope Hesch"), null);
assert.equal(nonPersonExtractionReason("Jennifer Schuler A"), null); // Uncertain spelling remains open.
assert.ok(nonPersonExtractionReason("Plaskett motioned to approve the"));
assert.equal(firstPassIdentity("Marty Plaskett").status, "needs_roster");
assert.equal(firstPassVote({ title: "Approve a budget", source_url: "https://example.org/minutes" }, "distribution_review").status, "needs_source");
const identities = identityReviewBuckets(["Jane Smith", "JANE SMITH"].map(personName => ({ personName, organizationId: "body", attendanceStatus: "present", matchConfidence: "unmatched_name", votingEligibility: "eligible_voting_member", sourceSnippet: "Present: Jane Smith" })));
assert.equal(identities.length, 1, "historical normalized review IDs display once");
assert.equal(identities[0].count, 2, "merged spellings retain their source occurrence count");
assert.equal(identities[0].variantNames.length, 2);

const root = mkdtempSync(path.join(os.tmpdir(), "civic-report-policy-"));
try {
  const dir = path.join(root, "data/generated"); mkdirSync(dir, { recursive: true });
  const write = (name: string, value: unknown) => writeFileSync(path.join(dir, name), JSON.stringify(value));
  const read = (name: string) => JSON.parse(readFileSync(path.join(dir, name), "utf8"));
  const items = [{ id: "minutes", title: "Approval of minutes" }, { id: "budget", title: "Approve the budget" }];
  write("public-meeting-items-runtime.json", items);
  write("public-meeting-votes.json", items.map(item => ({ meeting_item_id: item.id, review_status: "parsed_named_vote", evidenceType: "explicit_roll_call_group", vote: "yes" })));
  write("public-meeting-vote-extraction-audit.json", { totals: {}, distributionReviewActions: items.map(item => ({ ...item, meeting_item_id: item.id })) });
  write("voting-cards.json", { totals: { generatedCards: 2 }, records: items.map(item => ({ ...item, agendaItemId: item.id })) });
  assert.equal(applyReportingPolicy(root).excludedItems, 1);
  assert.deepEqual(read("public-meeting-items-runtime.json"), items, "source evidence retained");
  assert.equal(read("public-meeting-votes.json").length, 1);
  assert.equal(read("voting-cards.json").totals.generatedCards, 1);
  assert.equal(read("public-meeting-vote-extraction-audit.json").totals.parsedNamedVotes, 1);
  assert.equal(read("public-meeting-vote-extraction-audit.json").totals.remainingUnresolvedVoteActions, 1);
  assert.equal(applyReportingPolicy(root).removed["public-meeting-votes.json"], 0, "repeat application is idempotent");
  // Restoring an older release cannot reintroduce routine vote rows.
  write("public-meeting-votes.json", items.map(item => ({ meeting_item_id: item.id })));
  applyReportingPolicy(root);
  assert.equal(read("public-meeting-votes.json").length, 1);
  // A corrected mixed substantive item is not permanently blacklisted by ID.
  write("public-meeting-items-runtime.json", [{ id: "minutes", title: "Approval of minutes and a contract" }]);
  assert.equal(applyReportingPolicy(root).excludedItems, 0);
} finally { rmSync(root, { recursive: true }); }
console.log("Reporting policy: procedural exclusion, substantive protection, evidence preservation, repeat refresh and triage checks passed.");
