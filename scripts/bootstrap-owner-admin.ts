import { bootstrapOwnerAdmin } from "@/lib/identity/accounts";
import { OWNER_ADMIN_DEFAULT_EMAIL } from "@/lib/identity/constants";
import { generateTemporaryPassword } from "@/lib/identity/passwords";

const args = new Map(
  process.argv.slice(2).flatMap((arg) => {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    return match ? [[match[1], match[2]]] : [];
  }),
);

const isProduction = process.env.NODE_ENV === "production";
const confirmProduction = process.argv.includes("--confirm-production-owner-bootstrap");
if (isProduction && !confirmProduction) {
  console.error("Refusing production owner bootstrap without --confirm-production-owner-bootstrap.");
  process.exit(1);
}

const email = (args.get("email") || process.env.OWNER_ADMIN_EMAIL || OWNER_ADMIN_DEFAULT_EMAIL).trim().toLowerCase();
const temporaryPassword = generateTemporaryPassword(32);
const { account, created } = bootstrapOwnerAdmin(email, temporaryPassword);

if (!created) {
  console.log(JSON.stringify({ ok: true, created: false, email: account.email, message: "Owner admin already exists; no password was changed or displayed." }, null, 2));
} else {
  console.log(JSON.stringify({
    ok: true,
    created: true,
    email: account.email,
    temporaryPassword,
    mustChangePassword: account.mustChangePassword,
    mfaEnrollmentRequired: account.mfaEnrollmentRequired,
    plaintextStored: false,
  }, null, 2));
}
