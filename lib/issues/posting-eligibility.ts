import { getCommunityById } from "@/lib/community/communities";
import { isVoterVerifiedUser } from "@/lib/auth/verification";
import type { AuthUser, TopIssueSummary } from "@/types/domain";

const ISSUE_VOICE_ROLES = new Set<AuthUser["role"]>(["citizen", "trustedCitizen", "verified_resident"]);
const PLATFORM_WIDE_JURISDICTION = "across the platform";

function normalizeJurisdictionName(value: string) {
  return value.trim().toLowerCase().replace(/,\s*nv\b/g, ", nevada").replace(/\s+/g, " ");
}

function stateBucket(jurisdictionName: string) {
  const normalized = normalizeJurisdictionName(jurisdictionName);
  if (normalized === "united states") return "united states";
  if (normalized === "nevada" || normalized.endsWith(", nevada")) return "nevada";
  return normalized.split(",").map((part) => part.trim()).filter(Boolean).at(-1) ?? normalized;
}

function hasVerifiedResidency(user: AuthUser) {
  if (isVoterVerifiedUser(user) || user.role === "verified_resident") return true;
  return Boolean(user.verifiedJurisdictionIds?.length || user.verifiedCommunityIds?.length);
}

function getVerifiedCommunityIds(user: AuthUser) {
  if (Array.isArray(user.verifiedCommunityIds)) {
    return user.verifiedCommunityIds;
  }

  return user.primaryCommunityId && hasVerifiedResidency(user) ? [user.primaryCommunityId] : [];
}

function communityMatchesJurisdiction(communityId: string, jurisdictionName: string) {
  const community = getCommunityById(communityId);
  if (!community) return false;
  const normalizedJurisdiction = normalizeJurisdictionName(jurisdictionName);
  return [community.name, community.primaryJurisdictionName, ...community.jurisdictionMatches].some(
    (value) => normalizeJurisdictionName(value) === normalizedJurisdiction,
  );
}

export function isPlatformWideIssue(issue: Pick<TopIssueSummary, "jurisdictionName">) {
  return normalizeJurisdictionName(issue.jurisdictionName) === PLATFORM_WIDE_JURISDICTION;
}

export function isIssueVoiceAccount(user: AuthUser) {
  return ISSUE_VOICE_ROLES.has(user.role);
}

export function canSubmitIssueVoice(user: AuthUser) {
  return isIssueVoiceAccount(user) && hasVerifiedResidency(user);
}

export function canPostToIssueScope(user: AuthUser, issue: Pick<TopIssueSummary, "scope" | "jurisdictionName">) {
  if (!canSubmitIssueVoice(user)) return false;
  if (isPlatformWideIssue(issue) || issue.scope === "national") return true;
  if (issue.scope === "state") {
    const verifiedStates = user.verifiedJurisdictionIds?.map(stateBucket) ?? [];
    return verifiedStates.includes(stateBucket(issue.jurisdictionName)) || stateBucket(user.jurisdictionName) === stateBucket(issue.jurisdictionName);
  }

  return getVerifiedCommunityIds(user).some((communityId) => communityMatchesJurisdiction(communityId, issue.jurisdictionName));
}
