import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "nevada-beta-boundary-audit.json");

function readText(relativePath: string) {
  const filePath = path.join(ROOT, relativePath);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function includes(relativePath: string, text: string) {
  return readText(relativePath).includes(text);
}

const validation = {
  registrationStatesNevadaFocus:
    includes("components/domain/auth-entry-client.tsx", "Nevada-focused onboarding path") &&
    includes("components/domain/auth-entry-client.tsx", "only available or locally relevant for Nevada residents"),
  authIntroMentionsBetaScope:
    includes("components/domain/auth-entry-client.tsx", "During this beta") &&
    includes("components/domain/auth-entry-client.tsx", "focused on Nevada"),
  guidedOnboardingHasNevadaNotice:
    includes("app/get-started/page.tsx", "Nevada beta note") &&
    includes("app/get-started/page.tsx", "Non-Nevada testers can still create an account"),
  guidedVerificationStatesNevadaOnly:
    includes("app/get-started/page.tsx", "This beta verifies Nevada voter and residency information first") &&
    includes("app/get-started/page.tsx", "voter verification is for Nevada residents"),
  accountVerificationStatesNevadaOnly:
    includes("app/account/verification/page.tsx", "Verification is currently Nevada-only") &&
    includes("app/account/verification/page.tsx", "This voter workflow is for Nevada residents only"),
  profileOnboardingStatesNevadaScope:
    includes("app/profile/page.tsx", "complete Nevada voter verification") &&
    includes("app/profile/page.tsx", "local civic data is Nevada-focused"),
  verificationCardUsesNevadaLabel:
    includes("components/domain/verification-status-card.tsx", "Complete Nevada voter verification") &&
    includes("components/domain/verification-status-card.tsx", "primary Nevada community"),
};

const failures = Object.entries(validation).flatMap(([name, ok]) => (ok ? [] : [name]));

const report = {
  generatedAt: new Date().toISOString(),
  status: failures.length ? "failed" : "passed",
  validation,
  failures,
  sensitiveValuesIncluded: false,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

console.log("Nevada beta boundary audit complete.");
console.log(
  JSON.stringify(
    {
      status: report.status,
      failures,
      output: OUTPUT_PATH,
    },
    null,
    2,
  ),
);

if (failures.length) {
  process.exitCode = 1;
}
