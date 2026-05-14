import type { OrganizationSummary, OrganizationType } from "@/types/domain";

export const ORGANIZATION_FILTERS: Array<{ key: "all" | OrganizationType; label: string }> = [
  { key: "all", label: "All" },
  { key: "labor", label: "Labor" },
  { key: "public_interest", label: "Public Interest" },
  { key: "special_interest", label: "Special Interest" },
  { key: "religious", label: "Religious" },
  { key: "nonprofit", label: "Nonprofit" },
  { key: "neighborhood", label: "Neighborhood" },
  { key: "professional", label: "Professional" },
  { key: "student", label: "Student" },
  { key: "business", label: "Business" },
  { key: "advocacy", label: "Advocacy" },
];

export function getOrganizationTypeLabel(type: OrganizationType) {
  switch (type) {
    case "campus_org":
      return "Campus Org";
    case "coalition":
      return "Coalition";
    case "labor":
      return "Labor";
    case "public_interest":
      return "Public Interest";
    case "special_interest":
      return "Special Interest";
    case "religious":
      return "Religious";
    case "nonprofit":
      return "Nonprofit";
    case "neighborhood":
      return "Neighborhood";
    case "professional":
      return "Professional";
    case "student":
      return "Student";
    case "business":
      return "Business";
    case "advocacy":
      return "Advocacy";
  }
}

export function getOrganizationScopeLabel(organization: Pick<OrganizationSummary, "scopeLabel" | "campusCommunityId" | "communityId" | "organizationType">) {
  if (organization.scopeLabel) {
    return organization.scopeLabel;
  }

  if (organization.organizationType === "campus_org" || organization.organizationType === "student" || organization.campusCommunityId) {
    return "Campus";
  }

  if (organization.communityId === "usa") {
    return "National";
  }

  if (organization.communityId === "nevada") {
    return "State";
  }

  return "Local";
}
