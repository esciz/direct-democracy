import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/identity/passwords";
import type { PasswordHash } from "@/lib/identity/types";
import type { AuthUser, UserRole } from "@/types/domain";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type DurableAccount = NonNullable<Awaited<ReturnType<typeof getDurableIdentityAccountById>>>;

function slugifyUsername(email: string) {
  return email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "citizen";
}

function credentialToPasswordHash(credential: {
  algorithm: string;
  salt: string;
  hash: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}): PasswordHash {
  const metadata = credential.metadata && typeof credential.metadata === "object" && !Array.isArray(credential.metadata) ? credential.metadata : {};
  const keyLength = typeof metadata.keyLength === "number" ? metadata.keyLength : 64;
  const cost = typeof metadata.cost === "string" ? metadata.cost : "node_crypto_scrypt";
  return {
    algorithm: "scrypt",
    salt: credential.salt,
    hash: credential.hash,
    keyLength,
    cost: cost === "node_crypto_scrypt" ? "node_crypto_scrypt" : "node_crypto_scrypt",
    createdAt: credential.createdAt.toISOString(),
  };
}

function accountToAuthUser(account: DurableAccount): AuthUser {
  const isVerifiedVoter = account.verificationClaims.some(
    (claim) =>
      (claim.status === "matched" || claim.status === "verified") &&
      (!claim.expiresAt || claim.expiresAt.getTime() > Date.now()),
  );
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    username: account.username,
    bio: account.role === "admin" || account.role === "platform_admin" ? "Public-platform administrator." : "Direct Democracy account.",
    role: account.role as UserRole,
    verificationState: isVerifiedVoter ? "voterVerified" : "unverified",
    jurisdictionName: "Nevada",
    followerCount: 0,
    isVerifiedVoter,
    isAnonymousPublic: account.role !== "admin" && account.role !== "platform_admin",
  };
}

export async function getDurableIdentityAccountById(accountId: string | null | undefined) {
  if (!accountId) return null;
  return prisma.identityAccount.findUnique({
    where: { id: accountId },
    include: {
      credentials: {
        where: { credentialType: "password", revokedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      verificationClaims: true,
    },
  });
}

export async function getDurableAuthUserById(accountId: string | null | undefined) {
  const account = await getDurableIdentityAccountById(accountId);
  if (!account || account.status !== "active" || account.disabledAt) return null;
  return accountToAuthUser(account);
}

export async function createDurableLocalAccount(input: {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
  emailVerified?: boolean;
}) {
  const email = input.email.trim().toLowerCase();
  const timestamp = new Date();
  const passwordHash = hashPassword(input.password);
  const baseUsername = slugifyUsername(email);

  if (await prisma.identityAccount.findUnique({ where: { email }, select: { id: true } })) {
    throw new Error("account_exists");
  }

  let username = baseUsername;
  for (let index = 2; index < 20; index += 1) {
    const existing = await prisma.identityAccount.findFirst({ where: { username }, select: { id: true } });
    if (!existing) break;
    username = `${baseUsername}-${index}`;
  }

  const accountId = `identity_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const role = input.role ?? "citizen";

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: userId,
        email,
        username,
        name: input.name.trim(),
        role,
      },
    });
    await tx.identityAccount.create({
      data: {
        id: accountId,
        userId,
        email,
        name: input.name.trim(),
        username,
        role,
        status: "active",
        emailVerificationStatus: input.emailVerified ? "verified" : "unverified",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });
    await tx.identityCredential.create({
      data: {
        id: `credential_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        accountId,
        credentialType: "password",
        algorithm: passwordHash.algorithm,
        salt: passwordHash.salt,
        hash: passwordHash.hash,
        metadata: { keyLength: passwordHash.keyLength, cost: passwordHash.cost },
        createdAt: timestamp,
      },
    });
    await tx.identitySecurityEvent.create({
      data: {
        id: `security_${Date.now()}_account`,
        accountId,
        eventType: "account_created",
        summary: "Account created.",
        metadata: { emailVerified: Boolean(input.emailVerified) },
        createdAt: timestamp,
      },
    });
  });

  const account = await getDurableIdentityAccountById(accountId);
  if (!account) throw new Error("account_create_failed");
  return account;
}

export async function authenticateDurableLocalAccount(emailInput: string, password: string) {
  const email = emailInput.trim().toLowerCase();
  const account = await getDurableIdentityAccountByEmail(email);
  const genericFailure = { ok: false as const, reason: "invalid_credentials" as const, account: null };

  if (!account) return genericFailure;
  if (account.status !== "active" || account.disabledAt) return { ok: false as const, reason: "disabled" as const, account };
  if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) return { ok: false as const, reason: "locked" as const, account };

  const credential = account.credentials[0];
  if (!credential || !verifyPassword(password, credentialToPasswordHash(credential))) {
    const failedLoginAttempts = account.failedLoginAttempts + 1;
    await prisma.identityAccount.update({
      where: { id: account.id },
      data: {
        failedLoginAttempts,
        status: failedLoginAttempts >= LOCKOUT_THRESHOLD ? "locked" : account.status,
        lockedUntil: failedLoginAttempts >= LOCKOUT_THRESHOLD ? new Date(Date.now() + LOCKOUT_MS) : account.lockedUntil,
      },
    });
    await prisma.identitySecurityEvent.create({
      data: {
        id: `security_${Date.now()}_login_failed`,
        accountId: account.id,
        eventType: "login_failed",
        summary: "Login failed.",
        metadata: { reason: "invalid_credentials" },
      },
    });
    return genericFailure;
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.identityAccount.update({
      where: { id: account.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        status: "active",
        lastLoginAt: now,
      },
    }),
    prisma.identitySession.create({
      data: {
        id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        accountId: account.id,
        sessionHash: `legacy_cookie_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: now,
        expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      },
    }),
    prisma.identitySecurityEvent.create({
      data: {
        id: `security_${Date.now()}_login_succeeded`,
        accountId: account.id,
        eventType: "login_succeeded",
        summary: "Login succeeded.",
        metadata: {},
      },
    }),
  ]);

  return { ok: true as const, account };
}

export async function getDurableIdentityAccountByEmail(emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  return prisma.identityAccount.findUnique({
    where: { email },
    include: {
      credentials: {
        where: { credentialType: "password", revokedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      verificationClaims: true,
    },
  });
}

export function durableAccountToAuthUser(account: DurableAccount) {
  return accountToAuthUser(account);
}
