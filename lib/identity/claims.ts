import { readIdentityStore, writeIdentityStore } from "@/lib/identity/storage";
import type { ConsentRecord, OrganizationAffiliation, ProfileClaim, TrustedCitizenGrant } from "@/lib/identity/types";

export const OPTIONAL_PROFILE_POLICY_VERSION = "optional-profile-policy-v1";

export function grantConsent(userId: string, consentType: ConsentRecord["consentType"], collectionContext: string) {
  const store = readIdentityStore();
  const timestamp = new Date().toISOString();
  const consent: ConsentRecord = {
    id: `consent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    consentType,
    policyVersion: OPTIONAL_PROFILE_POLICY_VERSION,
    status: "granted",
    grantedAt: timestamp,
    withdrawnAt: null,
    collectionContext,
  };
  store.consentRecords.unshift(consent);
  writeIdentityStore(store);
  return consent;
}

export function addOptionalProfileClaim(input: Pick<ProfileClaim, "userId" | "category" | "claimKey"> & Partial<Pick<ProfileClaim, "visibility" | "status" | "consentId">>) {
  const store = readIdentityStore();
  const timestamp = new Date().toISOString();
  const claim: ProfileClaim = {
    id: `profile_claim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    category: input.category,
    claimKey: input.claimKey,
    status: input.status ?? "self_declared",
    visibility: input.visibility ?? "private",
    consentId: input.consentId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
    revokedAt: null,
  };
  store.profileClaims.unshift(claim);
  writeIdentityStore(store);
  return claim;
}

export function addOrganizationAffiliation(input: Pick<OrganizationAffiliation, "userId" | "organizationName" | "relationship"> & Partial<Pick<OrganizationAffiliation, "visibility" | "status" | "authorizedToSpeakForOrganization">>) {
  const store = readIdentityStore();
  const timestamp = new Date().toISOString();
  const affiliation: OrganizationAffiliation = {
    id: `org_affiliation_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    organizationName: input.organizationName,
    relationship: input.relationship,
    status: input.status ?? "self_declared",
    visibility: input.visibility ?? "private",
    authorizedToSpeakForOrganization: input.authorizedToSpeakForOrganization ?? false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.organizationAffiliations.unshift(affiliation);
  writeIdentityStore(store);
  return affiliation;
}

export function addTrustedCitizenGrant(input: Pick<TrustedCitizenGrant, "userId" | "capabilities" | "grantReason" | "grantedBy"> & Partial<Pick<TrustedCitizenGrant, "status" | "expiresAt" | "reviewNotes">>) {
  const store = readIdentityStore();
  const timestamp = new Date().toISOString();
  const grant: TrustedCitizenGrant = {
    id: `trusted_grant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    status: input.status ?? "active",
    capabilities: input.capabilities,
    grantReason: input.grantReason,
    grantedBy: input.grantedBy,
    grantedAt: timestamp,
    expiresAt: input.expiresAt ?? null,
    revokedAt: null,
    suspendedAt: null,
    reviewNotes: input.reviewNotes ?? null,
  };
  store.trustedCitizenGrants.unshift(grant);
  writeIdentityStore(store);
  return grant;
}
