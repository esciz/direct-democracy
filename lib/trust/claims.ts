export type ClaimDomain = "identity" | "residency" | "voter" | "stakeholder" | "organization" | "trust" | "demographic";
export type ClaimVerificationStatus = "self_declared" | "verified" | "unknown" | "rejected" | "expired";
export type ClaimPrivacy = "private" | "public_opt_in" | "aggregate_only";

export type CivicClaim = {
  id: string;
  userId: string;
  domain: ClaimDomain;
  type: string;
  value: string;
  status: ClaimVerificationStatus;
  privacy: ClaimPrivacy;
  issuedAt: string;
  expiresAt: string | null;
  sourceEvidenceRetained: boolean;
  evidenceRetentionPolicy: "remove_after_claim" | "retain_public_source_reference" | "retain_until_review_complete" | "none";
  verificationMethod: string | null;
  reviewerId: string | null;
  notes: string | null;
};

export const STAKEHOLDER_CLAIM_TYPES = ["parent", "homeowner", "renter", "veteran", "educator", "student", "retiree", "business_owner"] as const;
export const ORGANIZATION_CLAIM_TYPES = ["pta", "hoa", "chamber_of_commerce", "union", "nonprofit", "civic_organization", "neighborhood_group"] as const;

export function createDurableClaim(input: Omit<CivicClaim, "id" | "issuedAt" | "sourceEvidenceRetained" | "evidenceRetentionPolicy"> & { issuedAt?: string; retainEvidence?: boolean }): CivicClaim {
  const issuedAt = input.issuedAt ?? new Date().toISOString();
  return {
    ...input,
    id: `claim-${input.userId}-${input.domain}-${input.type}-${issuedAt.slice(0, 10)}`.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase(),
    issuedAt,
    sourceEvidenceRetained: input.retainEvidence ?? false,
    evidenceRetentionPolicy: input.retainEvidence ? "retain_until_review_complete" : "remove_after_claim",
  };
}

export function claimsSupportSegment(claims: CivicClaim[], domain: ClaimDomain, type?: string) {
  return claims.some((claim) => claim.domain === domain && (!type || claim.type === type) && claim.status === "verified");
}
