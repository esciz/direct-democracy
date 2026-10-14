import fs from "node:fs/promises";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data/generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "admin-verification-workflow-audit.json");

async function main() {
  const operationsPage = await fs.readFile(path.join(process.cwd(), "app/admin/operations/page.tsx"), "utf8");
  const identityPage = await fs.readFile(path.join(process.cwd(), "app/admin/identity/page.tsx"), "utf8");
  const identityActions = await fs.readFile(path.join(process.cwd(), "app/admin/identity/actions.ts"), "utf8");
  const audit = {
    generatedAt: new Date().toISOString(),
    status: "admin_verification_workflow_audited",
    sensitiveValuesIncluded: false,
    validation: {
      operationsDashboardShowsIdentityWorkflow: operationsPage.includes("Identity verification workflow") && operationsPage.includes("Residency and voter registration review"),
      operationsDashboardLinksToVoterReview: operationsPage.includes('/admin/identity#voter-review'),
      operationsDashboardShowsPendingCounts: operationsPage.includes("pendingResidencyClaims.length") && operationsPage.includes("pendingVoterClaims.length"),
      identityPageHasResidencyAnchor: identityPage.includes('id="residency-review"'),
      identityPageHasVoterAnchor: identityPage.includes('id="voter-review"'),
      voterReviewUsesAssistantPackets: identityPage.includes("verificationAssistant") && identityPage.includes("Recommended action"),
      voterReviewShowsReviewerChecklist: identityPage.includes("Reviewer checklist") && identityPage.includes("Open SOS voter lookup"),
      voterReviewExplainsManualComparison:
        identityPage.includes("Confirm County Voter ID ending") &&
        identityPage.includes("Approve only if status is active") &&
        identityPage.includes("Approved, rejected, and needs-info decisions remain visible"),
      voterReviewSupportsStatusFilters:
        identityPage.includes("VOTER_STATUS_FILTERS") &&
        identityPage.includes("voterStatus") &&
        identityPage.includes("Recently reviewed voter claims"),
      voterReviewSupportsRequestMoreInfo:
        identityPage.includes('value="request_more_info"') &&
        identityPage.includes("Request more info") &&
        identityActions.includes('decision !== "request_more_info"'),
      voterReviewNotificationHookPresent:
        identityActions.includes("sendIdentityEmail") &&
        identityActions.includes("verification_review_status") &&
        identityActions.includes("Direct Democracy voter verification"),
    },
  };
  const pass = Object.values(audit.validation).every(Boolean);
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify({ ...audit, pass }, null, 2)}\n`);
  console.log("Admin verification workflow audit complete.");
  console.log(JSON.stringify({ pass, output: OUTPUT_PATH }, null, 2));
  if (!pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
