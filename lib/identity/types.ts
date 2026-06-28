import type { UserRole } from "@/types/domain";

export type AccountStatus = "active" | "disabled" | "locked" | "pending_recovery";
export type EmailVerificationStatus = "unverified" | "verified";
export type VerificationStatus =
  | "not_started"
  | "pending"
  | "needs_information"
  | "pending_manual_review"
  | "verified"
  | "rejected"
  | "expired"
  | "revoked"
  | "address_changed"
  | "reverify_required"
  | "provider_unconfigured"
  | "matched"
  | "no_match"
  | "ambiguous_match"
  | "source_unavailable";
export type VerificationMethod = "manual_admin_review" | "development_test_provider" | "provider_unconfigured" | "temporary_evidence";
export type ConsentStatus = "granted" | "withdrawn";
export type ClaimStatus = "self_declared" | "verified" | "disputed" | "expired" | "revoked" | "unknown";
export type PrivacyVisibility = "private" | "aggregate_only" | "public";
export type TrustedCitizenGrantStatus = "pending_review" | "active" | "suspended" | "revoked" | "expired";
export type PrivacyRequestStatus = "pending" | "in_review" | "fulfilled" | "rejected";
export type SecurityEventType =
  | "account_created"
  | "admin_bootstrap"
  | "password_changed"
  | "password_reset_requested"
  | "password_reset_completed"
  | "login_succeeded"
  | "login_failed"
  | "session_revoked"
  | "account_disabled"
  | "sensitive_access"
  | "verification_status_changed"
  | "consent_changed"
  | "mfa_enrollment_started"
  | "mfa_enrollment_completed"
  | "mfa_challenge_failed"
  | "mfa_challenge_succeeded"
  | "mfa_reset"
  | "email_changed";

export type PasswordHash = {
  algorithm: "scrypt";
  salt: string;
  hash: string;
  keyLength: number;
  cost: "node_crypto_scrypt";
  createdAt: string;
};

export type IdentityAccount = {
  id: string;
  email: string;
  name: string;
  username: string;
  role: UserRole;
  status: AccountStatus;
  emailVerificationStatus: EmailVerificationStatus;
  passwordHash: PasswordHash;
  mustChangePassword: boolean;
  mfaEnrollmentRequired: boolean;
  mfaEnrolledAt?: string | null;
  mfaEnabled?: boolean;
  mfaEncryptedSecret?: string | null;
  mfaPendingEnrollment?: {
    encryptedSecret: string;
    createdAt: string;
    expiresAt: string;
    failedAttempts: number;
  } | null;
  mfaRecoveryCodes?: Array<{
    id: string;
    codeHash: string;
    createdAt: string;
    usedAt: string | null;
  }>;
  mfaLastAcceptedCounterHash?: string | null;
  mfaFailedAttempts?: number;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  disabledAt: string | null;
};

export type IdentitySession = {
  id: string;
  userId: string;
  createdAt: string;
  revokedAt: string | null;
  reason: string | null;
  mfaVerifiedAt?: string | null;
};

export type PermissionGrant = {
  id: string;
  userId: string;
  permission: string;
  grantedBy: string;
  grantedAt: string;
  revokedAt: string | null;
};

export type VerificationClaim = {
  id: string;
  userId: string;
  claimType: "residency" | "voter";
  jurisdictionIds: string[];
  communityIds: string[];
  method: VerificationMethod;
  provider: string;
  status: VerificationStatus;
  verifiedAt: string | null;
  expiresAt: string | null;
  assuranceLevel: "none" | "low" | "medium" | "high";
  reviewerId: string | null;
  revocationReason: string | null;
  rejectionReason: string | null;
  evidenceDisposition: "none" | "metadata_only" | "temporary_encrypted_pending_purge" | "purged";
  evidenceHash: string | null;
  sensitiveAddressRef: string | null;
  reviewContext?: {
    officialSourceUrl?: string | null;
    countyOrJurisdiction?: string | null;
    electionPrecinct?: string | null;
    countyVoterIdLast4?: string | null;
    submittedFields?: string[];
    verificationAssistant?: {
      version: string;
      mode: "deterministic_source_triage";
      outcome:
        | "auto_matched_source_file"
        | "ready_for_fast_review"
        | "source_unavailable_guided_review"
        | "source_mismatch_needs_review"
        | "needs_more_information";
      confidence: "high" | "medium" | "low";
      recommendedAction: "auto_verified" | "approve_if_attestation_and_source_confirmed" | "request_more_information" | "review_source_mismatch";
      sourceAvailability: "indexed_private_voter_file" | "official_portal_user_guided" | "source_unavailable";
      extractedSignals: string[];
      missingSignals: string[];
      reviewReasons: string[];
      countyIndexed: boolean;
      sourceBackedDecision: boolean;
    } | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfileClaim = {
  id: string;
  userId: string;
  category: "stakeholder" | "demographic" | "political_affiliation" | "identity";
  claimKey: string;
  status: ClaimStatus;
  visibility: PrivacyVisibility;
  consentId: string | null;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
};

export type OrganizationAffiliation = {
  id: string;
  userId: string;
  organizationName: string;
  relationship: "member" | "officer" | "employee" | "volunteer" | "board_member" | "representative";
  status: ClaimStatus;
  visibility: PrivacyVisibility;
  authorizedToSpeakForOrganization: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ConsentRecord = {
  id: string;
  userId: string;
  consentType:
    | "residency_verification"
    | "voter_registration_validation"
    | "temporary_evidence_processing"
    | "optional_demographic_analytics"
    | "optional_political_affiliation_analytics"
    | "organization_affiliation_analytics"
    | "personalization"
    | "public_profile_visibility";
  policyVersion: string;
  status: ConsentStatus;
  grantedAt: string | null;
  withdrawnAt: string | null;
  collectionContext: string;
};

export type TrustedCitizenGrant = {
  id: string;
  userId: string;
  status: TrustedCitizenGrantStatus;
  capabilities: string[];
  grantReason: string;
  grantedBy: string;
  grantedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  suspendedAt: string | null;
  reviewNotes: string | null;
};

export type SecurityEvent = {
  id: string;
  type: SecurityEventType;
  userId: string | null;
  actorUserId: string | null;
  createdAt: string;
  summary: string;
  metadata: Record<string, string | number | boolean | null>;
};

export type PrivacyRequest = {
  id: string;
  userId: string;
  requestType: "export" | "deletion" | "consent_withdrawal" | "appeal";
  status: PrivacyRequestStatus;
  createdAt: string;
  completedAt: string | null;
};

export type VerificationEvidenceRecord = {
  id: string;
  claimId: string;
  userId: string;
  storageAdapter: "local_encrypted_development" | "provider_unconfigured";
  encrypted: boolean;
  sourceFileRetained: boolean;
  metadataHash: string;
  purgeAfter: string;
  purgedAt: string | null;
  createdAt: string;
};

export type IdentityStore = {
  version: 1;
  generatedAt: string;
  accounts: IdentityAccount[];
  sessions: IdentitySession[];
  permissionGrants: PermissionGrant[];
  verificationClaims: VerificationClaim[];
  profileClaims: ProfileClaim[];
  organizationAffiliations: OrganizationAffiliation[];
  consentRecords: ConsentRecord[];
  trustedCitizenGrants: TrustedCitizenGrant[];
  securityEvents: SecurityEvent[];
  privacyRequests: PrivacyRequest[];
  verificationEvidence: VerificationEvidenceRecord[];
};
