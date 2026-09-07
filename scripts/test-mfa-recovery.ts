import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { encryptMfaSecret, hashBackupCode } from "../lib/identity/mfa";

const recoveryCode = "fixture-recovery-code";
function fixture(encryptedSecret: string | null) {
  let state = {
    account: { id: "identity_fixture", status: "active", disabledAt: null as Date | null, mfaEnabled: true, mfaEncryptedSecret: encryptedSecret, mfaFailedAttempts: 0, mfaLastAcceptedCounterHash: null, updatedAt: new Date() },
    recovery: { id: "recovery_fixture", codeHash: hashBackupCode(recoveryCode), usedAt: null as Date | null },
    events: [] as unknown[],
  };
  let conflict = false;
  const tx = {
    identityAccount: {
      findUnique: async ({ where }: { where: { id: string } }) => where.id === state.account.id
        ? { ...state.account, mfaRecoveryCodes: state.recovery.usedAt ? [] : [{ ...state.recovery }] } : null,
      update: async () => { state.account.mfaFailedAttempts++; },
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        if (conflict) return { count: 0 };
        Object.assign(state.account, data);
        return { count: 1 };
      },
    },
    identityMfaRecoveryCode: {
      updateMany: async () => {
        if (state.recovery.usedAt) return { count: 0 };
        state.recovery.usedAt = new Date();
        return { count: 1 };
      },
    },
    identitySecurityEvent: { create: async ({ data }: { data: unknown }) => { state.events.push(data); } },
  };
  let queue = Promise.resolve();
  const database = { $transaction: (work: (value: typeof tx) => Promise<unknown>) => {
    const result = queue.then(async () => {
      const before = structuredClone(state);
      try { return await work(tx); } catch (error) { state = before; throw error; }
    });
    queue = result.then(() => undefined, () => undefined);
    return result;
  } } as unknown as PrismaClient;
  return { database, state: () => state, conflict: () => { conflict = true; } };
}

async function main() {
  const previousKey = process.env.IDENTITY_MFA_ENCRYPTION_KEY;
  const previousClient = globalThis.prisma;
  try {
    process.env.IDENTITY_MFA_ENCRYPTION_KEY = "old-fixture-encryption-key";
    const encrypted = encryptMfaSecret("AAAAAAAAAAAAAAAA");
    process.env.IDENTITY_MFA_ENCRYPTION_KEY = "different-fixture-encryption-key";
    const { verifyDurableMfaChallenge } = await import("../lib/identity/durable-security");
    for (const secret of [encrypted, null]) {
      const f = fixture(secret); globalThis.prisma = f.database;
      const results = await Promise.all([0, 1].map(() => verifyDurableMfaChallenge("identity_fixture", recoveryCode)));
      assert.equal(results.filter(result => result.ok).length, 1, "Recovery works once even when the TOTP secret cannot be decrypted");
      assert.ok(f.state().recovery.usedAt);
      assert.equal(f.state().events.length, 1);
      assert.equal(f.state().account.mfaEnabled, true, "Recovery does not disable MFA");
      assert.equal(f.state().account.mfaEncryptedSecret, secret, "Recovery does not replace the enrolled secret");
    }
    const wrongCode = fixture(encrypted); globalThis.prisma = wrongCode.database;
    assert.equal((await verifyDurableMfaChallenge("identity_fixture", "wrong-recovery-code")).ok, false);
    assert.equal(wrongCode.state().account.mfaFailedAttempts, 1);
    assert.equal(wrongCode.state().recovery.usedAt, null);
    assert.deepEqual(await verifyDurableMfaChallenge("identity_fixture", "123456"), { ok: false, reason: "mfa_setup_unavailable" }, "Unreadable TOTP setup produces a recoverable error, not a page crash");
    assert.equal(wrongCode.state().account.mfaFailedAttempts, 1, "A server configuration failure must not count as a bad code");
    for (const blocked of ["missing", "disabled", "mfa_disabled", "limited"] as const) {
      const f = fixture(encrypted); globalThis.prisma = f.database;
      if (blocked === "disabled") f.state().account.disabledAt = new Date();
      if (blocked === "mfa_disabled") f.state().account.mfaEnabled = false;
      if (blocked === "limited") f.state().account.mfaFailedAttempts = 8;
      assert.equal((await verifyDurableMfaChallenge(blocked === "missing" ? "identity_other" : "identity_fixture", recoveryCode)).ok, false);
      assert.equal(f.state().recovery.usedAt, null, "An ineligible account cannot consume a recovery code");
      assert.equal(f.state().events.length, 0);
    }
    const rollback = fixture(encrypted); globalThis.prisma = rollback.database; rollback.conflict();
    await assert.rejects(verifyDurableMfaChallenge("identity_fixture", recoveryCode), /mfa_challenge_changed_retry/);
    assert.equal(rollback.state().recovery.usedAt, null, "A concurrent account change rolls back recovery-code consumption");
    assert.equal(rollback.state().events.length, 0);
    process.env.IDENTITY_MFA_ENCRYPTION_KEY = "old-fixture-encryption-key";
    const totp = fixture(encrypted); globalThis.prisma = totp.database;
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
    const digest = createHmac("sha1", Buffer.alloc(10)).update(counter).digest();
    const offset = digest[digest.length - 1] & 15;
    const code = String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
    assert.equal((await verifyDurableMfaChallenge("identity_fixture", code)).ok, true, "Configured authenticators continue to work");
    assert.equal(totp.state().recovery.usedAt, null, "TOTP must not consume recovery codes");
    assert.equal((await verifyDurableMfaChallenge("identity_fixture", code)).ok, false, "TOTP replay protection remains enforced");
    console.log("MFA recovery passed: unreadable/missing TOTP secrets, single-use recovery, invalid codes, account eligibility, rate limits, and transactional rollback. Isolated fixtures only.");
  } finally {
    globalThis.prisma = previousClient;
    if (previousKey === undefined) delete process.env.IDENTITY_MFA_ENCRYPTION_KEY;
    else process.env.IDENTITY_MFA_ENCRYPTION_KEY = previousKey;
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
