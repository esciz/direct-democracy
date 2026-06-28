import { createHash } from "node:crypto";

import { createSecurityEvent, readIdentityStore, writeIdentityStore } from "@/lib/identity/storage";
import type { VerificationClaim, VerificationStatus } from "@/lib/identity/types";
import { buildVoterVerificationAssistantPacket, type VoterVerificationAssistantPacket } from "@/lib/identity/voter-verification-assistant";

export const RESIDENCY_PROVIDER_STATUS = "provider_unconfigured";
export const VOTER_PROVIDER_STATUS = "provider_unconfigured";

function hashEvidenceMetadata(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function oneYearFromNow() {
  return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeList(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
}

function lastFour(value: string) {
  const normalized = value.trim().replace(/\s+/g, "");
  return normalized.slice(-4) || null;
}

export function createResidencyClaim(input: {
  userId: string;
  jurisdictionIds: string[];
  communityIds?: string[];
  method?: VerificationClaim["method"];
  status?: VerificationStatus;
  reviewerId?: string | null;
}) {
  const store = readIdentityStore();
  const timestamp = new Date().toISOString();
  const claim: VerificationClaim = {
    id: `residency_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    claimType: "residency",
    jurisdictionIds: input.jurisdictionIds,
    communityIds: input.communityIds ?? [],
    method: input.method ?? "provider_unconfigured",
    provider: input.method === "manual_admin_review" ? "authorized_manual_admin_review" : RESIDENCY_PROVIDER_STATUS,
    status: input.status ?? "provider_unconfigured",
    verifiedAt: input.status === "verified" ? timestamp : null,
    expiresAt: input.status === "verified" ? oneYearFromNow() : null,
    assuranceLevel: input.status === "verified" ? "medium" : "none",
    reviewerId: input.reviewerId ?? null,
    revocationReason: null,
    rejectionReason: null,
    evidenceDisposition: "metadata_only",
    evidenceHash: hashEvidenceMetadata(`${input.userId}:${input.jurisdictionIds.join(",")}:${timestamp}`),
    sensitiveAddressRef: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.verificationClaims.unshift(claim);
  writeIdentityStore(store);
  createSecurityEvent("verification_status_changed", "Residency verification claim created.", { userId: input.userId, actorUserId: input.reviewerId ?? null, metadata: { status: claim.status } });
  return claim;
}

export function requestResidencyManualReview(input: {
  userId: string;
  jurisdictionIds: string[];
  communityIds?: string[];
  residencyArea: string;
  evidenceDescription?: string | null;
  attestationAccepted: boolean;
}) {
  if (!input.attestationAccepted) {
    throw new Error("attestation_required");
  }

  const store = readIdentityStore();
  const timestamp = new Date().toISOString();
  const jurisdictionIds = normalizeList(input.jurisdictionIds);
  const communityIds = normalizeList(input.communityIds ?? []);
  const evidenceSummary = input.evidenceDescription?.trim() || "No evidence description provided.";
  const residencyArea = input.residencyArea.trim();
  const metadataHash = hashEvidenceMetadata(`${input.userId}:${jurisdictionIds.join(",")}:${communityIds.join(",")}:${residencyArea}:${evidenceSummary}:${timestamp}`);
  const claim: VerificationClaim = {
    id: `residency_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    claimType: "residency",
    jurisdictionIds,
    communityIds,
    method: "manual_admin_review",
    provider: "authorized_manual_admin_review",
    status: "pending_manual_review",
    verifiedAt: null,
    expiresAt: null,
    assuranceLevel: "none",
    reviewerId: null,
    revocationReason: null,
    rejectionReason: null,
    evidenceDisposition: "metadata_only",
    evidenceHash: metadataHash,
    sensitiveAddressRef: hashEvidenceMetadata(`${input.userId}:residency-area:${residencyArea}`),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.verificationClaims.unshift(claim);
  store.consentRecords.unshift({
    id: `consent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    consentType: "residency_verification",
    policyVersion: "manual-residency-review-v1",
    status: "granted",
    grantedAt: timestamp,
    withdrawnAt: null,
    collectionContext: "account_residency_verification_request",
  });
  writeIdentityStore(store);
  createSecurityEvent("verification_status_changed", "Residency verification submitted for manual review.", {
    userId: input.userId,
    metadata: { status: claim.status, evidenceDisposition: claim.evidenceDisposition },
  });
  return claim;
}

export function reviewResidencyClaim(input: {
  claimId: string;
  reviewerId: string;
  decision: "approve" | "reject";
  reviewerNotes?: string | null;
}) {
  const store = readIdentityStore();
  const claim = store.verificationClaims.find((entry) => entry.id === input.claimId && entry.claimType === "residency");
  if (!claim) {
    return { ok: false as const, reason: "claim_not_found" as const };
  }

  const timestamp = new Date().toISOString();
  claim.status = input.decision === "approve" ? "verified" : "rejected";
  claim.verifiedAt = input.decision === "approve" ? timestamp : null;
  claim.expiresAt = input.decision === "approve" ? oneYearFromNow() : null;
  claim.assuranceLevel = input.decision === "approve" ? "medium" : "none";
  claim.reviewerId = input.reviewerId;
  claim.rejectionReason = input.decision === "reject" ? input.reviewerNotes?.trim() || "Manual residency review rejected." : null;
  claim.revocationReason = null;
  claim.updatedAt = timestamp;
  writeIdentityStore(store);
  createSecurityEvent("verification_status_changed", "Residency verification reviewed.", {
    userId: claim.userId,
    actorUserId: input.reviewerId,
    metadata: { status: claim.status, claimId: claim.id },
  });
  return { ok: true as const, claim };
}

export function createVoterClaim(input: {
  userId: string;
  jurisdictionIds: string[];
  method?: VerificationClaim["method"];
  status?: VerificationStatus;
  reviewerId?: string | null;
}) {
  const store = readIdentityStore();
  const hasActiveResidency = store.verificationClaims.some((claim) => claim.userId === input.userId && claim.claimType === "residency" && claim.status === "verified");
  const timestamp = new Date().toISOString();
  const claim: VerificationClaim = {
    id: `voter_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    claimType: "voter",
    jurisdictionIds: input.jurisdictionIds,
    communityIds: [],
    method: input.method ?? "provider_unconfigured",
    provider: input.method === "manual_admin_review" ? "authorized_manual_admin_review" : VOTER_PROVIDER_STATUS,
    status: hasActiveResidency ? input.status ?? "provider_unconfigured" : "needs_information",
    verifiedAt: input.status === "matched" && hasActiveResidency ? timestamp : null,
    expiresAt: input.status === "matched" && hasActiveResidency ? oneYearFromNow() : null,
    assuranceLevel: input.status === "matched" && hasActiveResidency ? "medium" : "none",
    reviewerId: input.reviewerId ?? null,
    revocationReason: null,
    rejectionReason: hasActiveResidency ? null : "Verified Resident claim required before voter validation.",
    evidenceDisposition: "metadata_only",
    evidenceHash: hashEvidenceMetadata(`${input.userId}:voter:${timestamp}`),
    sensitiveAddressRef: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.verificationClaims.unshift(claim);
  writeIdentityStore(store);
  createSecurityEvent("verification_status_changed", "Voter verification claim created.", { userId: input.userId, actorUserId: input.reviewerId ?? null, metadata: { status: claim.status } });
  return claim;
}

export function requestGuidedVoterPortalReview(input: {
  userId: string;
  jurisdictionIds: string[];
  countyOrJurisdiction: string;
  countyVoterId: string;
  electionPrecinct: string;
  registeredFirstName?: string;
  registeredLastName?: string;
  portalResultSummary: string;
  attestationAccepted: boolean;
  assistantPacket?: VoterVerificationAssistantPacket | null;
}) {
  if (!input.attestationAccepted) {
    throw new Error("attestation_required");
  }

  const store = readIdentityStore();
  const timestamp = new Date().toISOString();
  const jurisdictionIds = normalizeList(input.jurisdictionIds);
  const countyOrJurisdiction = input.countyOrJurisdiction.trim();
  const countyVoterId = input.countyVoterId.trim();
  const electionPrecinct = input.electionPrecinct.trim();
  const portalResultSummary = input.portalResultSummary.trim();
  const assistantPacket =
    input.assistantPacket ??
    buildVoterVerificationAssistantPacket({
      countyOrJurisdiction,
      countyVoterId,
      electionPrecinct,
      registeredFirstName: input.registeredFirstName ?? "",
      registeredLastName: input.registeredLastName ?? "",
      portalResultSummary,
      fileMatchMatched: false,
    });
  const evidenceHash = hashEvidenceMetadata(`${input.userId}:nevada-voter-portal:${countyOrJurisdiction}:${countyVoterId}:${electionPrecinct}:${portalResultSummary}:${timestamp}`);
  const claim: VerificationClaim = {
    id: `voter_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    claimType: "voter",
    jurisdictionIds,
    communityIds: [],
    method: "temporary_evidence",
    provider: "nevada_voter_search_user_confirmed",
    status: "pending_manual_review",
    verifiedAt: null,
    expiresAt: null,
    assuranceLevel: "none",
    reviewerId: null,
    revocationReason: null,
    rejectionReason: null,
    evidenceDisposition: "metadata_only",
    evidenceHash,
    sensitiveAddressRef: hashEvidenceMetadata(`${input.userId}:voter-portal:${countyOrJurisdiction}:${countyVoterId}:${electionPrecinct}`),
    reviewContext: {
      officialSourceUrl: "https://www.nvsos.gov/votersearch/",
      countyOrJurisdiction,
      electionPrecinct,
      countyVoterIdLast4: lastFour(countyVoterId),
      submittedFields: ["county_voter_id_hash", "county_voter_id_last4", "election_precinct", "county_or_jurisdiction", "portal_result_summary_hash"],
      verificationAssistant: assistantPacket,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.verificationClaims.unshift(claim);
  store.consentRecords.unshift({
    id: `consent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    consentType: "voter_registration_validation",
    policyVersion: "guided-voter-portal-review-v1",
    status: "granted",
    grantedAt: timestamp,
    withdrawnAt: null,
    collectionContext: "official_nevada_voter_search_guided_review",
  });
  writeIdentityStore(store);
  createSecurityEvent("verification_status_changed", "Guided voter portal verification submitted for review.", {
    userId: input.userId,
    metadata: { status: claim.status, provider: claim.provider, assistantOutcome: assistantPacket.outcome },
  });
  return claim;
}

export function createAutomatedVoterFileMatchClaim(input: {
  userId: string;
  jurisdictionIds: string[];
  countyOrJurisdiction: string;
  countyVoterId: string;
  electionPrecinct: string;
  registeredFirstName?: string;
  registeredLastName?: string;
  providerId: string;
  sourceHash: string | null;
  dateOfRecord: string | null;
}) {
  const store = readIdentityStore();
  const timestamp = new Date().toISOString();
  const countyOrJurisdiction = input.countyOrJurisdiction.trim();
  const countyVoterId = input.countyVoterId.trim();
  const electionPrecinct = input.electionPrecinct.trim();
  const claim: VerificationClaim = {
    id: `voter_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    claimType: "voter",
    jurisdictionIds: normalizeList(input.jurisdictionIds),
    communityIds: [],
    method: "temporary_evidence",
    provider: input.providerId,
    status: "matched",
    verifiedAt: timestamp,
    expiresAt: oneYearFromNow(),
    assuranceLevel: "high",
    reviewerId: "automated_voter_file_provider",
    revocationReason: null,
    rejectionReason: null,
    evidenceDisposition: "metadata_only",
    evidenceHash: hashEvidenceMetadata(`${input.userId}:automated-voter-file:${input.providerId}:${input.sourceHash ?? "no-source-hash"}:${countyVoterId}:${electionPrecinct}:${timestamp}`),
    sensitiveAddressRef: hashEvidenceMetadata(`${input.userId}:automated-voter-file:${countyOrJurisdiction}:${countyVoterId}:${electionPrecinct}`),
    reviewContext: {
      officialSourceUrl: input.providerId === "clark_county_active_voter_file" ? "https://www.clarkcountynv.gov/government/departments/elections/reports_data_maps/voter-list-data-files" : "https://www.washoecounty.gov/voters/data/data%20transparency.php",
      countyOrJurisdiction,
      electionPrecinct,
      countyVoterIdLast4: lastFour(countyVoterId),
      submittedFields: ["county_voter_id_hash", "county_voter_id_last4", "election_precinct", "county_or_jurisdiction", "official_voter_file_hash"],
      verificationAssistant: buildVoterVerificationAssistantPacket({
        countyOrJurisdiction,
        countyVoterId,
        electionPrecinct,
        registeredFirstName: input.registeredFirstName ?? "",
        registeredLastName: input.registeredLastName ?? "",
        portalResultSummary: "Matched imported official voter-file record.",
        fileMatchMatched: true,
      }),
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.verificationClaims.unshift(claim);
  store.consentRecords.unshift({
    id: `consent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    consentType: "voter_registration_validation",
    policyVersion: "automated-voter-file-provider-v1",
    status: "granted",
    grantedAt: timestamp,
    withdrawnAt: null,
    collectionContext: "official_voter_file_automated_match",
  });
  writeIdentityStore(store);
  createSecurityEvent("verification_status_changed", "Voter verification matched by official voter-file provider.", {
    userId: input.userId,
    actorUserId: "automated_voter_file_provider",
    metadata: { status: claim.status, provider: claim.provider, dateOfRecord: input.dateOfRecord },
  });
  return claim;
}

export function reviewVoterClaim(input: {
  claimId: string;
  reviewerId: string;
  decision: "approve" | "reject" | "request_more_info";
  reviewerNotes?: string | null;
}) {
  const store = readIdentityStore();
  const claim = store.verificationClaims.find((entry) => entry.id === input.claimId && entry.claimType === "voter");
  if (!claim) {
    return { ok: false as const, reason: "claim_not_found" as const };
  }

  const timestamp = new Date().toISOString();
  claim.status = input.decision === "approve" ? "matched" : input.decision === "request_more_info" ? "needs_information" : "rejected";
  claim.verifiedAt = input.decision === "approve" ? timestamp : null;
  claim.expiresAt = input.decision === "approve" ? oneYearFromNow() : null;
  claim.assuranceLevel = input.decision === "approve" ? "high" : "none";
  claim.reviewerId = input.reviewerId;
  claim.rejectionReason =
    input.decision === "reject"
      ? input.reviewerNotes?.trim() || "Guided voter portal review rejected."
      : input.decision === "request_more_info"
        ? input.reviewerNotes?.trim() || "Reviewer requested more information before voter verification can continue."
        : null;
  claim.revocationReason = null;
  claim.updatedAt = timestamp;
  writeIdentityStore(store);
  createSecurityEvent("verification_status_changed", "Voter verification reviewed.", {
    userId: claim.userId,
    actorUserId: input.reviewerId,
    metadata: { status: claim.status, claimId: claim.id },
  });
  return { ok: true as const, claim };
}
