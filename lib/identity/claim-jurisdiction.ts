import { seededCommunities } from "@/lib/community/communities";

type VerificationClaimScope = {
  claimType: string;
  status: string;
  jurisdictionIds: string[];
  communityIds: string[];
  expiresAt: Date | string | null;
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/,\s*nv\b/g, ", nevada").replace(/\s+/g, " ");
}

function isUnexpired(expiresAt: Date | string | null) {
  if (!expiresAt) return true;
  const timestamp = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

export function isActiveVerificationClaim(claim: VerificationClaimScope) {
  const acceptedStatus =
    claim.claimType === "voter"
      ? claim.status === "matched" || claim.status === "verified"
      : claim.claimType === "residency" && (claim.status === "verified" || claim.status === "matched");
  return acceptedStatus && isUnexpired(claim.expiresAt);
}

function findCommunity(value: string) {
  const normalized = normalize(value);
  return seededCommunities.find(
    (community) =>
      normalize(community.id) === normalized ||
      normalize(community.name) === normalized ||
      normalize(community.primaryJurisdictionName) === normalized ||
      community.jurisdictionMatches.some((match) => normalize(match) === normalized),
  );
}

function communitySpecificity(communityId: string) {
  const community = seededCommunities.find((entry) => entry.id === communityId);
  if (community?.scope === "local") return 3;
  if (community?.scope === "state") return 2;
  if (community?.scope === "national") return 1;
  return 0;
}

export function getActiveVerificationScope(claims: VerificationClaimScope[]) {
  const activeClaims = claims.filter(isActiveVerificationClaim);
  const jurisdictionIds = [...new Set(activeClaims.flatMap((claim) => claim.jurisdictionIds.map((value) => value.trim())).filter(Boolean))];
  const explicitCommunityIds = activeClaims.flatMap((claim) => claim.communityIds);
  const resolvedCommunityIds = [...explicitCommunityIds, ...jurisdictionIds]
    .map((value) => findCommunity(value)?.id)
    .filter((value): value is string => Boolean(value));
  const communityIds = [...new Set(resolvedCommunityIds)].sort(
    (left, right) => communitySpecificity(right) - communitySpecificity(left),
  );
  const primaryCommunity = communityIds.length
    ? seededCommunities.find((community) => community.id === communityIds[0]) ?? null
    : null;

  return {
    hasActiveVoterClaim: activeClaims.some((claim) => claim.claimType === "voter"),
    hasActiveResidencyClaim: activeClaims.some((claim) => claim.claimType === "residency"),
    jurisdictionIds,
    communityIds,
    primaryCommunity,
  };
}

export function resolveVerificationCommunityIds(values: Array<string | null | undefined>) {
  return [
    ...new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
        .map((value) => findCommunity(value)?.id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}
