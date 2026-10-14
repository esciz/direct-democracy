import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PLATFORM_ROLES } from "@/lib/trust/platform-roles";
import { ORGANIZATION_CLAIM_TYPES, STAKEHOLDER_CLAIM_TYPES } from "@/lib/trust/claims";
import { DATA_DOMAIN_SEPARATION, SECURITY_CONTROLS } from "@/lib/trust/security";
import { createVerificationFlow, issueVerificationClaim } from "@/lib/trust/verification";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "trust-foundation-audit.json");

const residentRole = PLATFORM_ROLES.find((role) => role.id === "verified_resident");
const voterRole = PLATFORM_ROLES.find((role) => role.id === "verified_voter");
const sampleResidencyFlow = createVerificationFlow("audit-user", "residency_verification", "2026-06-20T00:00:00.000Z");
const sampleVoterFlow = createVerificationFlow("audit-user", "voter_registration_verification", "2026-06-20T00:00:00.000Z");
const residencyClaim = issueVerificationClaim(sampleResidencyFlow, "Nevada resident", "2026-06-20T00:00:00.000Z");
const voterClaim = issueVerificationClaim(sampleVoterFlow, "Nevada voter registration matched", "2026-06-20T00:00:00.000Z");

const failures = [
  PLATFORM_ROLES.length < 6 ? "Missing required platform roles" : null,
  !residentRole || !voterRole ? "Verified resident/voter roles missing" : null,
  JSON.stringify(residentRole?.capabilities ?? []) !== JSON.stringify(voterRole?.capabilities ?? []) ? "Verified resident and verified voter participation capabilities must remain equal" : null,
  residentRole?.votingRightsGroup !== voterRole?.votingRightsGroup ? "Verified resident/voter voting rights group mismatch" : null,
  residencyClaim.claim.sourceEvidenceRetained ? "Residency claim retained sensitive source evidence" : null,
  voterClaim.claim.sourceEvidenceRetained ? "Voter claim retained sensitive source evidence" : null,
  SECURITY_CONTROLS.length < 8 ? "Missing security controls" : null,
  DATA_DOMAIN_SEPARATION.length !== 4 ? "Data domain separation must cover four required domains" : null,
].filter(Boolean);

const audit = {
  generatedAt: new Date().toISOString(),
  totals: {
    platformRoles: PLATFORM_ROLES.length,
    securityControls: SECURITY_CONTROLS.length,
    stakeholderClaimTypes: STAKEHOLDER_CLAIM_TYPES.length,
    organizationClaimTypes: ORGANIZATION_CLAIM_TYPES.length,
    dataDomains: DATA_DOMAIN_SEPARATION.length,
    failures: failures.length,
  },
  roleModel: PLATFORM_ROLES,
  participationPolicy: {
    noVoteWeighting: true,
    residentAndVoterRightsEqual: failures.every((failure) => !String(failure).includes("Verified resident")),
    segmentationOnly: ["all_verified_participants", "verified_residents", "verified_voters"],
  },
  claimsModel: {
    domains: ["identity", "residency", "voter", "stakeholder", "organization", "trust", "demographic"],
    stakeholderClaimTypes: STAKEHOLDER_CLAIM_TYPES,
    organizationClaimTypes: ORGANIZATION_CLAIM_TYPES,
    politicalAffiliationPolicy: {
      optional: true,
      publicByDefault: false,
      usedForWeighting: false,
      determinesParticipationRights: false,
    },
    sampleClaims: [residencyClaim.claim, voterClaim.claim],
  },
  verificationPolicy: {
    targetModel: "Verify -> Create Claim -> Remove Source Evidence",
    sampleFlows: [residencyClaim.flow, voterClaim.flow],
  },
  securityControls: SECURITY_CONTROLS,
  dataDomainSeparation: DATA_DOMAIN_SEPARATION,
  failures,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
if (failures.length) {
  console.error("Trust foundation audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Generated trust foundation audit at ${OUTPUT_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));
