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
