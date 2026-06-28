import { getDurableIdentityStorageStatus } from "@/lib/identity/durable-storage";
import { prisma } from "@/lib/prisma";

async function main() {
  const status = await getDurableIdentityStorageStatus();
  if (!status.ready) {
    console.log(JSON.stringify({ status: "skipped", reason: status.status }, null, 2));
    return;
  }
  const result = await prisma.$executeRawUnsafe('update "IdentitySession" set "revokedAt" = now(), "reason" = coalesce("reason", \'expired_session_cleanup\') where "revokedAt" is null and "expiresAt" < now()');
  console.log(JSON.stringify({ status: "complete", expiredSessionsRevoked: result }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
