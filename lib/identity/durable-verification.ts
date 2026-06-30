import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import type { VerificationClaim } from "@/lib/identity/types";

function hashEvidenceMetadata(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function oneYearFromNow() {
  return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
}

function normalizeList(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function toVerificationClaim(claim: {
  id: string;
  accountId: string;
  claimType: string;
  jurisdictionIds: string[];
  communityIds: string[];
  method: string;
  provider: string;
  status: string;
  verifiedAt: Date | null;
  expiresAt: Date | null;
  reviewerId: string | null;
  assuranceLevel: string;
  evidenceDisposition: string;
  evidenceHash: string | null;
  sensitiveAddressRef: string | null;
  rejectionReason: string | null;
  revocationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): VerificationClaim {
  return {
    id: claim.id,
    userId: claim.accountId,
    claimType: claim.claimType === "residency" ? "residency" : "voter",
    jurisdictionIds: claim.jurisdictionIds,
    communityIds: claim.communityIds,
    method: claim.method as VerificationClaim["method"],
    provider: claim.provider,
    status: claim.status as VerificationClaim["status"],
    verifiedAt: toIso(claim.verifiedAt),
    expiresAt: toIso(claim.expiresAt),
    assuranceLevel: claim.assuranceLevel as VerificationClaim["assuranceLevel"],
    reviewerId: claim.reviewerId,
    revocationReason: claim.revocationReason,
    rejectionReason: claim.rejectionReason,
    evidenceDisposition: claim.evidenceDisposition as VerificationClaim["evidenceDisposition"],
    evidenceHash: claim.evidenceHash,
    sensitiveAddressRef: claim.sensitiveAddressRef,
    reviewContext: null,
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
  };
}

export async function listDurableVerificationClaimsForAccount(accountId: string) {
  const claims = await prisma.identityVerificationClaim.findMany({
    where: { accountId },
    orderBy: { updatedAt: "desc" },
  });
  return claims.map(toVerificationClaim);
}

export async function listDurableVerificationAdminData() {
  const [claims, accounts] = await Promise.all([
    prisma.identityVerificationClaim.findMany({
      orderBy: { updatedAt: "desc" },
    }),
    prisma.identityAccount.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        emailVerificationStatus: true,
        mfaEnrollmentRequired: true,
      },
    }),
  ]);

  return {
    claims: claims.map(toVerificationClaim),
    accounts: accounts.map((account) => ({
      ...account,
      role: "citizen",
      mfaEnrollmentRequired: account.mfaEnrollmentRequired,
    })),
  };
}

async function ensureDurableResidencyFromVoterClaim(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  input: {
    accountId: string;
    reviewerId: string;
    jurisdictionIds: string[];
    sourceClaimId: string;
  },
) {
  const timestamp = new Date();
  const existingResidency = await tx.identityVerificationClaim.findFirst({
    where: {
      accountId: input.accountId,
      claimType: "residency",
      status: { in: ["pending", "needs_information", "pending_manual_review", "verified", "matched"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (existingResidency) {
    const claim = await tx.identityVerificationClaim.update({
      where: { id: existingResidency.id },
      data: {
        jurisdictionIds: input.jurisdictionIds.length ? input.jurisdictionIds : existingResidency.jurisdictionIds,
        method: "temporary_evidence",
        provider: "verified_voter_registration_residency",
        status: "verified",
        verifiedAt: timestamp,
        expiresAt: oneYearFromNow(),
        reviewedAt: timestamp,
        reviewerId: input.reviewerId,
        assuranceLevel: "high",
        evidenceDisposition: "metadata_only",
        rejectionReason: null,
        revocationReason: null,
        evidenceHash: existingResidency.evidenceHash ?? hashEvidenceMetadata(`${input.accountId}:residency-from-voter:${input.sourceClaimId}:${timestamp.toISOString()}`),
      },
    });
    await tx.identityVerificationEvent.create({
      data: {
        id: `verification_event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        verificationClaimId: claim.id,
        eventType: "verified_from_voter_registration",
        actorAccountId: input.reviewerId,
        summary: "Residency verified from approved voter-registration claim.",
        metadata: { sourceVoterClaimId: input.sourceClaimId },
      },
    });
    return claim;
  }

  const claim = await tx.identityVerificationClaim.create({
    data: {
      id: `residency_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      accountId: input.accountId,
      claimType: "residency",
      jurisdictionIds: input.jurisdictionIds.length ? input.jurisdictionIds : ["nevada"],
      communityIds: [],
      method: "temporary_evidence",
      provider: "verified_voter_registration_residency",
      status: "verified",
      verifiedAt: timestamp,
      expiresAt: oneYearFromNow(),
      reviewedAt: timestamp,
      reviewerId: input.reviewerId,
      assuranceLevel: "high",
      evidenceDisposition: "metadata_only",
      evidenceHash: hashEvidenceMetadata(`${input.accountId}:residency-from-voter:${input.sourceClaimId}:${timestamp.toISOString()}`),
      sensitiveAddressRef: null,
      rejectionReason: null,
      revocationReason: null,
    },
  });
  await tx.identityVerificationEvent.create({
    data: {
      id: `verification_event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      verificationClaimId: claim.id,
      eventType: "verified_from_voter_registration",
      actorAccountId: input.reviewerId,
      summary: "Residency verified from approved voter-registration claim.",
      metadata: { sourceVoterClaimId: input.sourceClaimId },
    },
  });
  return claim;
}

export async function reviewDurableResidencyClaim(input: {
  claimId: string;
  reviewerId: string;
  decision: "approve" | "reject";
  reviewerNotes?: string | null;
}) {
  const existing = await prisma.identityVerificationClaim.findFirst({
    where: { id: input.claimId, claimType: "residency" },
  });
  if (!existing) return { ok: false as const, reason: "claim_not_found" as const };

  const timestamp = new Date();
  const claim = await prisma.$transaction(async (tx) => {
    const updated = await tx.identityVerificationClaim.update({
      where: { id: input.claimId },
      data: {
        status: input.decision === "approve" ? "verified" : "rejected",
        verifiedAt: input.decision === "approve" ? timestamp : null,
        expiresAt: input.decision === "approve" ? oneYearFromNow() : null,
        reviewedAt: timestamp,
        reviewerId: input.reviewerId,
        assuranceLevel: input.decision === "approve" ? "medium" : "none",
        rejectionReason: input.decision === "reject" ? input.reviewerNotes?.trim() || "Manual residency review rejected." : null,
        revocationReason: null,
      },
    });
    await tx.identityVerificationReview.create({
      data: {
        id: `verification_review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        verificationClaimId: updated.id,
        reviewerAccountId: input.reviewerId,
        decision: input.decision,
        notes: input.reviewerNotes?.trim() || null,
      },
    });
    return updated;
  });

  return { ok: true as const, claim: toVerificationClaim(claim) };
}

export async function reviewDurableVoterClaim(input: {
  claimId: string;
  reviewerId: string;
  decision: "approve" | "reject" | "request_more_info";
  reviewerNotes?: string | null;
}) {
  const existing = await prisma.identityVerificationClaim.findFirst({
    where: { id: input.claimId, claimType: "voter" },
  });
  if (!existing) return { ok: false as const, reason: "claim_not_found" as const };

  const timestamp = new Date();
  const claim = await prisma.$transaction(async (tx) => {
    const status = input.decision === "approve" ? "matched" : input.decision === "request_more_info" ? "needs_information" : "rejected";
    const updated = await tx.identityVerificationClaim.update({
      where: { id: input.claimId },
      data: {
        status,
        verifiedAt: input.decision === "approve" ? timestamp : null,
        expiresAt: input.decision === "approve" ? oneYearFromNow() : null,
        reviewedAt: timestamp,
        reviewerId: input.reviewerId,
        assuranceLevel: input.decision === "approve" ? "high" : "none",
        rejectionReason:
          input.decision === "reject"
            ? input.reviewerNotes?.trim() || "Guided voter portal review rejected."
            : input.decision === "request_more_info"
              ? input.reviewerNotes?.trim() || "Reviewer requested more information before voter verification can continue."
              : null,
        revocationReason: null,
      },
    });
    await tx.identityVerificationReview.create({
      data: {
        id: `verification_review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        verificationClaimId: updated.id,
        reviewerAccountId: input.reviewerId,
        decision: input.decision,
        notes: input.reviewerNotes?.trim() || null,
      },
    });
    if (input.decision === "approve") {
      await ensureDurableResidencyFromVoterClaim(tx, {
        accountId: updated.accountId,
        reviewerId: input.reviewerId,
        jurisdictionIds: updated.jurisdictionIds,
        sourceClaimId: updated.id,
      });
    }
    return updated;
  });

  return { ok: true as const, claim: toVerificationClaim(claim) };
}

export async function createDurableGuidedVoterPortalClaim(input: {
  accountId: string;
  jurisdictionIds: string[];
  countyOrJurisdiction: string;
  countyVoterId: string;
  electionPrecinct: string;
  portalResultSummary: string;
}) {
  const timestamp = new Date();
  const id = `voter_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const evidenceHash = hashEvidenceMetadata(
    `${input.accountId}:nevada-voter-portal:${input.countyOrJurisdiction}:${input.countyVoterId}:${input.electionPrecinct}:${input.portalResultSummary}:${timestamp.toISOString()}`,
  );

  return prisma.$transaction(async (tx) => {
    const claim = await tx.identityVerificationClaim.create({
      data: {
        id,
        accountId: input.accountId,
        claimType: "voter",
        jurisdictionIds: normalizeList(input.jurisdictionIds),
        communityIds: [],
        method: "temporary_evidence",
        provider: "nevada_voter_search_user_confirmed",
        status: "pending_manual_review",
        verifiedAt: null,
        expiresAt: null,
        reviewerId: null,
        assuranceLevel: "none",
        evidenceDisposition: "metadata_only",
        evidenceHash,
        sensitiveAddressRef: hashEvidenceMetadata(`${input.accountId}:voter-portal:${input.countyOrJurisdiction}:${input.countyVoterId}:${input.electionPrecinct}`),
        rejectionReason: null,
        revocationReason: null,
      },
    });
    await tx.identityVerificationEvent.create({
      data: {
        id: `verification_event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        verificationClaimId: claim.id,
        eventType: "submitted",
        actorAccountId: input.accountId,
        summary: "Guided voter portal verification submitted for review.",
        metadata: {
          source: "official_nevada_voter_search_guided_review",
          countyOrJurisdiction: input.countyOrJurisdiction,
          electionPrecinct: input.electionPrecinct,
          countyVoterIdLast4: input.countyVoterId.slice(-4),
        },
      },
    });
    await ensureDurableResidencyFromVoterClaim(tx, {
      accountId: input.accountId,
      reviewerId: "automated_voter_file_provider",
      jurisdictionIds: input.jurisdictionIds,
      sourceClaimId: claim.id,
    });
    return toVerificationClaim(claim);
  });
}

export async function createDurableAutomatedVoterFileMatchClaim(input: {
  accountId: string;
  jurisdictionIds: string[];
  countyOrJurisdiction: string;
  countyVoterId: string;
  electionPrecinct: string;
  providerId: string;
  sourceHash: string | null;
}) {
  const timestamp = new Date();
  const id = `voter_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const evidenceHash = hashEvidenceMetadata(
    `${input.accountId}:automated-voter-file:${input.providerId}:${input.sourceHash ?? "no-source-hash"}:${input.countyVoterId}:${input.electionPrecinct}:${timestamp.toISOString()}`,
  );

  return prisma.$transaction(async (tx) => {
    const claim = await tx.identityVerificationClaim.create({
      data: {
        id,
        accountId: input.accountId,
        claimType: "voter",
        jurisdictionIds: normalizeList(input.jurisdictionIds),
        communityIds: [],
        method: "temporary_evidence",
        provider: input.providerId,
        status: "matched",
        verifiedAt: timestamp,
        expiresAt: oneYearFromNow(),
        reviewerId: "automated_voter_file_provider",
        assuranceLevel: "high",
        evidenceDisposition: "metadata_only",
        evidenceHash,
        sensitiveAddressRef: hashEvidenceMetadata(`${input.accountId}:automated-voter-file:${input.countyOrJurisdiction}:${input.countyVoterId}:${input.electionPrecinct}`),
        rejectionReason: null,
        revocationReason: null,
      },
    });
    await tx.identityVerificationEvent.create({
      data: {
        id: `verification_event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        verificationClaimId: claim.id,
        eventType: "auto_matched",
        actorAccountId: "automated_voter_file_provider",
        summary: "Voter verification matched by official voter-file provider.",
        metadata: {
          providerId: input.providerId,
          sourceHash: input.sourceHash,
          countyOrJurisdiction: input.countyOrJurisdiction,
          electionPrecinct: input.electionPrecinct,
          countyVoterIdLast4: input.countyVoterId.slice(-4),
        },
      },
    });
    return toVerificationClaim(claim);
  });
}
