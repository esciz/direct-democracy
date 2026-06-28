export type GovTenantType =
  | "CITY"
  | "COUNTY"
  | "SCHOOL_DISTRICT"
  | "STATE_AGENCY"
  | "LEGISLATURE"
  | "COURT"
  | "UNIVERSITY"
  | "SPECIAL_DISTRICT";

export type GovTenantModule =
  | "cases"
  | "submissions"
  | "comments"
  | "documents"
  | "meetings"
  | "reports"
  | "audit_log"
  | "public_works"
  | "code_enforcement"
  | "permits"
  | "roads"
  | "elections"
  | "county_services"
  | "parent_requests"
  | "board_comments"
  | "student_services"
  | "bill_tracking"
  | "testimony"
  | "committees"
  | "public_inquiry"
  | "docket_questions"
  | "document_requests"
  | "student_requests"
  | "campus_governance"
  | "public_engagement"
  | "regulatory_comments"
  | "licensing"
  | "program_inquiries";

export type GovTenantCapability =
  | "case_triage"
  | "assignment"
  | "internal_notes"
  | "official_response_drafting"
  | "read_only_public_record_links"
  | "audit_trail"
  | "resident_portal_intake"
  | "public_comment_intake"
  | "document_intake"
  | "meeting_context"
  | "records_request_tracking"
  | "service_request_tracking"
  | "public_works_routing"
  | "code_enforcement_routing"
  | "permit_inquiry_tracking"
  | "roads_routing"
  | "elections_inquiry_tracking"
  | "parent_request_triage"
  | "student_service_routing"
  | "testimony_queue"
  | "bill_context"
  | "committee_routing"
  | "docket_question_triage"
  | "campus_governance_context"
  | "regulatory_comment_triage"
  | "licensing_inquiry_tracking"
  | "program_inquiry_routing";

export type GovWorkflowType =
  | "resident_case"
  | "service_request"
  | "public_comment"
  | "records_request"
  | "meeting_followup"
  | "permit_inquiry"
  | "code_complaint"
  | "parent_request"
  | "student_service_request"
  | "bill_testimony"
  | "committee_comment"
  | "court_public_inquiry"
  | "docket_question"
  | "document_request"
  | "licensing_inquiry"
  | "regulatory_comment"
  | "program_inquiry";

export type GovDepartment = {
  id: string;
  name: string;
  workflowTypes: GovWorkflowType[];
  demoOnly: true;
};

export type GovStaffRole = {
  id: string;
  label: string;
  capabilities: GovTenantCapability[];
  demoOnly: true;
};

export type GovTenantProfile = {
  summary: string;
  primaryWorkflows: GovWorkflowType[];
  dashboardEmphasis: string[];
  publicCivicRecordPolicy: string;
  separationRules: string[];
};

export type GovTenant = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  type: GovTenantType;
  jurisdiction: string;
  demoLabel: "DEMO_DEV_ONLY";
  profile: GovTenantProfile;
  modules: GovTenantModule[];
  capabilities: GovTenantCapability[];
  departments: GovDepartment[];
  staffRoles: GovStaffRole[];
};

export const UNIVERSAL_GOVCRM_MODULES: GovTenantModule[] = [
  "cases",
  "submissions",
  "comments",
  "documents",
  "meetings",
  "reports",
  "audit_log",
];

export const GOV_TENANT_TYPE_LABELS: Record<GovTenantType, string> = {
  CITY: "City",
  COUNTY: "County",
  SCHOOL_DISTRICT: "School District",
  STATE_AGENCY: "State Agency",
  LEGISLATURE: "Legislature",
  COURT: "Court",
  UNIVERSITY: "University",
  SPECIAL_DISTRICT: "Special District",
};

const baselineCapabilities: GovTenantCapability[] = [
  "case_triage",
  "assignment",
  "internal_notes",
  "official_response_drafting",
  "read_only_public_record_links",
  "audit_trail",
  "resident_portal_intake",
  "public_comment_intake",
  "document_intake",
  "meeting_context",
  "records_request_tracking",
];

const tenantTypeConfig: Record<
  GovTenantType,
  {
    modules: GovTenantModule[];
    capabilities: GovTenantCapability[];
    workflows: GovWorkflowType[];
    dashboardEmphasis: string[];
  }
> = {
  CITY: {
    modules: ["public_works", "code_enforcement", "permits"],
    capabilities: ["service_request_tracking", "public_works_routing", "code_enforcement_routing", "permit_inquiry_tracking"],
    workflows: ["resident_case", "service_request", "code_complaint", "permit_inquiry", "public_comment", "meeting_followup"],
    dashboardEmphasis: ["resident cases", "public works", "code enforcement", "council comments", "meetings"],
  },
  COUNTY: {
    modules: ["roads", "elections", "county_services"],
    capabilities: ["service_request_tracking", "roads_routing", "elections_inquiry_tracking"],
    workflows: ["resident_case", "service_request", "records_request", "public_comment", "meeting_followup"],
    dashboardEmphasis: ["county services", "roads", "elections/public records", "commission comments"],
  },
  SCHOOL_DISTRICT: {
    modules: ["parent_requests", "board_comments", "student_services"],
    capabilities: ["parent_request_triage", "student_service_routing"],
    workflows: ["parent_request", "student_service_request", "public_comment", "meeting_followup"],
    dashboardEmphasis: ["parent requests", "board comments", "student services", "upcoming board meetings"],
  },
  STATE_AGENCY: {
    modules: ["regulatory_comments", "licensing", "program_inquiries"],
    capabilities: ["regulatory_comment_triage", "licensing_inquiry_tracking", "program_inquiry_routing"],
    workflows: ["regulatory_comment", "licensing_inquiry", "program_inquiry", "records_request"],
    dashboardEmphasis: ["regulatory comments", "licensing/program inquiries", "public records"],
  },
  LEGISLATURE: {
    modules: ["bill_tracking", "testimony", "committees"],
    capabilities: ["testimony_queue", "bill_context", "committee_routing"],
    workflows: ["bill_testimony", "committee_comment", "public_comment", "records_request"],
    dashboardEmphasis: ["testimony", "bills", "committees", "constituent comments"],
  },
  COURT: {
    modules: ["public_inquiry", "docket_questions", "document_requests"],
    capabilities: ["docket_question_triage"],
    workflows: ["court_public_inquiry", "docket_question", "document_request", "records_request"],
    dashboardEmphasis: ["public inquiries", "docket questions", "document requests"],
  },
  UNIVERSITY: {
    modules: ["student_requests", "campus_governance", "public_engagement"],
    capabilities: ["student_service_routing", "campus_governance_context"],
    workflows: ["student_service_request", "public_comment", "meeting_followup", "records_request"],
    dashboardEmphasis: ["student requests", "campus governance", "public engagement"],
  },
  SPECIAL_DISTRICT: {
    modules: ["program_inquiries", "public_engagement", "document_requests"],
    capabilities: ["program_inquiry_routing", "service_request_tracking"],
    workflows: ["program_inquiry", "service_request", "public_comment", "records_request"],
    dashboardEmphasis: ["program inquiries", "service requests", "board comments", "public records"],
  },
};

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function tenant(input: {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  type: GovTenantType;
  jurisdiction: string;
  summary: string;
  departments: Array<Omit<GovDepartment, "demoOnly">>;
}): GovTenant {
  const config = tenantTypeConfig[input.type];
  const modules = unique([...UNIVERSAL_GOVCRM_MODULES, ...config.modules]);
  const capabilities = unique([...baselineCapabilities, ...config.capabilities]);

  return {
    id: input.id,
    slug: input.slug,
    name: input.name,
    shortName: input.shortName,
    type: input.type,
    jurisdiction: input.jurisdiction,
    demoLabel: "DEMO_DEV_ONLY",
    profile: {
      summary: input.summary,
      primaryWorkflows: config.workflows,
      dashboardEmphasis: config.dashboardEmphasis,
      publicCivicRecordPolicy:
        "GovCRM may link to public Direct Democracy civic records as read-only context, but tenant workflow data cannot alter civic truth, votes, source attribution, accountability data, public sentiment, candidate records, ingestion artifacts, or public records.",
      separationRules: [
        "/gov owns customer-facing government CRM workflows only.",
        "/admin/operations owns platform DataOps, ingestion, source adapters, evidence acquisition, trust artifacts, and platform audits.",
        "GovCRM tenant records are private workflow data unless a future audited publishing workflow explicitly promotes a response.",
        "All fixture tenants are demo/dev only and do not represent live government accounts.",
      ],
    },
    modules,
    capabilities,
    departments: input.departments.map((department) => ({ ...department, demoOnly: true })),
    staffRoles: [
      {
        id: `${input.slug}-intake-specialist`,
        label: "Intake Specialist",
        capabilities: ["case_triage", "resident_portal_intake", "public_comment_intake", "document_intake"],
        demoOnly: true,
      },
      {
        id: `${input.slug}-department-owner`,
        label: "Department Owner",
        capabilities: ["assignment", "internal_notes", "official_response_drafting", "read_only_public_record_links"],
        demoOnly: true,
      },
      {
        id: `${input.slug}-gov-admin`,
        label: "GovCRM Admin",
        capabilities,
        demoOnly: true,
      },
    ],
  };
}

export const GOV_CRM_FIXTURE_TENANTS: GovTenant[] = [
  tenant({
    id: "tenant-carson-city",
    slug: "carson-city",
    name: "Carson City GovCRM tenant",
    shortName: "Carson City",
    type: "CITY",
    jurisdiction: "Carson City, Nevada",
    summary: "Demo/dev city workspace for resident cases, public works, code enforcement, permits, council comments, and meetings.",
    departments: [
      { id: "carson-public-works", name: "Public Works", workflowTypes: ["service_request", "resident_case"] },
      { id: "carson-code-enforcement", name: "Code Enforcement", workflowTypes: ["code_complaint", "resident_case"] },
      { id: "carson-clerk-recorder", name: "Clerk-Recorder", workflowTypes: ["records_request", "public_comment", "meeting_followup"] },
      { id: "carson-permits", name: "Permits", workflowTypes: ["permit_inquiry"] },
    ],
  }),
  tenant({
    id: "tenant-washoe-county",
    slug: "washoe-county",
    name: "Washoe County tenant",
    shortName: "Washoe County",
    type: "COUNTY",
    jurisdiction: "Washoe County, Nevada",
    summary: "Demo/dev county workspace for county services, roads, elections/public records, commission comments, and public meetings.",
    departments: [
      { id: "washoe-community-services", name: "Community Services", workflowTypes: ["service_request", "resident_case"] },
      { id: "washoe-roads", name: "Roads", workflowTypes: ["service_request"] },
      { id: "washoe-elections", name: "Elections", workflowTypes: ["records_request", "resident_case"] },
      { id: "washoe-clerk", name: "Clerk / Public Records", workflowTypes: ["records_request", "public_comment"] },
    ],
  }),
  tenant({
    id: "tenant-wcsd",
    slug: "washoe-county-school-district",
    name: "Washoe County School District tenant",
    shortName: "WCSD",
    type: "SCHOOL_DISTRICT",
    jurisdiction: "Washoe County, Nevada",
    summary: "Demo/dev school district workspace for parent requests, board comments, student services, and upcoming board meetings.",
    departments: [
      { id: "wcsd-parent-services", name: "Parent Services", workflowTypes: ["parent_request"] },
      { id: "wcsd-student-services", name: "Student Services", workflowTypes: ["student_service_request"] },
      { id: "wcsd-board-office", name: "Board Office", workflowTypes: ["public_comment", "meeting_followup"] },
    ],
  }),
  tenant({
    id: "tenant-nevada-legislature",
    slug: "nevada-legislature",
    name: "Nevada Legislature tenant",
    shortName: "Nevada Legislature",
    type: "LEGISLATURE",
    jurisdiction: "Nevada",
    summary: "Demo/dev legislative workspace for testimony, bills, committees, and constituent comments.",
    departments: [
      { id: "leg-testimony", name: "Testimony Intake", workflowTypes: ["bill_testimony"] },
      { id: "leg-committees", name: "Committee Staff", workflowTypes: ["committee_comment", "public_comment"] },
      { id: "leg-records", name: "Legislative Records", workflowTypes: ["records_request"] },
    ],
  }),
  tenant({
    id: "tenant-nevada-agency",
    slug: "nevada-state-agency",
    name: "Nevada agency tenant",
    shortName: "Nevada Agency",
    type: "STATE_AGENCY",
    jurisdiction: "Nevada",
    summary: "Demo/dev state agency workspace for regulatory comments, licensing, program inquiries, and public records.",
    departments: [
      { id: "agency-regulatory", name: "Regulatory Affairs", workflowTypes: ["regulatory_comment"] },
      { id: "agency-licensing", name: "Licensing", workflowTypes: ["licensing_inquiry"] },
      { id: "agency-programs", name: "Program Support", workflowTypes: ["program_inquiry"] },
      { id: "agency-records", name: "Public Records", workflowTypes: ["records_request"] },
    ],
  }),
];

export function getGovTenants() {
  return GOV_CRM_FIXTURE_TENANTS;
}

export function getGovTenantBySlug(slug: string | null | undefined) {
  if (!slug) return GOV_CRM_FIXTURE_TENANTS[0];
  return GOV_CRM_FIXTURE_TENANTS.find((tenantItem) => tenantItem.slug === slug || tenantItem.id === slug) ?? GOV_CRM_FIXTURE_TENANTS[0];
}

export function getGovTenantTypeConfig(type: GovTenantType) {
  return tenantTypeConfig[type];
}

export function getGovTenantDashboardCards(tenantItem: GovTenant) {
  return tenantItem.profile.dashboardEmphasis.map((label, index) => ({
    id: `${tenantItem.slug}-dashboard-${index}`,
    label,
    value: index === 0 ? "Active" : "Configured",
    detail: `${GOV_TENANT_TYPE_LABELS[tenantItem.type]} actor profile capability`,
  }));
}

export function tenantHref(href: string, tenantItem: GovTenant) {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}tenant=${tenantItem.slug}`;
}
