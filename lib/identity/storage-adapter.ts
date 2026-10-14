import { getDurableIdentityStorageStatus, isDatabaseConfigured, productionIdentityFallbackAllowed } from "@/lib/identity/durable-storage";
import { readIdentityStore } from "@/lib/identity/storage";
import type { IdentityStore } from "@/lib/identity/types";

export type IdentityStorageMode =
  | "prisma_identity_configured"
  | "prisma_identity_unconfigured"
  | "local_identity_development_only"
  | "local_identity_forbidden_in_production";

export type IdentityStorageAdapter = {
  mode: IdentityStorageMode;
  readMigrationSource(): IdentityStore;
  assertProductionSafe(): Promise<void>;
};

export function readLocalIdentityMigrationSource() {
  return readIdentityStore();
}

export async function resolveIdentityStorageMode(): Promise<IdentityStorageMode> {
  const durable = await getDurableIdentityStorageStatus();
  if (durable.ready) return "prisma_identity_configured";
  if (process.env.NODE_ENV === "production") return "local_identity_forbidden_in_production";
  if (productionIdentityFallbackAllowed()) return "local_identity_development_only";
  return isDatabaseConfigured() ? "prisma_identity_unconfigured" : "local_identity_development_only";
}

export function createIdentityStorageAdapter(mode: IdentityStorageMode): IdentityStorageAdapter {
  return {
    mode,
    readMigrationSource: readLocalIdentityMigrationSource,
    async assertProductionSafe() {
      if (process.env.NODE_ENV === "production" && mode !== "prisma_identity_configured") {
        throw new Error(`identity_storage_not_production_safe:${mode}`);
      }
    },
  };
}
