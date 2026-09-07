import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { createAccountRecoveryService } from "../lib/identity/account-recovery";
import { verifyPassword } from "../lib/identity/passwords";
import type { sendIdentityEmail } from "../lib/identity/email";

type Row = Record<string, any>;
function fixture() {
  let rows: Record<string, Row[]> = {
    identityAccount: [{ id: "fixture_account", email: "fixture@example.invalid", status: "active", disabledAt: null, emailVerificationStatus: "unverified", mfaEnabled: true }],
    identityToken: [], identityCredential: [{ id: "old_password", accountId: "fixture_account", credentialType: "password", revokedAt: null }],
    identitySession: [{ id: "old_session", accountId: "fixture_account", revokedAt: null }], identitySecurityEvent: [],
  };
  function matches(row: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (value && typeof value === "object" && !(value instanceof Date)) {
        if ("gt" in value) return row[key] > value.gt;
      }
      return row[key] === value;
    });
  }
  const tx: Row = { $queryRaw: async () => [] };
  let rejectCredential = false;
  for (const table of Object.keys(rows)) tx[table] = {
    findUnique: async ({ where }: Row) => rows[table].find(row => matches(row, where)) ?? null,
    findMany: async ({ where, orderBy }: Row) => rows[table].filter(row => matches(row, where)).sort((a, b) => orderBy?.createdAt === "desc" ? b.createdAt - a.createdAt : 0),
    create: async ({ data }: Row) => {
      if (table === "identityCredential" && rejectCredential) throw new Error("fixture transaction failure");
      const row = { createdAt: new Date(), consumedAt: null, revokedAt: null, ...data }; rows[table].push(row); return row;
    },
    update: async ({ where, data }: Row) => { const row = rows[table].find(row => matches(row, where)); Object.assign(row!, data); return row; },
    updateMany: async ({ where, data }: Row) => { const found = rows[table].filter(row => matches(row, where)); found.forEach(row => Object.assign(row, data)); return { count: found.length }; },
  };
  let chain = Promise.resolve();
  const database = { ...tx, $transaction: (work: (value: unknown) => Promise<unknown>) => {
    const result = chain.then(async () => {
      const before = structuredClone(rows);
      try { return await work(tx); } catch (error) { rows = before; throw error; }
    });
    chain = result.then(() => undefined, () => undefined);
    return result;
  } } as unknown as PrismaClient;
  const sent: Array<Parameters<typeof sendIdentityEmail>[0]> = [];
  let deliveryFails = false;
  const deliver: typeof sendIdentityEmail = async input => {
    sent.push(input);
    return deliveryFails
      ? { ok: false, status: "provider_send_failed", providerStatus: "production_provider_configured", reason: "fixture failure" }
      : { ok: true, status: "sent", providerStatus: "production_provider_configured" };
  };
  return { service: createAccountRecoveryService(database, deliver), sent, rows: () => rows, failDelivery: () => { deliveryFails = true; }, failCredential: () => { rejectCredential = true; } };
}

function rawToken(message: Parameters<typeof sendIdentityEmail>[0]) {
  const match = message.text.match(/https:\/\/[^\s]+/);
  assert.ok(match);
  return new URL(match[0]).searchParams.get("token")!;
}

async function main() {
  const f = fixture();
  assert.equal((await f.service.request({ purpose: "password_reset", email: "unknown@example.invalid", origin: "https://example.invalid" })).status, "ineligible");
  assert.equal(f.sent.length, 0);
  const requests = await Promise.all([0, 1].map(() => f.service.request({ purpose: "password_reset", email: "fixture@example.invalid", origin: "https://example.invalid" })));
  assert.deepEqual(requests.map(row => row.status).sort(), ["rate_limited", "sent"]);
  assert.equal(f.sent.length, 1);
  const token = rawToken(f.sent[0]);
  assert.ok(!JSON.stringify(f.rows()).includes(token), "Only the token hash may be persisted");
  assert.equal(f.rows().identityToken[0].tokenHash, createHash("sha256").update(token).digest("hex"));
  assert.equal((await f.service.consume({ token, purpose: "account_email_verification" })).ok, false);
  assert.equal(f.rows().identityToken[0].consumedAt, null);
  const resets = await Promise.all([0, 1].map(() => f.service.consume({ token, purpose: "password_reset", password: "new secure fixture password" })));
  assert.equal(resets.filter(result => result.ok).length, 1, "Concurrent uses consume a reset token only once");
  const credential = f.rows().identityCredential.find(row => row.revokedAt === null)!;
  assert.ok(verifyPassword("new secure fixture password", { ...credential, ...credential.metadata, createdAt: credential.createdAt.toISOString() }));
  assert.ok(f.rows().identitySession[0].revokedAt);
  assert.ok(f.rows().identityCredential[0].revokedAt);
  assert.equal(f.rows().identityAccount[0].mfaEnabled, true, "Password recovery must preserve MFA enrollment");

  for (const invalidation of ["expired", "email_changed", "disabled"] as const) {
    const item = fixture();
    await item.service.request({ accountId: "fixture_account", purpose: "account_email_verification", origin: "https://example.invalid" });
    if (invalidation === "expired") item.rows().identityToken[0].expiresAt = new Date(0);
    if (invalidation === "email_changed") item.rows().identityAccount[0].email = "changed@example.invalid";
    if (invalidation === "disabled") item.rows().identityAccount[0].disabledAt = new Date();
    assert.equal((await item.service.consume({ token: rawToken(item.sent[0]), purpose: "account_email_verification" })).ok, false);
    assert.equal(item.rows().identityAccount[0].emailVerificationStatus, "unverified");
  }
  const verification = fixture();
  await verification.service.request({ accountId: "fixture_account", purpose: "account_email_verification", origin: "https://example.invalid" });
  assert.equal((await verification.service.consume({ token: rawToken(verification.sent[0]), purpose: "account_email_verification" })).ok, true);
  assert.equal(verification.rows().identityAccount[0].emailVerificationStatus, "verified");
  const failed = fixture(); failed.failDelivery();
  assert.equal((await failed.service.request({ accountId: "fixture_account", purpose: "account_email_verification", origin: "https://example.invalid" })).status, "delivery_failed");
  assert.ok(failed.rows().identityToken[0].revokedAt);
  const rollback = fixture();
  await rollback.service.request({ accountId: "fixture_account", purpose: "password_reset", origin: "https://example.invalid" });
  rollback.failCredential();
  await assert.rejects(rollback.service.consume({ token: rawToken(rollback.sent[0]), purpose: "password_reset", password: "new fixture password" }));
  assert.equal(rollback.rows().identityToken[0].consumedAt, null);
  assert.equal(rollback.rows().identityCredential[0].revokedAt, null);
  assert.equal(rollback.rows().identitySession[0].revokedAt, null);
  console.log("Account recovery fixtures passed: hashed tokens, throttling, delivery failure, email binding, expiry, purpose separation, single-use concurrency, credential/session revocation, MFA preservation, and atomic rollback. No real accounts or emails used.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
