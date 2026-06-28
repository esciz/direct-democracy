export type PlatformRoleId = "public" | "verified_resident" | "verified_voter" | "trusted_citizen" | "government" | "admin";

export type ParticipationCapability = "browse" | "learn" | "participate" | "vote" | "discuss" | "create_debate" | "steward_discussion" | "curate_evidence" | "moderate" | "administer";

export type PlatformRoleDefinition = {
  id: PlatformRoleId;
  label: string;
  description: string;
  capabilities: ParticipationCapability[];
  votingRightsGroup: "none" | "verified_participant" | "administrative";
  notes: string;
};

export const PLATFORM_ROLES: PlatformRoleDefinition[] = [
  {
    id: "public",
    label: "Public",
    description: "Unauthenticated or unverified public browsing access.",
    capabilities: ["browse", "learn"],
    votingRightsGroup: "none",
    notes: "Can consume public civic information but cannot participate in verified civic signals.",
  },
  {
    id: "verified_resident",
    label: "Verified Resident",
    description: "A person with a durable residency claim.",
    capabilities: ["browse", "learn", "participate", "vote", "discuss"],
    votingRightsGroup: "verified_participant",
    notes: "Participation rights are equal to verified voters; segmentation is reported separately and never used as hidden weighting.",
  },
  {
    id: "verified_voter",
    label: "Verified Voter",
    description: "A person with durable residency and voter-registration claims.",
    capabilities: ["browse", "learn", "participate", "vote", "discuss"],
    votingRightsGroup: "verified_participant",
    notes: "Verified voter is a signal segment, not a higher-weight vote class.",
  },
  {
    id: "trusted_citizen",
    label: "Trusted Citizen",
    description: "A verified participant with trust claims suitable for stewardship workflows.",
    capabilities: ["browse", "learn", "participate", "vote", "discuss", "create_debate", "steward_discussion", "curate_evidence"],
    votingRightsGroup: "verified_participant",
    notes: "Trusted Citizen status expands stewardship capabilities, not voting weight.",
  },
  {
    id: "government",
    label: "Government",
    description: "Government staff or official workflow access with product-boundary controls.",
    capabilities: ["browse", "learn"],
    votingRightsGroup: "none",
    notes: "Government users cannot control public civic truth or verified civic participation.",
  },
  {
    id: "admin",
    label: "Admin",
    description: "Platform operations and review access.",
    capabilities: ["browse", "learn", "moderate", "administer"],
    votingRightsGroup: "administrative",
    notes: "Administrative capabilities are audited and separated from public civic participation.",
  },
];

export function roleHasCapability(roleId: PlatformRoleId, capability: ParticipationCapability) {
  return PLATFORM_ROLES.find((role) => role.id === roleId)?.capabilities.includes(capability) ?? false;
}
