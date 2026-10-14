import { getCommunityById } from "@/lib/community/communities";
import type { ServiceCategory, ServiceSummary } from "@/types/domain";

const officialServiceLinks: ServiceSummary[] = [
  {
    id: "service_carson_housing",
    title: "Find housing and homelessness resources",
    description: "Use Carson City community support resources for housing assistance, shelter, and related services.",
    category: "Housing",
    externalLink: "https://www.carsoncity.gov/services/social-services",
    jurisdictionId: "carson-city",
    jurisdictionName: "Carson City, Nevada",
    responsibleEntity: "Carson City Community Support Services",
    responsibleOfficialId: null,
    relatedIssue: "Housing affordability",
    createdAt: "2026-04-01T07:55:00.000Z",
  },
  {
    id: "service_carson_pothole",
    title: "Report a pothole",
    description: "Use Carson City public works contacts to report road damage and street maintenance needs.",
    category: "Transportation",
    externalLink: "https://www.carsoncity.gov/Home/Components/ServiceDirectory/ServiceDirectory/289/7656",
    jurisdictionId: "carson-city",
    jurisdictionName: "Carson City, Nevada",
    responsibleEntity: "Carson City Public Works",
    responsibleOfficialId: null,
    relatedIssue: "Infrastructure",
    createdAt: "2026-04-01T08:00:00.000Z",
  },
  {
    id: "service_carson_school_enrollment",
    title: "Enroll in school",
    description: "Find Carson City School District registration information, school contacts, and enrollment steps.",
    category: "Education",
    externalLink: "https://www.carsoncityschools.com/families-and-students/student-registration",
    jurisdictionId: "carson-city",
    jurisdictionName: "Carson City, Nevada",
    responsibleEntity: "Carson City School District",
    responsibleOfficialId: null,
    relatedIssue: "Education funding",
    createdAt: "2026-04-01T08:05:00.000Z",
  },
  {
    id: "service_carson_permits",
    title: "Apply for permits",
    description: "Start local development, building, and engineering permit tasks through Carson City resources.",
    category: "Permits",
    externalLink: "https://www.carsoncity.gov/government/departments-a-f/community-development",
    jurisdictionId: "carson-city",
    jurisdictionName: "Carson City, Nevada",
    responsibleEntity: "Carson City Community Development",
    responsibleOfficialId: null,
    relatedIssue: "Downtown growth",
    createdAt: "2026-04-01T08:10:00.000Z",
  },
  {
    id: "service_carson_utilities",
    title: "Pay utilities",
    description: "Access Carson City utility billing for water, sewer, storm water, and account management.",
    category: "Utilities",
    externalLink: "https://www.carsoncity.gov/government/departments-g-z/public-works/divisions/utility-billing-water-sewer",
    jurisdictionId: "carson-city",
    jurisdictionName: "Carson City, Nevada",
    responsibleEntity: "Carson City Public Works - Utility Billing",
    responsibleOfficialId: null,
    relatedIssue: "Water planning",
    createdAt: "2026-04-01T08:15:00.000Z",
  },
  {
    id: "service_carson_safety",
    title: "Find non-emergency public safety contacts",
    description: "Reach Carson City Sheriff and city public safety contacts for non-emergency reporting and records guidance.",
    category: "Public Safety",
    externalLink: "https://www.carsoncity.gov/government/departments-g-z/sheriff-s-office/contact-us-6597/-cftype-StaffDirectory",
    jurisdictionId: "carson-city",
    jurisdictionName: "Carson City, Nevada",
    responsibleEntity: "Carson City Sheriff's Office",
    responsibleOfficialId: null,
    relatedIssue: "Public safety",
    createdAt: "2026-04-01T08:17:00.000Z",
  },
  {
    id: "service_nevada_vote_registration",
    title: "Register to vote",
    description: "Go to Nevada’s official voter registration resources and election information.",
    category: "Public Safety",
    externalLink: "https://www.nvsos.gov/sos/elections",
    jurisdictionId: "nevada",
    jurisdictionName: "Nevada",
    responsibleEntity: "Nevada Secretary of State",
    responsibleOfficialId: null,
    relatedIssue: "Government transparency",
    createdAt: "2026-04-01T08:20:00.000Z",
  },
  {
    id: "service_nevada_business_licensing",
    title: "Business licensing",
    description: "Start or manage Nevada business filings and licensing through the state’s business portal.",
    category: "Permits",
    externalLink: "https://www.nvsilverflume.gov/home",
    jurisdictionId: "nevada",
    jurisdictionName: "Nevada",
    responsibleEntity: "Nevada SilverFlume Business Portal",
    responsibleOfficialId: null,
    relatedIssue: "Economic development",
    createdAt: "2026-04-01T08:25:00.000Z",
  },
  {
    id: "service_reno_housing",
    title: "Find housing help in Reno",
    description: "Use Reno-area housing and community assistance resources for shelter, support, and local services.",
    category: "Housing",
    externalLink: "https://www.reno.gov/community/homelessness.php",
    jurisdictionId: "reno",
    jurisdictionName: "Washoe County, Nevada",
    responsibleEntity: "City of Reno Housing and Neighborhood Services",
    responsibleOfficialId: null,
    relatedIssue: "Housing affordability",
    createdAt: "2026-04-01T08:28:00.000Z",
  },
  {
    id: "service_reno_pothole",
    title: "Report a Reno street issue",
    description: "Use City of Reno service resources for street damage, traffic signs, and maintenance requests.",
    category: "Transportation",
    externalLink: "https://www.reno.gov/government/departments/public-works",
    jurisdictionId: "reno",
    jurisdictionName: "Washoe County, Nevada",
    responsibleEntity: "City of Reno Public Works",
    responsibleOfficialId: null,
    relatedIssue: "Road safety",
    createdAt: "2026-04-01T08:30:00.000Z",
  },
  {
    id: "service_reno_utilities",
    title: "Manage utility services",
    description: "Find utility and public works billing information relevant to Reno-area residents.",
    category: "Utilities",
    externalLink: "https://www.reno.gov/government/departments/public-works",
    jurisdictionId: "reno",
    jurisdictionName: "Washoe County, Nevada",
    responsibleEntity: "Reno Public Works",
    responsibleOfficialId: null,
    relatedIssue: "Water resilience",
    createdAt: "2026-04-01T08:35:00.000Z",
  },
  {
    id: "service_national_vote_info",
    title: "Find national voting information",
    description: "Use USA.gov to find voter registration and election guidance by state.",
    category: "Public Safety",
    externalLink: "https://www.usa.gov/voter-registration",
    jurisdictionId: "united-states",
    jurisdictionName: "United States",
    responsibleEntity: "USA.gov",
    responsibleOfficialId: null,
    relatedIssue: "Government transparency",
    createdAt: "2026-04-01T08:40:00.000Z",
  },
];

function communityMatches(jurisdictionName: string, communityId: string) {
  const community = getCommunityById(communityId);

  if (!community) {
    return false;
  }

  return community.jurisdictionMatches.includes(jurisdictionName);
}

export function getServicesForCommunity(communityId: string, category?: ServiceCategory | "all") {
  return officialServiceLinks
    .filter((service) => communityMatches(service.jurisdictionName, communityId))
    .filter((service) => (category && category !== "all" ? service.category === category : true))
    .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
}

export function getTopServicesForCommunity(communityId: string, limit = 5) {
  return getServicesForCommunity(communityId).slice(0, limit);
}

export function getServiceCategories() {
  return ["Housing", "Education", "Transportation", "Permits", "Utilities", "Public Safety"] as const;
}
