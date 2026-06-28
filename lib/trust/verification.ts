import type { CivicClaim } from "@/lib/trust/claims";
import { createDurableClaim } from "@/lib/trust/claims";

export type VerificationFlowType = "residency_verification" | "voter_registration_verification" | "organization_affiliation_verification" | "trust_review";
export type VerificationFlowStatus = "not_started" | "pending_evidence" | "in_review" | "verified" | "rejected" | "expired";

export type VerificationFlow = {
  id: string;
  userId: string;
  type: VerificationFlowType;
  status: VerificationFlowStatus;
  requiredEvidence: string[];
  sensitiveEvidenceRetained: boolean;
  evidenceDeletionRequired: boolean;
  createdAt: string;
  reviewedAt: string | null;
  resultingClaimIds: string[];
};

export function createVerificationFlow(userId: string, type: VerificationFlowType, createdAt = new Date().toISOString()): VerificationFlow {
  const requiredEvidence =
    type === "residency_verification"
      ? ["residency_signal"]
      : type === "voter_registration_verification"
        ? ["residency_claim", "voter_registration_match"]
        : type === "organization_affiliation_verification"
          ? ["organization_affiliation_signal"]
          : ["trusted_activity_review"];
  return {
    id: `verification-${userId}-${type}-${createdAt.slice(0, 10)}`,
    userId,
    type,
    status: "pending_evidence",
    requiredEvidence,
    sensitiveEvidenceRetained: false,
    evidenceDeletionRequired: true,
    createdAt,
    reviewedAt: null,
    resultingClaimIds: [],
  };
}

export function issueVerificationClaim(flow: VerificationFlow, value: string, reviewedAt = new Date().toISOString()): { flow: VerificationFlow; claim: CivicClaim } {
  const domain = flow.type === "voter_registration_verification" ? "voter" : flow.type === "residency_verification" ? "residency" : flow.type === "organization_affiliation_verification" ? "organization" : "trust";
  const claim = createDurableClaim({
    userId: flow.userId,
    domain,
    type: flow.type,
    value,
    status: "verified",
    privacy: domain === "organization" || domain === "trust" ? "public_opt_in" : "aggregate_only",
    expiresAt: null,
    verificationMethod: flow.type,
    reviewerId: null,
    notes: "Durable claim issued; sensitive source evidence should be removed when feasible.",
    issuedAt: reviewedAt,
  });
  return {
    claim,
    flow: {
      ...flow,
      status: "verified",
      reviewedAt,
      sensitiveEvidenceRetained: false,
      evidenceDeletionRequired: true,
      resultingClaimIds: [...flow.resultingClaimIds, claim.id],
    },
  };
}
