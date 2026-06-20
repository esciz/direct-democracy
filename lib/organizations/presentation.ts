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
  { key: "business", label: "Business" },
  { key: "advocacy", label: "Advocacy" },
];

export function getOrganizationTypeLabel(type: OrganizationType) {
  switch (type) {
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
    case "business":
      return "Business";
    case "advocacy":
      return "Advocacy";
  }
}

export function getOrganizationScopeLabel(organization: Pick<OrganizationSummary, "scopeLabel" | "communityId" | "organizationType">) {
  if (organization.scopeLabel) {
    return organization.scopeLabel;
  }

  if (organization.communityId === "usa") {
    return "National";
  }

  if (organization.communityId === "nevada") {
    return "State";
  }

  return "Local";
}
