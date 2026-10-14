import { getIdentityAccountByEmail } from "@/lib/identity/accounts";
import { generateTemporaryPassword, hashPassword } from "@/lib/identity/passwords";
import { readIdentityStore, writeIdentityStore } from "@/lib/identity/storage";

const args = new Map(
  process.argv.slice(2).flatMap((arg) => {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    return match ? [[match[1], match[2]]] : [];
  }),
);
const email = (args.get("email") || process.env.OWNER_ADMIN_EMAIL || "").trim().toLowerCase();
if (!email) {
  console.error("Pass --email=<email> or set OWNER_ADMIN_EMAIL.");
  process.exit(1);
}
const account = getIdentityAccountByEmail(email);
if (!account || (account.role !== "admin" && account.role !== "platform_admin")) {
  console.error("Owner admin account not found.");
  process.exit(1);
}
const temporaryPassword = generateTemporaryPassword(32);
const store = readIdentityStore();
const stored = store.accounts.find((entry) => entry.id === account.id);
if (!stored) process.exit(1);
stored.passwordHash = hashPassword(temporaryPassword);
stored.mustChangePassword = true;
stored.mfaEnrollmentRequired = true;
stored.updatedAt = new Date().toISOString();
writeIdentityStore(store);
console.log(JSON.stringify({ ok: true, email: stored.email, temporaryPassword, mustChangePassword: true, plaintextStored: false }, null, 2));
