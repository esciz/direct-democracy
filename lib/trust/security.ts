export type SecurityControlId =
  | "mfa_foundation"
  | "rbac"
  | "audit_logging"
  | "session_management"
  | "suspicious_login_detection"
  | "anti_brigading"
  | "duplicate_account_detection"
  | "verification_data_separation";

export type SecurityControl = {
  id: SecurityControlId;
  label: string;
  status: "foundation_defined" | "implemented" | "blocked";
  purpose: string;
  publicParticipationImpact: "none" | "protective";
};

export const SECURITY_CONTROLS: SecurityControl[] = [
  { id: "mfa_foundation", label: "MFA Foundation", status: "foundation_defined", purpose: "Allow high-risk role and verification workflows to require a second factor later.", publicParticipationImpact: "protective" },
  { id: "rbac", label: "RBAC", status: "foundation_defined", purpose: "Separate public, verified participant, government, and admin capabilities.", publicParticipationImpact: "protective" },
  { id: "audit_logging", label: "Audit Logging", status: "foundation_defined", purpose: "Record sensitive verification, moderation, admin, and source-ingestion events.", publicParticipationImpact: "protective" },
  { id: "session_management", label: "Session Management", status: "foundation_defined", purpose: "Support future session revocation, device review, and sensitive-action prompts.", publicParticipationImpact: "protective" },
  { id: "suspicious_login_detection", label: "Suspicious Login Detection", status: "foundation_defined", purpose: "Flag anomalous login and verification attempts without exposing private details.", publicParticipationImpact: "protective" },
  { id: "anti_brigading", label: "Anti-Brigading Framework", status: "foundation_defined", purpose: "Detect coordinated manipulation while preserving equal participation rights.", publicParticipationImpact: "protective" },
  { id: "duplicate_account_detection", label: "Duplicate Account Detection", status: "foundation_defined", purpose: "Prevent duplicate verified claims from silently multiplying civic signals.", publicParticipationImpact: "protective" },
  { id: "verification_data_separation", label: "Verification Data Separation", status: "foundation_defined", purpose: "Issue durable claims and remove sensitive source evidence when feasible.", publicParticipationImpact: "protective" },
];

export type DataDomain = "public_civic_data" | "user_identity_data" | "verification_data" | "govcrm_tenant_data";

export const DATA_DOMAIN_SEPARATION: Array<{ domain: DataDomain; contains: string[]; separationRule: string }> = [
  { domain: "public_civic_data", contains: ["meetings", "votes", "source documents", "public cases", "elections"], separationRule: "Public records remain source-attributed and do not expose private user identity evidence." },
  { domain: "user_identity_data", contains: ["profile", "session", "preferences", "claims metadata"], separationRule: "Profile and claims metadata are separate from verification source evidence." },
  { domain: "verification_data", contains: ["verification workflows", "temporary sensitive evidence", "review notes"], separationRule: "Sensitive evidence is retained only as needed to issue claims and should not be joined into public civic data." },
  { domain: "govcrm_tenant_data", contains: ["government workflows", "tenant submissions", "staff queues"], separationRule: "GovCRM tenant data cannot control public civic truth or verified participation rights." },
];
