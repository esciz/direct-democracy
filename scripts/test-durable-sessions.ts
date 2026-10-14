import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { createIdentitySessionToken, durableAdminSecurityGate, hashIdentitySessionToken, IDENTITY_MFA_SESSION_TTL_MS, isIdentitySessionToken, sessionHasRecentMfa } from "../lib/identity/session-tokens";
import { verifyTotpCode } from "../lib/identity/mfa";

async function main() {
  Object.assign(process.env, { NODE_ENV: "test", NEXT_PUBLIC_ENABLE_DEMO_MODE: "false" });
  const now = new Date();
  const account = { id: "identity_test_owner", status: "active", disabledAt: null as Date | null, role: "platform_admin", permissionGrants: [], emailVerificationStatus: "verified", mustChangePassword: false, mfaEnabled: true, mfaEnrollmentRequired: false, mfaEnrolledAt: now };
  type Session = { id: string; accountId: string; sessionHash: string; createdAt: Date; expiresAt: Date; revokedAt: Date | null; mfaAuthenticatedAt: Date | null; reason?: string };
  const sessions: Session[] = [];
  let lookups = 0;
  const matches = (row: Session, where: Record<string, unknown>) => Object.entries(where).every(([key, value]) => {
    if (key === "expiresAt" && value && typeof value === "object") return row.expiresAt > (value as { gt: Date }).gt;
    return row[key as keyof Session] === value;
  });
  const fake = {
    identityAccount: { findUnique: async () => account },
    identitySession: {
      create: async ({ data }: { data: Session }) => { const row = { ...data, revokedAt: data.revokedAt ?? null }; sessions.push(row); return row; },
      findUnique: async ({ where }: { where: Record<string, unknown> }) => { lookups++; const row = sessions.find((s) => matches(s, where)); return row ? { ...row, account } : null; },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Session> }) => { let count = 0; for (const row of sessions) if (matches(row, where)) { Object.assign(row, data); count++; } return { count }; },
    },
    $transaction: async (callback: (tx: unknown) => unknown) => callback(fake),
  };
  globalThis.prisma = fake as unknown as PrismaClient;
  const { createDurableSession, resolveDurableSession, revokeDurableSession, rotateDurableSession } = await import("../lib/identity/durable-sessions");
  for (const invalid of [null, "identity_test_owner", "user_admin_riley_morgan", "legacy_cookie_123", "dd1_short", `${createIdentitySessionToken()}extra`]) assert.equal(await resolveDurableSession(invalid), null);
  assert.equal(lookups, 0, "Known account IDs must never authenticate or trigger a lookup");
  const token = await createDurableSession(account.id);
  assert.ok(isIdentitySessionToken(token)); assert.equal(sessions[0].sessionHash, hashIdentitySessionToken(token)); assert.notEqual(sessions[0].sessionHash, token);
  assert.equal((await resolveDurableSession(token))?.accountId, account.id);
  assert.equal(sessionHasRecentMfa(await resolveDurableSession(token)), false, "Password-only sessions do not imply MFA");
  assert.equal(durableAdminSecurityGate((await resolveDurableSession(token))!), "mfa_challenge_required");
  const next = await rotateDurableSession(token, { mfaAuthenticatedAt: now });
  assert.notEqual(next, token); assert.equal(await resolveDurableSession(token), null);
  assert.equal(durableAdminSecurityGate((await resolveDurableSession(next))!), "ok");
  assert.equal(sessionHasRecentMfa({ mfaAuthenticatedAt: new Date(Date.now() - IDENTITY_MFA_SESSION_TTL_MS - 1) }), false);
  assert.equal(sessionHasRecentMfa({ mfaAuthenticatedAt: new Date(Date.now() + 60_000) }), false);
  account.mustChangePassword = true; assert.equal(durableAdminSecurityGate((await resolveDurableSession(next))!), "password_rotation_required"); account.mustChangePassword = false;
  account.mfaEnabled = false; assert.equal(durableAdminSecurityGate((await resolveDurableSession(next))!), "mfa_enrollment_required"); account.mfaEnabled = true;
  account.status = "disabled"; assert.equal(await resolveDurableSession(next), null); account.status = "active";
  account.disabledAt = now; assert.equal(await resolveDurableSession(next), null); account.disabledAt = null;
  await revokeDurableSession(next); assert.equal(await resolveDurableSession(next), null);
  const expiring = await createDurableSession(account.id); sessions.at(-1)!.expiresAt = new Date(0); assert.equal(await resolveDurableSession(expiring), null);
  const active = await createDurableSession(account.id);
  const { NextRequest } = await import("next/server"); const { proxy } = await import("../proxy");
  for (const route of ["/", "/events", "/explore", "/voting", "/organizations", "/account/reset-password?token=fixture"]) {
    assert.equal((await proxy(new NextRequest(`https://example.test${route}`))).status, 200, `Public browse route must stay shareable: ${route}`);
  }
  for (const route of ["/profile", "/messages", "/account/security/mfa/challenge", "/account/security/change-password"]) {
    assert.equal((await proxy(new NextRequest(`https://example.test${route}`))).status, 307, `Personal route requires a session: ${route}`);
  }
  const response = await proxy(new NextRequest("https://example.test/api/admin/operations", { headers: { cookie: "dd_session_user=identity_test_owner" } }));
  assert.equal(response.status, 401, "A forged owner ID cannot authorize an admin API");
  account.role = "citizen";
  assert.equal((await proxy(new NextRequest("https://example.test/api/admin/operations", { headers: { cookie: `dd_session_user=${active}` } }))).status, 403);
  // Deterministic TOTP evidence: replaying an older accepted-window counter is forbidden.
  const counter = 123456; const secret = "AAAAAAAAAAAAAAAA"; // ten zero bytes encoded as base32
  function codeFor(value: number) { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(value)); const d = createHmac("sha1", Buffer.alloc(10)).update(b).digest(); const o = d[d.length - 1] & 15; return String((d.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0"); }
  const lastHash = createHash("sha256").update(`${secret}:${counter}`).digest("hex");
  assert.equal(verifyTotpCode({ secret, code: codeFor(counter - 1), now: counter * 30_000, lastAcceptedCounterHash: lastHash }).ok, false);
  assert.equal(verifyTotpCode({ secret, code: codeFor(counter + 1), now: counter * 30_000, lastAcceptedCounterHash: lastHash }).ok, true);
  console.log("Durable authentication: opaque hashed tokens, forged ID rejection, expiry/disabled/revoked sessions, rotation, MFA gates/replay protection, and proxy authorization passed against an isolated in-memory repository.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
