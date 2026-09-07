import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createIdentitySessionToken, hashIdentitySessionToken, IDENTITY_SESSION_TTL_MS, isIdentitySessionToken, sessionIsActive } from "@/lib/identity/session-tokens";

export async function createDurableSession(accountId: string, options: { mfaAuthenticatedAt?: Date } = {}) {
  const account = await prisma.identityAccount.findUnique({ where: { id: accountId }, select: { status: true, disabledAt: true } });
  if (!account || account.status !== "active" || account.disabledAt) throw new Error("inactive_account");
  const token = createIdentitySessionToken(); const now = new Date();
  await prisma.identitySession.create({ data: { id: `session_${randomUUID()}`, accountId, sessionHash: hashIdentitySessionToken(token), createdAt: now, expiresAt: new Date(now.getTime() + IDENTITY_SESSION_TTL_MS), mfaAuthenticatedAt: options.mfaAuthenticatedAt ?? null } });
  return token;
}

export async function resolveDurableSession(token: string | null | undefined) {
  // Account IDs, old legacy-cookie placeholders and malformed tokens never reach a user lookup.
  if (!isIdentitySessionToken(token)) return null;
  const session = await prisma.identitySession.findUnique({ where: { sessionHash: hashIdentitySessionToken(token) }, include: { account: { include: { permissionGrants: { where: { revokedAt: null } } } } } });
  if (!sessionIsActive(session)) return null;
  return session;
}

export async function revokeDurableSession(token: string | null | undefined, reason = "signed_out") {
  if (!isIdentitySessionToken(token)) return;
  await prisma.identitySession.updateMany({ where: { sessionHash: hashIdentitySessionToken(token), revokedAt: null }, data: { revokedAt: new Date(), reason } });
}

export async function rotateDurableSession(token: string, options: { mfaAuthenticatedAt?: Date } = {}) {
  const previous = await resolveDurableSession(token);
  if (!previous) throw new Error("invalid_session");
  const next = createIdentitySessionToken(); const now = new Date();
  await prisma.$transaction(async (tx) => {
    const revoked = await tx.identitySession.updateMany({ where: { id: previous.id, revokedAt: null, expiresAt: { gt: now } }, data: { revokedAt: now, reason: "session_rotated" } });
    if (revoked.count !== 1) throw new Error("invalid_session");
    await tx.identitySession.create({ data: { id: `session_${randomUUID()}`, accountId: previous.accountId, sessionHash: hashIdentitySessionToken(next), createdAt: now, expiresAt: new Date(now.getTime() + IDENTITY_SESSION_TTL_MS), mfaAuthenticatedAt: options.mfaAuthenticatedAt ?? previous.mfaAuthenticatedAt } });
  });
  return next;
}
