import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function getArg(name: string) { const prefix = `--${name}=`; return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length); }
async function main() {
  const email = getArg("email")?.trim().toLowerCase();
  const dryRun = process.argv.includes("--dry-run");
  if (!email || (!dryRun && !process.argv.includes("--confirm"))) throw new Error("Usage: npm run admin:mfa-reset -- --email=<email> --dry-run|--confirm");
  const account = await prisma.identityAccount.findUnique({ where: { email }, select: { id: true, role: true, mfaEnabled: true } });
  if (!account) throw new Error("account_not_found");
  if (dryRun) { console.log(JSON.stringify({ status: "dry_run", accountFound: true, role: account.role, currentlyEnrolled: account.mfaEnabled, wouldRevokeAllSessions: true })); return; }
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.identityAccount.update({ where: { id: account.id }, data: { mfaEnabled: false, mfaEncryptedSecret: null, mfaPendingEnrollment: Prisma.DbNull, mfaLastAcceptedCounterHash: null, mfaFailedAttempts: 0, mfaEnrollmentRequired: true, mfaEnrolledAt: null } });
    await tx.identityMfaRecoveryCode.deleteMany({ where: { accountId: account.id } });
    await tx.identitySession.updateMany({ where: { accountId: account.id, revokedAt: null }, data: { revokedAt: now, reason: "mfa_reset" } });
    await tx.identitySecurityEvent.create({ data: { id: `security_${randomUUID()}`, accountId: account.id, eventType: "mfa_reset", summary: "MFA reset from trusted operator terminal.", metadata: { sessionsRevoked: true, passwordPreserved: true } } });
  });
  console.log(JSON.stringify({ status: "mfa_reset", mfaEnrollmentRequired: true, sessionsRevoked: true, passwordPreserved: true }));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "mfa_reset_failed"); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
