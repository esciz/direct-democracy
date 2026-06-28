import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getAllSeedUsers } from "@/lib/auth/session";
import { getParticipationReadiness } from "@/lib/identity/participation-readiness";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "participation-readiness-audit.json");

const generatedAt = new Date().toISOString();
const users = getAllSeedUsers();
const records = users.map((user) => {
  const summary = getParticipationReadiness(user);
  return {
    userId: user.id,
    role: user.role,
    verificationClass: summary.verificationClass,
    voteWeight: summary.voteWeight,
    hiddenWeighting: summary.hiddenWeighting,
    trustedGrantStatus: summary.trustedGrantStatus,
    readyCapabilities: [...summary.unlocked, ...summary.nextSteps, ...summary.stewardship].filter((item) => item.status === "ready").map((item) => item.id),
    verificationUnlocks: summary.nextSteps.filter((item) => item.status !== "ready").map((item) => item.id),
  };
});

const validation = {
  allVoteWeightsOne: records.every((record) => record.voteWeight === 1),
  hiddenWeightingDisabled: records.every((record) => record.hiddenWeighting === false),
  trustedCitizenDoesNotChangeVoteWeight: records.filter((record) => record.role === "trustedCitizen").every((record) => record.voteWeight === 1),
  publicDataSeparationExplained: users.every((user) => getParticipationReadiness(user).publicDataSeparation.includes("stay separated")),
  trustedStewardshipExplained: users.every((user) => getParticipationReadiness(user).trustedCitizenNote.includes("does not make votes count more")),
};

const audit = {
  generatedAt,
  totals: {
    users: records.length,
    verifiedVoters: records.filter((record) => record.verificationClass === "verified_voter").length,
    verifiedResidents: records.filter((record) => record.verificationClass === "verified_resident").length,
    unverified: records.filter((record) => record.verificationClass === "authenticated_unverified").length,
    anonymousPublic: records.filter((record) => record.verificationClass === "anonymous_public").length,
    trustedCitizens: records.filter((record) => record.role === "trustedCitizen").length,
  },
  validation,
  pass: Object.values(validation).every(Boolean),
  records,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log(`Generated participation readiness audit at ${OUTPUT_PATH}`);
console.log(JSON.stringify({ pass: audit.pass, ...audit.totals }, null, 2));

if (!audit.pass) {
  process.exitCode = 1;
}
