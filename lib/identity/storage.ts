import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { IdentityStore, SecurityEvent, SecurityEventType } from "@/lib/identity/types";

const PRIVATE_DIR = path.join(process.cwd(), "data", "private", "identity");
const STORE_PATH = path.join(PRIVATE_DIR, "identity-store.json");

export function getIdentityStorePath() {
  return STORE_PATH;
}

export function emptyIdentityStore(): IdentityStore {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    accounts: [],
    sessions: [],
    permissionGrants: [],
    verificationClaims: [],
    profileClaims: [],
    organizationAffiliations: [],
    consentRecords: [],
    trustedCitizenGrants: [],
    securityEvents: [],
    privacyRequests: [],
    verificationEvidence: [],
  };
}

export function readIdentityStore(): IdentityStore {
  if (!existsSync(STORE_PATH)) return emptyIdentityStore();
  return { ...emptyIdentityStore(), ...(JSON.parse(readFileSync(STORE_PATH, "utf8")) as IdentityStore) };
}

export function writeIdentityStore(store: IdentityStore) {
  mkdirSync(PRIVATE_DIR, { recursive: true, mode: 0o700 });
  const next = { ...store, generatedAt: new Date().toISOString() };
  const tmpPath = `${STORE_PATH}.${process.pid}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmpPath, STORE_PATH);
}

export function appendSecurityEvent(input: Omit<SecurityEvent, "id" | "createdAt">) {
  const store = readIdentityStore();
  store.securityEvents.unshift({
    ...input,
    id: `security_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  });
  writeIdentityStore(store);
}

export function createSecurityEvent(
  type: SecurityEventType,
  summary: string,
  options: {
    userId?: string | null;
    actorUserId?: string | null;
    metadata?: Record<string, string | number | boolean | null>;
  } = {},
) {
  appendSecurityEvent({
    type,
    summary,
    userId: options.userId ?? null,
    actorUserId: options.actorUserId ?? null,
    metadata: options.metadata ?? {},
  });
}
