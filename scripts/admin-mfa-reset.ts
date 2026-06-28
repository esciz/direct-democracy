import { resetAccountMfa } from "@/lib/identity/accounts";

function getArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

const email = getArg("email");
const confirmed = process.argv.includes("--confirm");

if (!email || !confirmed) {
  console.error("Usage: npm run admin:mfa-reset -- --email=<email> --confirm");
  process.exit(1);
}

const result = resetAccountMfa(email);
if (!result.ok) {
  console.error(JSON.stringify({ status: "failed", reason: result.reason }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ status: "mfa_reset", email: result.account.email, mfaEnrollmentRequired: result.account.mfaEnrollmentRequired, sessionsRevoked: true }, null, 2));
