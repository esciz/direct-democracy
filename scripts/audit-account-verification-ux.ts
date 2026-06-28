import fs from "node:fs/promises";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data/generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "account-verification-ux-audit.json");

async function main() {
  const page = await fs.readFile(path.join(process.cwd(), "app/account/verification/page.tsx"), "utf8");
  const actions = await fs.readFile(path.join(process.cwd(), "app/account/verification/actions.ts"), "utf8");
  const statusCard = await fs.readFile(path.join(process.cwd(), "components/domain/account-participation-status-card.tsx"), "utf8");
  const audit = {
    generatedAt: new Date().toISOString(),
    status: "account_verification_ux_audited",
    sensitiveValuesIncluded: false,
    validation: {
      residencySuccessMessageVisible: page.includes('params?.status === "residency-submitted"') && page.includes("residency review request was submitted successfully"),
      voterSuccessMessageVisible: page.includes('params?.status === "voter-submitted"') && page.includes("voter portal verification was submitted successfully"),
      residencyRedirectTargetsClaimHistory: actions.includes('redirect("/account/verification?status=residency-submitted#claim-history")'),
      voterRedirectTargetsClaimHistory: actions.includes('redirect("/account/verification?status=voter-submitted#claim-history")'),
      missingRedirectsTargetRelevantForms: actions.includes('status=residency-missing#residency-review') && actions.includes('status=voter-missing#voter-review'),
      residencyCtaTargetsFormAnchor: statusCard.includes('/account/verification#residency-review'),
      formAnchorsPresent: page.includes('id="residency-review"') && page.includes('id="voter-review"') && page.includes('id="claim-history"'),
      voterPortalSummaryUsesDropdown:
        page.includes('<select') &&
        page.includes('name="portalResultSummary"') &&
        page.includes("Select the status you saw") &&
        page.includes("Status shown, needs reviewer confirmation"),
      claimHistoryExplainsReviewOutcomes:
        page.includes("claimStatusCopy") &&
        page.includes("A reviewer needs more information") &&
        page.includes("Verified voter status is active"),
      claimHistoryShowsVoterReviewContext:
        page.includes("Voter ID ending") &&
        page.includes("claim.reviewContext.countyOrJurisdiction") &&
        page.includes("claim.reviewContext.electionPrecinct"),
      emailVerificationControlPresent:
        page.includes('id="email-verification"') &&
        page.includes("requestCurrentEmailVerificationAction") &&
        page.includes("Send verification link"),
      explicitSubmitButtonsPresent: page.includes('<button type="submit"') && page.match(/<button type="submit"/g)?.length === 3,
    },
  };
  const pass = Object.values(audit.validation).every(Boolean);
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify({ ...audit, pass }, null, 2)}\n`);
  console.log("Account verification UX audit complete.");
  console.log(JSON.stringify({ pass, output: OUTPUT_PATH }, null, 2));
  if (!pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
