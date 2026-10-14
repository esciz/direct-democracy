export const PUBLIC_CIVIC_LAYER = {
  name: "Direct Democracy Foundation / Public Civic Layer",
  purpose: [
    "free public civic information",
    "who represents me",
    "elections",
    "candidate profiles",
    "official profiles",
    "issue pages",
    "public voting and sentiment",
    "actions",
    "civic education",
    "open civic data",
    "source transparency",
  ],
} as const;

export const GOV_CRM_LAYER = {
  name: "Direct Democracy GovCRM / Government Workflow Layer",
  purpose: [
    "constituent case management",
    "public comment workflows",
    "meeting intelligence",
    "staff task routing",
    "department routing",
    "service request intake",
    "public response tracking",
    "transparency reports",
    "compliance and workflow tools",
  ],
} as const;

export const SHARED_CIVIC_GRAPH = [
  "jurisdictions",
  "districts",
  "officials",
  "candidates",
  "elections",
  "issues",
  "meetings",
  "public comments",
  "actions",
  "source records",
] as const;

export const PROHIBITED_GOVCRM_ACTIONS = [
  "alter public sentiment results",
  "suppress criticism",
  "delete public civic responses",
  "pay to improve ratings",
  "change candidate or official records outside reviewed correction workflows",
  "hide negative issue trends",
  "control issue rankings",
  "manipulate voting or question results",
] as const;

export const ALLOWED_GOVCRM_ACTIONS = [
  "manage constituent cases",
  "respond to requests",
  "categorize public comments internally",
  "route issues to departments",
  "publish official responses",
  "view aggregate public trends",
  "manage owned meeting and workflow records",
  "export operational reports",
] as const;

export const DATA_ETHICS_PRINCIPLES = [
  "public civic truth must be source-attributed",
  "public sentiment must not be edited by paying customers",
  "government workflow tools must not control public civic records",
  "verified or manually reviewed data must not be silently overwritten",
  "core public civic information should remain citizen-accessible",
  "individual-level civic sentiment should not be exposed without consent",
  "aggregate analytics should protect people from retaliation or targeting",
  "public comment handling should be auditable",
  "official responses should be clearly attributed",
] as const;

export const FUTURE_GOVERNANCE_ROLES = [
  "public_user",
  "verified_resident",
  "candidate",
  "official",
  "platform_admin",
  "government_admin",
  "government_staff",
  "government_observer",
] as const;

export type FutureGovernanceRole = (typeof FUTURE_GOVERNANCE_ROLES)[number];
