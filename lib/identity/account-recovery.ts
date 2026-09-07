import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createOneTimeEmailToken, sendIdentityEmail } from "@/lib/identity/email";
import { hashPassword } from "@/lib/identity/passwords";

type RecoveryPurpose = "account_email_verification" | "password_reset";
type RecoveryDatabase = Pick<PrismaClient, "$transaction" | "identityAccount" | "identityToken">;

export function identityEmailOrigin() {
  const configured = process.env.DIRECT_DEMOCRACY_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL;
  const origin = new URL(configured || (process.env.NODE_ENV === "production" ? "https://directyourdemocracy.com" : "http://localhost:3000"));
  if (origin.username || origin.password || (origin.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname)))) throw new Error("Invalid account email origin");
  return origin.origin;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function boundEmail(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || !("email" in metadata)) return null;
  return typeof metadata.email === "string" ? metadata.email : null;
}

export function createAccountRecoveryService(database: RecoveryDatabase = prisma, deliver: typeof sendIdentityEmail = sendIdentityEmail) {
  async function request(input: { purpose: RecoveryPurpose; accountId?: string; email?: string; origin: string }) {
    const now = new Date();
    const generated = createOneTimeEmailToken(input.purpose, input.purpose === "password_reset" ? 30 : 24 * 60);
    const prepared = await database.$transaction(async tx => {
      const account = input.accountId
        ? await tx.identityAccount.findUnique({ where: { id: input.accountId } })
        : await tx.identityAccount.findUnique({ where: { email: input.email?.trim().toLowerCase() ?? "" } });
      if (!account || account.disabledAt || !["active", "locked"].includes(account.status)) return { status: "ineligible" as const };
      // Serialize issuance for the account so concurrent requests cannot bypass throttling.
      await tx.$queryRaw`SELECT "id" FROM "IdentityAccount" WHERE "id" = ${account.id} FOR UPDATE`;
      if (input.purpose === "account_email_verification" && account.emailVerificationStatus === "verified") return { status: "already_verified" as const };
      const recent = await tx.identityToken.findMany({ where: { accountId: account.id, purpose: input.purpose, createdAt: { gt: new Date(now.getTime() - 30 * 60_000) } }, orderBy: { createdAt: "desc" } });
      if (recent.length >= 3 || (recent[0] && now.getTime() - recent[0].createdAt.getTime() < 60_000)) return { status: "rate_limited" as const };
      const id = `token_${randomUUID()}`;
      await tx.identityToken.create({ data: { id, accountId: account.id, tokenType: "email", tokenHash: generated.tokenHash, purpose: input.purpose, expiresAt: new Date(generated.expiresAt), metadata: { email: account.email, deliveryStatus: "pending", oneTimeUse: true } } });
      return { status: "prepared" as const, id, accountId: account.id, email: account.email };
    });
    if (prepared.status !== "prepared") return { status: prepared.status };
    const route = input.purpose === "password_reset" ? "/account/reset-password" : "/account/verify-email";
    const url = new URL(route, input.origin);
    url.searchParams.set("token", generated.token);
    const delivery = await deliver({
      to: prepared.email,
      purpose: input.purpose,
      subject: input.purpose === "password_reset" ? "Reset your Direct Democracy password" : "Verify your Direct Democracy email",
      text: [input.purpose === "password_reset" ? "Choose a new password using this one-time link:" : "Verify your email using this one-time link:", url.toString(), `This link expires at ${generated.expiresAt}.`, "If you did not request this email, you can ignore it."].join("\n\n"),
      idempotencyKey: prepared.id,
    });
    const delivered = delivery.ok && delivery.status === "sent";
    await database.identityToken.update({ where: { id: prepared.id }, data: { ...(delivered ? {} : { revokedAt: new Date() }), metadata: { email: prepared.email, deliveryStatus: delivery.status, oneTimeUse: true } } });
    return { status: delivered ? "sent" as const : "delivery_failed" as const, deliveryStatus: delivery.status };
  }

  async function consume(input: { token: string; purpose: RecoveryPurpose; password?: string }) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(input.token)) return { ok: false as const, status: "invalid_or_expired" as const };
    if (input.purpose === "password_reset" && (!input.password || input.password.length < 8 || input.password.length > 256)) return { ok: false as const, status: "invalid_password" as const };
    const password = input.purpose === "password_reset" ? hashPassword(input.password!) : null;
    return database.$transaction(async tx => {
      const token = await tx.identityToken.findUnique({ where: { tokenHash: tokenHash(input.token) } });
      if (!token || token.purpose !== input.purpose || token.tokenType !== "email") return { ok: false as const, status: "invalid_or_expired" as const };
      await tx.$queryRaw`SELECT "id" FROM "IdentityAccount" WHERE "id" = ${token.accountId} FOR UPDATE`;
      const account = await tx.identityAccount.findUnique({ where: { id: token.accountId } });
      if (!account || account.disabledAt || !["active", "locked"].includes(account.status) || account.email !== boundEmail(token.metadata)) return { ok: false as const, status: "invalid_or_expired" as const };
      const now = new Date();
      const claimed = await tx.identityToken.updateMany({ where: { id: token.id, consumedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
      if (claimed.count !== 1) return { ok: false as const, status: "invalid_or_expired" as const };
      if (password) {
        await tx.identityCredential.updateMany({ where: { accountId: account.id, credentialType: "password", revokedAt: null }, data: { revokedAt: now } });
        await tx.identityCredential.create({ data: { id: `credential_${randomUUID()}`, accountId: account.id, credentialType: "password", algorithm: password.algorithm, salt: password.salt, hash: password.hash, metadata: { keyLength: password.keyLength, cost: password.cost } } });
        await tx.identitySession.updateMany({ where: { accountId: account.id, revokedAt: null }, data: { revokedAt: now, reason: "password_reset" } });
        await tx.identityAccount.update({ where: { id: account.id }, data: { status: "active", mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null } });
      } else await tx.identityAccount.update({ where: { id: account.id }, data: { emailVerificationStatus: "verified" } });
      await tx.identityToken.updateMany({ where: { accountId: account.id, purpose: input.purpose, consumedAt: null, revokedAt: null }, data: { revokedAt: now } });
      await tx.identitySecurityEvent.create({ data: { id: `security_${randomUUID()}`, accountId: account.id, eventType: password ? "password_changed" : "verification_status_changed", summary: password ? "Password reset using a one-time email link; existing sessions revoked." : "Email address verified using a one-time email link.", metadata: { method: "one_time_email_token" } } });
      return { ok: true as const, status: password ? "password_reset" as const : "email_verified" as const };
    });
  }
  return { request, consume };
}

export const accountRecovery = createAccountRecoveryService();
