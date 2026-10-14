import { createHash } from "node:crypto";

import { getDurableIdentityStorageStatus } from "@/lib/identity/durable-storage";
import { createDurableEmailToken, redactEmailForAudit, sendIdentityEmail } from "@/lib/identity/email";
import { readIdentityStore, writeIdentityStore } from "@/lib/identity/storage";
import { prisma } from "@/lib/prisma";

function getArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function requireRecentAuthFlags() {
  return process.argv.includes("--recent-password-auth") && process.argv.includes("--recent-mfa-auth");
}

async function findDurableAccountByEmail(email: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; email: string; mfaEnabled: boolean }>>(
    'select "id","email","mfaEnabled" from "IdentityAccount" where lower("email")=lower($1) limit 2',
    email,
  );
  if (rows.length !== 1) return null;
  return rows[0];
}

async function requestChange(from: string, to: string) {
  const account = await findDurableAccountByEmail(from);
  if (!account) return { ok: false as const, status: "ambiguous_or_missing_account" };
  const duplicate = await findDurableAccountByEmail(to);
  if (duplicate) return { ok: false as const, status: "target_email_exists" };
  const token = await createDurableEmailToken({
    accountId: account.id,
    purpose: "email_change_confirmation",
    ttlMinutes: 30,
    metadata: { pendingEmail: to.trim().toLowerCase(), priorEmailHash: createHash("sha256").update(account.email.toLowerCase()).digest("hex") },
  });
  if (!token.ok) return { ok: false as const, status: token.status };
  const delivery = await sendIdentityEmail({
    to,
    purpose: "email_change_confirmation",
    subject: "Confirm your Direct Democracy admin email change",
    text: `Confirm this Direct Democracy admin email change with this one-time token: ${token.token}\n\nThis token expires at ${token.expiresAt}.`,
  });
  await prisma.$executeRawUnsafe(
    `insert into "IdentitySecurityEvent" ("id","eventType","accountId","actorAccountId","summary","metadata")
     values ($1,'email_change_requested',$2,'trusted_terminal','Admin email change verification requested.',$3::jsonb)`,
    `security_${Date.now()}_email_change_requested`,
    account.id,
    JSON.stringify({ deliveryStatus: delivery.status, toEmailHash: createHash("sha256").update(to.trim().toLowerCase()).digest("hex") }),
  );
  return { ok: delivery.ok as boolean, status: delivery.status, accountId: account.id, tokenPrinted: false, priorEmailStillActive: true };
}

async function verifyChange(token: string, to: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; accountId: string; metadata: { pendingEmail?: string } }>>(
    `select "id","accountId","metadata" from "IdentityToken"
     where "tokenHash"=$1 and "purpose"='email_change_confirmation'
       and "consumedAt" is null and "revokedAt" is null and "expiresAt" > now()
     limit 1`,
    tokenHash,
  );
  const record = rows[0];
  const pendingEmail = record?.metadata?.pendingEmail;
  if (!record || !pendingEmail || pendingEmail !== to.trim().toLowerCase()) return { ok: false as const, status: "token_invalid_or_expired" };
  const duplicate = await findDurableAccountByEmail(pendingEmail);
  if (duplicate && duplicate.id !== record.accountId) return { ok: false as const, status: "target_email_exists" };
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `update "IdentityToken" set "consumedAt"=now() where "id"=$1 and "consumedAt" is null`,
      record.id,
    );
    await tx.$executeRawUnsafe(
      `update "IdentityAccount" set "email"=$2, "emailVerificationStatus"='verified', "updatedAt"=now() where "id"=$1`,
      record.accountId,
      pendingEmail,
    );
    await tx.$executeRawUnsafe(
      `update "IdentitySession" set "revokedAt"=now(), "reason"='email_changed' where "accountId"=$1 and "revokedAt" is null`,
      record.accountId,
    );
    await tx.$executeRawUnsafe(
      `insert into "IdentitySecurityEvent" ("id","eventType","accountId","actorAccountId","summary","metadata")
       values ($1,'email_changed',$2,'trusted_terminal','Admin email changed after token verification.',$3::jsonb)`,
      `security_${Date.now()}_email_changed`,
      record.accountId,
      JSON.stringify({ sessionsRevoked: true, sameAccountPreserved: true, toEmailHash: createHash("sha256").update(pendingEmail).digest("hex") }),
    );
  });
  const localStore = readIdentityStore();
  const localAccount = localStore.accounts.find((account) => account.id === record.accountId);
  if (localAccount) {
    localAccount.email = pendingEmail;
    localAccount.emailVerificationStatus = "verified";
    localAccount.updatedAt = new Date().toISOString();
    localStore.securityEvents.unshift({
      id: `security_${Date.now()}_email_changed_local_sync`,
      type: "email_changed",
      userId: localAccount.id,
      actorUserId: "trusted_terminal",
      createdAt: new Date().toISOString(),
      summary: "Local identity fallback email synced after durable admin email verification.",
      metadata: { durableAccountId: record.accountId, sameAccountPreserved: true },
    });
    writeIdentityStore(localStore);
  }
  return { ok: true as const, status: "email_changed", accountId: record.accountId, sessionsRevoked: true };
}

async function main() {
  const storage = await getDurableIdentityStorageStatus();
  if (!storage.ready) throw new Error(`durable_identity_required:${storage.status}`);
  if (!process.argv.includes("--confirm") || !requireRecentAuthFlags()) {
    throw new Error("Usage: npm run admin:change-email -- --from=<old> --to=<new> --confirm --recent-password-auth --recent-mfa-auth OR --verify-token=<token> --to=<new> --confirm --recent-password-auth --recent-mfa-auth");
  }
  const to = getArg("to");
  if (!to) throw new Error("target_email_required");
  const token = getArg("verify-token");
  const result = token ? await verifyChange(token, to) : await requestChange(getArg("from") ?? "", to);
  console.log(JSON.stringify({
    status: result.status,
    ok: result.ok,
    to: redactEmailForAudit(to),
    tokenPrinted: false,
    sessionsRevoked: "sessionsRevoked" in result ? result.sessionsRevoked : false,
    priorEmailStillActive: "priorEmailStillActive" in result ? result.priorEmailStillActive : false,
  }, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
