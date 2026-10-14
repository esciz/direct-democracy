import { readIdentityStore, writeIdentityStore } from "@/lib/identity/storage";

export function purgeExpiredVerificationEvidence(now = new Date()) {
  const store = readIdentityStore();
  let purged = 0;
  for (const record of store.verificationEvidence) {
    if (!record.purgedAt && new Date(record.purgeAfter).getTime() <= now.getTime()) {
      record.purgedAt = now.toISOString();
      record.sourceFileRetained = false;
      purged += 1;
    }
  }
  writeIdentityStore(store);
  return { purged, totalEvidenceRecords: store.verificationEvidence.length };
}
