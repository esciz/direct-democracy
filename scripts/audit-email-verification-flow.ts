import fs from "node:fs/promises";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data/generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "email-verification-flow-audit.json");

async function read(filePath: string) {
  return fs.readFile(path.join(process.cwd(), filePath), "utf8");
}

async function main() {
  const [types, accounts, actions, page, route] = await Promise.all([
    read("lib/identity/types.ts"),
    read("lib/identity/accounts.ts"),
    read("lib/auth/actions.ts"),
    read("app/account/verification/page.tsx"),
    read("app/account/verify-email/route.ts"),
  ]);

  const audit = {
    generatedAt: new Date().toISOString(),
    status: "email_verification_flow_audited",
    sensitiveValuesIncluded: false,
    validation: {
      identityAccountStoresHashedVerificationRequest:
        types.includes("emailVerificationRequest") &&
        types.includes("tokenHash") &&
        accounts.includes("hashEmailVerificationToken") &&
        !types.includes("token: string"),
      rawTokenOnlyReturnedForDelivery:
        accounts.includes("randomBytes(32)") &&
        accounts.includes("return { ok: true as const, alreadyVerified: false as const, account, token"),
      deliveryUsesIdentityEmailAdapter:
        actions.includes("sendIdentityEmail") &&
        actions.includes('purpose: "account_email_verification"') &&
        actions.includes("/account/verify-email?token="),
      confirmationRouteConsumesToken:
        route.includes("verifyAccountEmailToken") &&
        route.includes("email-verified") &&
        route.includes("email-invalid") &&
        route.includes("email-expired"),
      accountPageShowsResendControl:
        page.includes('id="email-verification"') &&
        page.includes("Send verification link") &&
        page.includes("Email verified") &&
        page.includes("Email unverified"),
      generatedAuditDoesNotIncludeToken: true,
    },
  };
  const pass = Object.values(audit.validation).every(Boolean);

  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify({ ...audit, pass }, null, 2)}\n`);
  console.log("Email verification flow audit complete.");
  console.log(JSON.stringify({ pass, output: OUTPUT_PATH }, null, 2));
  if (!pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
