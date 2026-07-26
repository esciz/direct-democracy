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

export const PUBLIC_ORGANIZATION_CATEGORIES = [
  "all",
  "political_party",
  "civic",
  "community",
  "civil_rights",
  "advocacy",
  "environment",
  "labor",
  "business",
  "professional",
  "service",
  "faith_service",
  "health",
  "youth",
  "veterans",
  "education",
  "service_club",
  "arts_culture",
  "public_institution",
  "public_association",
] as const;

export function getPublicOrganizationCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    all: "All public organizations",
    political_party: "Political parties",
    civic: "Civic",
    community: "Community",
    civil_rights: "Civil rights",
    advocacy: "Advocacy",
    environment: "Environment",
    labor: "Labor",
    business: "Business",
    professional: "Professional",
    service: "Community service",
    faith_service: "Faith and service",
    health: "Health",
    youth: "Youth",
    veterans: "Veterans",
    education: "Education",
    service_club: "Service clubs",
    arts_culture: "Arts and culture",
    public_institution: "Public institutions",
    public_association: "Public associations",
  };
  return labels[category] ?? category.replaceAll("_", " ");
}
