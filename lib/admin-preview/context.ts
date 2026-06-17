import "server-only";

import { cookies } from "next/headers";

import type { AuthUser, UserRole } from "@/types/domain";

export const ADMIN_PREVIEW_COOKIE = "dd_admin_preview";

export type PreviewRole =
  | "public"
  | "registered_voter"
  | "verified_resident"
  | "candidate"
  | "elected_official"
  | "campaign_admin"
  | "researcher"
  | "moderator_admin";

export type PreviewDataState =
  | "imported_only"
  | "enrichment_pending"
  | "enriched_pending_review"
  | "approved"
  | "verified"
  | "incomplete_missing_data"
  | "conflicting_source_data";

export type AdminPreviewContext = {
  role: PreviewRole;
  jurisdiction: string;
  dataState: PreviewDataState;
};

export const PREVIEW_ROLES: Array<{ value: PreviewRole; label: string; mappedRole: UserRole | "public" }> = [
  { value: "public", label: "Logged out/public", mappedRole: "public" },
  { value: "registered_voter", label: "Registered voter", mappedRole: "citizen" },
  { value: "verified_resident", label: "Verified resident", mappedRole: "trustedCitizen" },
  { value: "candidate", label: "Candidate", mappedRole: "candidate" },
  { value: "elected_official", label: "Elected official", mappedRole: "official" },
  { value: "campaign_admin", label: "Campaign admin", mappedRole: "candidate" },
  { value: "researcher", label: "Researcher", mappedRole: "citizen" },
  { value: "moderator_admin", label: "Moderator/admin", mappedRole: "admin" },
];

export const PREVIEW_DATA_STATES: Array<{ value: PreviewDataState; label: string }> = [
  { value: "imported_only", label: "Imported only" },
  { value: "enrichment_pending", label: "Enrichment pending" },
  { value: "enriched_pending_review", label: "Enriched pending review" },
  { value: "approved", label: "Approved" },
  { value: "verified", label: "Verified" },
  { value: "incomplete_missing_data", label: "Incomplete/missing data" },
  { value: "conflicting_source_data", label: "Conflicting source data" },
];

export const DEFAULT_PREVIEW_CONTEXT: AdminPreviewContext = {
  role: "verified_resident",
  jurisdiction: "reno",
  dataState: "enrichment_pending",
};

export function isAdminPreviewEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ADMIN_PREVIEW_ENABLED === "true";
}

export function getPreviewRoleLabel(role: PreviewRole) {
  return PREVIEW_ROLES.find((entry) => entry.value === role)?.label ?? "Preview user";
}

export function getPreviewDataStateLabel(dataState: PreviewDataState) {
  return PREVIEW_DATA_STATES.find((entry) => entry.value === dataState)?.label ?? "Imported only";
}

function isPreviewRole(value: string): value is PreviewRole {
  return PREVIEW_ROLES.some((role) => role.value === value);
}

function isPreviewDataState(value: string): value is PreviewDataState {
  return PREVIEW_DATA_STATES.some((state) => state.value === value);
}

export function parsePreviewContext(value: string | null | undefined): AdminPreviewContext | null {
  if (!value || !isAdminPreviewEnabled()) {
    return null;
  }

  try {
    const decodedValue = value.startsWith("%") ? decodeURIComponent(value) : value;
    const parsed = JSON.parse(decodedValue) as Partial<AdminPreviewContext>;
    const role = parsed.role && isPreviewRole(parsed.role) ? parsed.role : DEFAULT_PREVIEW_CONTEXT.role;
    const jurisdiction = typeof parsed.jurisdiction === "string" && parsed.jurisdiction ? parsed.jurisdiction : DEFAULT_PREVIEW_CONTEXT.jurisdiction;
    const dataState = parsed.dataState && isPreviewDataState(parsed.dataState) ? parsed.dataState : DEFAULT_PREVIEW_CONTEXT.dataState;

    return { role, jurisdiction, dataState };
  } catch {
    return null;
  }
}

export async function getActivePreviewContext() {
  const cookieStore = await cookies();
  return parsePreviewContext(cookieStore.get(ADMIN_PREVIEW_COOKIE)?.value);
}

export function buildPreviewQuery(context: AdminPreviewContext) {
  const params = new URLSearchParams({
    previewRole: context.role,
    previewJurisdiction: context.jurisdiction,
    previewDataState: context.dataState,
  });

  return params.toString();
}

export function applyPreviewContextToUser(user: AuthUser, context: AdminPreviewContext | null): AuthUser | null {
  if (!context || !isAdminPreviewEnabled()) {
    return user;
  }

  if (context.role === "public") {
    return null;
  }

  const roleDefinition = PREVIEW_ROLES.find((entry) => entry.value === context.role);
  const mappedRole = roleDefinition?.mappedRole === "public" ? "citizen" : roleDefinition?.mappedRole ?? user.role;
  const isVerifiedResident = context.role === "verified_resident" || context.role === "candidate" || context.role === "elected_official" || context.role === "campaign_admin";

  return {
    ...user,
    role: mappedRole,
    jurisdictionName: context.jurisdiction,
    isVerifiedVoter: context.role === "registered_voter" || isVerifiedResident || user.isVerifiedVoter,
    verificationState: context.role === "registered_voter" || isVerifiedResident ? "voterVerified" : user.verificationState,
  };
}
