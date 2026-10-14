export type GovernmentEntityType = "state" | "county" | "city" | "school_district" | "university" | "special_district";

export type ServiceActionType =
  | "form_fill"
  | "document_upload"
  | "pdf_submission"
  | "external_link"
  | "case_intake"
  | "payment"
  | "appointment"
  | "public_comment"
  | "records_request"
  | "complaint"
  | "permit_application"
  | "filing"
  | "report_issue"
  | "information_only";

export type ServiceActionStatus = "planned" | "available" | "needs_review" | "external_only";

export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "intake_received"
  | "extraction_pending"
  | "staff_review"
  | "needs_more_info"
  | "routed"
  | "resolved"
  | "rejected"
  | "published";

export type ServiceCatalog = {
  id: string;
  slug: string;
  governmentEntityName: string;
  jurisdiction: string;
  entityType: GovernmentEntityType;
  sourceUrl: string;
  lastReviewedAt: string;
  active: boolean;
  categories: ServiceCategory[];
};

export type ServiceCategory = {
  id: string;
  catalogId: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  actions: ServiceAction[];
};

export type ServiceAction = {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  description: string;
  actionType: ServiceActionType;
  publicUserDescription: string;
  staffProcessingDescription: string;
  sourceUrl: string;
  externalSubmissionUrl?: string | null;
  requiredDocuments: string[];
  requiresSignature: boolean;
  requiresPayment: boolean;
  requiresStaffReview: boolean;
  supportsPdfGeneration: boolean;
  supportsDocumentIngestion: boolean;
  supportsExternalSubmission: boolean;
  status: ServiceActionStatus;
  sortOrder: number;
  estimatedSteps: string[];
};

type SeedServiceCategory = {
  name: string;
  slug?: string;
  description: string;
  sortOrder: number;
  actions: Array<Omit<ServiceAction, "id" | "categoryId" | "sortOrder">>;
};

export type Submission = {
  id: string;
  serviceActionId: string;
  submitterId?: string | null;
  governmentEntityName: string;
  jurisdiction: string;
  status: SubmissionStatus;
  priority: "low" | "normal" | "high" | "urgent";
  summary?: string | null;
  publicTrackingCode?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SubmissionDocument = {
  id: string;
  submissionId: string;
  civicDocumentId?: string | null;
  originalFilename: string;
  documentType: string;
  uploadStatus: "pending" | "uploaded" | "failed";
  extractionStatus: "pending" | "completed" | "needs_ocr" | "needs_review" | "failed";
  reviewStatus: "pending_review" | "approved" | "rejected" | "verified";
};

export type SubmissionExtractedField = {
  id: string;
  submissionId: string;
  fieldName: string;
  fieldValue: string;
  confidenceScore: number;
  reviewStatus: "pending_review" | "approved" | "edited" | "rejected" | "verified";
  sourceDocumentId?: string | null;
};

export type StaffTask = {
  id: string;
  submissionId: string;
  assignedTo?: string | null;
  department: string;
  taskType: string;
  status: "open" | "in_progress" | "blocked" | "done";
  dueAt?: string | null;
  notes?: string | null;
};

export type FormTemplate = {
  id: string;
  serviceActionId: string;
  title: string;
  sourcePdfUrl?: string | null;
  fields: FormField[];
  supportsPdfGeneration: boolean;
  requiresStaffReview: boolean;
};

export type FormField = {
  id: string;
  templateId: string;
  label: string;
  fieldKey: string;
  fieldType: "text" | "textarea" | "email" | "phone" | "date" | "number" | "select" | "checkbox" | "signature";
  required: boolean;
  helpText?: string | null;
};

export type FormSubmission = {
  id: string;
  formTemplateId: string;
  submissionId: string;
  fieldValues: Record<string, string | boolean | number | null>;
  status: "draft" | "generated_pdf" | "staff_review" | "ready_for_external_submission" | "submitted_internally";
};

export interface PdfGenerationProvider {
  providerName: string;
  generatePdf(input: { template: FormTemplate; submission: FormSubmission }): Promise<{ ok: boolean; filePath?: string; error?: string }>;
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}

export interface ExternalSubmissionProvider {
  providerName: string;
  submit(input: { catalog: ServiceCatalog; action: ServiceAction; submission: Submission }): Promise<{ ok: boolean; confirmationId?: string; error?: string }>;
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}

export class ManualPdfGenerationProvider implements PdfGenerationProvider {
  providerName = "ManualPdfGenerationProvider";

  async generatePdf() {
    return { ok: false, error: "PDF generation is scaffolded for enrolled GovCRM clients but not enabled yet." };
  }

  async healthCheck() {
    return { ok: true, message: "Manual PDF generation placeholder is available." };
  }
}

export class NoExternalSubmissionProvider implements ExternalSubmissionProvider {
  providerName = "NoExternalSubmissionProvider";

  async submit() {
    return { ok: false, error: "External government submission automation is disabled until an authorized integration exists." };
  }

  async healthCheck() {
    return { ok: true, message: "External submission is intentionally disabled." };
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function action(
  title: string,
  options: Partial<Omit<ServiceAction, "id" | "categoryId" | "title" | "slug" | "sortOrder">> = {},
): Omit<ServiceAction, "id" | "categoryId" | "sortOrder"> {
  const actionType = options.actionType ?? "information_only";
  const status = options.status ?? (actionType === "external_link" ? "external_only" : "planned");
  const requiredDocuments = options.requiredDocuments ?? [];
  return {
    title,
    slug: slugify(title),
    description: options.description ?? `${title} through the official government service path.`,
    actionType,
    publicUserDescription: options.publicUserDescription ?? `Use this service to ${title.toLowerCase()}.`,
    staffProcessingDescription: options.staffProcessingDescription ?? "Staff workflow mapping pending catalog review.",
    sourceUrl: options.sourceUrl ?? "",
    externalSubmissionUrl: options.externalSubmissionUrl ?? null,
    requiredDocuments,
    requiresSignature: options.requiresSignature ?? false,
    requiresPayment: options.requiresPayment ?? false,
    requiresStaffReview: options.requiresStaffReview ?? (actionType !== "information_only" && actionType !== "external_link"),
    supportsPdfGeneration: options.supportsPdfGeneration ?? ["form_fill", "pdf_submission", "filing", "permit_application"].includes(actionType),
    supportsDocumentIngestion: options.supportsDocumentIngestion ?? ["document_upload", "pdf_submission", "filing", "permit_application", "public_comment"].includes(actionType),
    supportsExternalSubmission: options.supportsExternalSubmission ?? (actionType === "external_link"),
    status,
    estimatedSteps: options.estimatedSteps ?? ["Review official requirements", "Gather any required documents", "Use the official source link or staff-assisted intake path"],
  };
}

function category(catalogId: string, name: string, description: string, sortOrder: number, actions: Array<Omit<ServiceAction, "id" | "categoryId" | "sortOrder">>): ServiceCategory {
  const categorySlug = slugify(name);
  return {
    id: `${catalogId}-${categorySlug}`,
    catalogId,
    name,
    slug: categorySlug,
    description,
    sortOrder,
    actions: actions.map((item, index) => ({
      ...item,
      id: `${catalogId}-${categorySlug}-${item.slug}`,
      categoryId: `${catalogId}-${categorySlug}`,
      sortOrder: index + 1,
    })),
  };
}

function catalog(input: Omit<ServiceCatalog, "categories"> & { categories: SeedServiceCategory[] }): ServiceCatalog {
  return {
    ...input,
    categories: input.categories.map((item, index) => category(input.id, item.name, item.description, item.sortOrder ?? index + 1, item.actions)),
  };
}

const nevadaSosSource = "https://www.nvsos.gov/";
const washoeSource = "https://www.washoecounty.gov/";
const renoSource = "https://www.reno.gov/";
const carsonSource = "https://www.carson.org/";

export const serviceCatalogs: ServiceCatalog[] = [
  catalog({
    id: "nevada-sos",
    slug: "nevada-secretary-of-state",
    governmentEntityName: "Nevada Secretary of State",
    jurisdiction: "Nevada",
    entityType: "state",
    sourceUrl: nevadaSosSource,
    lastReviewedAt: "2026-06-07",
    active: true,
    categories: [
      {
        name: "Elections",
        slug: "elections",
        description: "Election, candidate, campaign finance, voter, and ballot information services.",
        sortOrder: 1,
        actions: [
          action("Register to vote", { actionType: "external_link", sourceUrl: nevadaSosSource }),
          action("Check voter registration requirements", { actionType: "information_only", sourceUrl: nevadaSosSource }),
          action("View 2026 election information", { actionType: "information_only", sourceUrl: `${nevadaSosSource}elections/election-information/2026-election-information` }),
          action("View county election submission plans", { actionType: "information_only", sourceUrl: nevadaSosSource }),
          action("View voting locations", { actionType: "external_link", sourceUrl: nevadaSosSource }),
          action("View candidate public media information", {
            actionType: "document_upload",
            sourceUrl: `${nevadaSosSource}elections/election-information/2026-election-information/2026-candidate-public-media-information`,
            supportsDocumentIngestion: true,
            requiredDocuments: ["Candidate media PDF if manually acquired"],
            staffProcessingDescription: "Candidate media PDFs can flow into Civic Document Intake and pending candidate profile enrichment.",
          }),
          action("Candidate filing information", { actionType: "filing", sourceUrl: nevadaSosSource, requiresSignature: true, supportsDocumentIngestion: true }),
          action("Campaign finance reporting requirements", { actionType: "information_only", sourceUrl: nevadaSosSource }),
          action("Financial disclosure statements", { actionType: "pdf_submission", sourceUrl: nevadaSosSource, requiresSignature: true, supportsDocumentIngestion: true }),
          action("File for judicial office", { actionType: "filing", sourceUrl: nevadaSosSource, requiresSignature: true, supportsPdfGeneration: true }),
          action("File for non-judicial office", { actionType: "filing", sourceUrl: nevadaSosSource, requiresSignature: true, supportsPdfGeneration: true }),
          action("Ballot tracking", { actionType: "external_link", sourceUrl: nevadaSosSource }),
          action("View previous election results", { actionType: "information_only", sourceUrl: nevadaSosSource }),
          action("View archived election results", { actionType: "information_only", sourceUrl: nevadaSosSource }),
          action("View county precinct maps", { actionType: "information_only", sourceUrl: nevadaSosSource }),
          action("Party and committee information", { actionType: "information_only", sourceUrl: nevadaSosSource }),
          action("Initiatives and referenda / petitions", { actionType: "filing", sourceUrl: nevadaSosSource, supportsDocumentIngestion: true }),
          action("Poll worker information", { actionType: "information_only", sourceUrl: nevadaSosSource }),
        ],
      },
      {
        name: "Business",
        slug: "business",
        description: "Business search, filing, licensing, registered agent, UCC, trademark, and certification services.",
        sortOrder: 2,
        actions: [
          "Business entity search",
          "Start a business",
          "Manage your business",
          "Close a business",
          "State business license",
          "State business license exemption",
          "Articles of incorporation/organization",
          "Registered agent listing",
          "Name reservation",
          "UCC filings",
          "UCC forms",
          "Trademarks",
          "Apostille / certification",
          "Data report requests",
          "Customer order forms",
          "Business forms and fees",
        ].map((title) => action(title, { actionType: title.includes("forms") || title.includes("filings") || title.includes("Articles") ? "filing" : "external_link", sourceUrl: nevadaSosSource })),
      },
      {
        name: "Compliance",
        slug: "compliance",
        description: "Notary, securities, document preparation, complaint, compliance, and nonprofit solicitation services.",
        sortOrder: 3,
        actions: [
          "Notary",
          "eNotary registration",
          "Notary forms and fees",
          "Notary violation complaint report",
          "Document preparation services",
          "Digital signature certifying authorities",
          "Securities information",
          "Securities registration",
          "Securities forms",
          "Investment adviser / broker dealer information",
          "File a securities complaint",
          "State business license compliance",
          "Nonprofit solicitation requirements",
        ].map((title) =>
          action(title, {
            actionType: title.toLowerCase().includes("complaint") ? "complaint" : title.toLowerCase().includes("forms") ? "pdf_submission" : "information_only",
            sourceUrl: nevadaSosSource,
          }),
        ),
      },
      {
        name: "Services",
        slug: "services",
        description: "Public records, forms, complaints, data downloads, public notices, legislative reporting, and language access.",
        sortOrder: 4,
        actions: [
          action("Public records request", { actionType: "records_request", sourceUrl: nevadaSosSource }),
          action("File a complaint", { actionType: "complaint", sourceUrl: nevadaSosSource }),
          action("Search results", { actionType: "external_link", sourceUrl: nevadaSosSource }),
          action("Data download", { actionType: "external_link", sourceUrl: nevadaSosSource }),
          action("Forms - all divisions", { actionType: "pdf_submission", sourceUrl: nevadaSosSource, supportsDocumentIngestion: true }),
          action("Election forms", { actionType: "pdf_submission", sourceUrl: nevadaSosSource, supportsDocumentIngestion: true }),
          action("Business forms", { actionType: "pdf_submission", sourceUrl: nevadaSosSource, supportsDocumentIngestion: true }),
          action("Securities forms", { actionType: "pdf_submission", sourceUrl: nevadaSosSource, supportsDocumentIngestion: true }),
          action("Notary forms", { actionType: "pdf_submission", sourceUrl: nevadaSosSource, supportsDocumentIngestion: true }),
          action("Contact information for special programs", { actionType: "information_only", sourceUrl: nevadaSosSource }),
          action("News / public notices", { actionType: "information_only", sourceUrl: nevadaSosSource }),
          action("Legislative reporting", { actionType: "information_only", sourceUrl: nevadaSosSource }),
          action("Language access plan", { actionType: "information_only", sourceUrl: nevadaSosSource }),
        ],
      },
    ],
  }),
  catalog({
    id: "washoe-county",
    slug: "washoe-county",
    governmentEntityName: "Washoe County",
    jurisdiction: "Washoe County, Nevada",
    entityType: "county",
    sourceUrl: washoeSource,
    lastReviewedAt: "2026-06-07",
    active: true,
    categories: [
      { name: "Elections & Voting", slug: "elections-voting", description: "Voter, election result, candidate, and local election services.", sortOrder: 1, actions: ["Register/check voting info", "View election results", "Candidate/local election information"].map((title) => action(title, { actionType: "external_link", sourceUrl: washoeSource })) },
      { name: "Clerk / Records", slug: "clerk-records", description: "Marriage, recording, clerk, and official records services.", sortOrder: 2, actions: ["Marriage/recording services", "Request public records"].map((title) => action(title, { actionType: title.includes("records") ? "records_request" : "external_link", sourceUrl: washoeSource })) },
      { name: "Community Services", slug: "community-services", description: "County community service workflows and resident support.", sortOrder: 3, actions: [action("Report road/pothole/public works issue", { actionType: "report_issue", sourceUrl: washoeSource })] },
      { name: "Permits & Planning", slug: "permits-planning", description: "Planning, permitting, and application workflows.", sortOrder: 4, actions: [action("Apply for permits", { actionType: "permit_application", sourceUrl: washoeSource, supportsDocumentIngestion: true })] },
      { name: "Public Works", slug: "public-works", description: "Roads, public works, and infrastructure issue reporting.", sortOrder: 5, actions: [action("Report road/pothole/public works issue", { actionType: "report_issue", sourceUrl: washoeSource })] },
      { name: "Health & Human Services", slug: "health-human-services", description: "Resident support and health service navigation.", sortOrder: 6, actions: [action("Health and human services information", { actionType: "information_only", sourceUrl: washoeSource })] },
      { name: "Sheriff / Public Safety", slug: "sheriff-public-safety", description: "Public safety information and request routing.", sortOrder: 7, actions: [action("Public safety service information", { actionType: "information_only", sourceUrl: washoeSource })] },
      { name: "Treasurer / Taxes", slug: "treasurer-taxes", description: "Property tax lookup, payment, and treasurer services.", sortOrder: 8, actions: [action("Property tax lookup/payment", { actionType: "payment", sourceUrl: washoeSource, requiresPayment: true })] },
      { name: "Animal Services", slug: "animal-services", description: "Animal services complaints and requests.", sortOrder: 9, actions: [action("Animal services complaint/request", { actionType: "complaint", sourceUrl: washoeSource })] },
      { name: "Parks & Open Space", slug: "parks-open-space", description: "Park and open space service information.", sortOrder: 10, actions: [action("Parks and open space information", { actionType: "information_only", sourceUrl: washoeSource })] },
      { name: "Public Records Requests", slug: "public-records-requests", description: "County public records request workflow.", sortOrder: 11, actions: [action("Request public records", { actionType: "records_request", sourceUrl: washoeSource })] },
      { name: "Board Meetings", slug: "board-meetings", description: "Board meeting agendas, records, and comment workflows.", sortOrder: 12, actions: [action("Board meeting agendas/comments", { actionType: "public_comment", sourceUrl: washoeSource, supportsDocumentIngestion: true })] },
    ],
  }),
  catalog({
    id: "city-of-reno",
    slug: "city-of-reno",
    governmentEntityName: "City of Reno",
    jurisdiction: "Reno, Nevada",
    entityType: "city",
    sourceUrl: renoSource,
    lastReviewedAt: "2026-06-07",
    active: true,
    categories: [
      { name: "Utilities & Billing", slug: "utilities-billing", description: "Utility service and billing workflows.", sortOrder: 1, actions: [action("Start/stop/transfer utility service", { actionType: "form_fill", sourceUrl: renoSource, supportsPdfGeneration: true }), action("Pay utility bill", { actionType: "payment", sourceUrl: renoSource, requiresPayment: true }), action("Report water/sewer issue", { actionType: "report_issue", sourceUrl: renoSource })] },
      { name: "Permits & Licensing", slug: "permits-licensing", description: "Building permit and license workflows.", sortOrder: 2, actions: [action("Apply for building permit", { actionType: "permit_application", sourceUrl: renoSource, supportsDocumentIngestion: true }), action("Apply for business license", { actionType: "filing", sourceUrl: renoSource, supportsPdfGeneration: true })] },
      { name: "Public Works", slug: "public-works", description: "Street, pothole, graffiti, and infrastructure issue reporting.", sortOrder: 3, actions: [action("Report pothole/streetlight/graffiti", { actionType: "report_issue", sourceUrl: renoSource })] },
      { name: "Planning & Development", slug: "planning-development", description: "Planning and development applications.", sortOrder: 4, actions: [action("Submit planning/development application", { actionType: "permit_application", sourceUrl: renoSource, supportsDocumentIngestion: true })] },
      { name: "City Council & Public Comment", slug: "city-council-public-comment", description: "Council meetings, agenda records, and public comment.", sortOrder: 5, actions: [action("Submit public comment", { actionType: "public_comment", sourceUrl: renoSource, supportsDocumentIngestion: true }), action("View council agendas/minutes", { actionType: "information_only", sourceUrl: renoSource })] },
      { name: "Code Enforcement", slug: "code-enforcement", description: "Code enforcement complaints.", sortOrder: 6, actions: [action("Submit code enforcement complaint", { actionType: "complaint", sourceUrl: renoSource })] },
      { name: "Parks & Recreation", slug: "parks-recreation", description: "Parks and facility reservations.", sortOrder: 7, actions: [action("Reserve parks/facilities", { actionType: "appointment", sourceUrl: renoSource })] },
      { name: "Public Records", slug: "public-records", description: "City records request workflows.", sortOrder: 8, actions: [action("Request public records", { actionType: "records_request", sourceUrl: renoSource })] },
      { name: "Police / Public Safety", slug: "police-public-safety", description: "Public safety information and routing.", sortOrder: 9, actions: [action("Police and public safety information", { actionType: "information_only", sourceUrl: renoSource })] },
      { name: "Business Licensing", slug: "business-licensing", description: "Business licensing applications and support.", sortOrder: 10, actions: [action("Apply for business license", { actionType: "filing", sourceUrl: renoSource })] },
    ],
  }),
  catalog({
    id: "carson-city",
    slug: "carson-city",
    governmentEntityName: "Carson City",
    jurisdiction: "Carson City, Nevada",
    entityType: "city",
    sourceUrl: carsonSource,
    lastReviewedAt: "2026-06-07",
    active: true,
    categories: [
      { name: "Building & Permits", slug: "building-permits", description: "Building permit application workflows.", sortOrder: 1, actions: [action("Building permits", { actionType: "permit_application", sourceUrl: carsonSource, supportsDocumentIngestion: true })] },
      { name: "Planning & Development", slug: "planning-development", description: "Planning and land use application workflows.", sortOrder: 2, actions: [action("Land use permit", { actionType: "permit_application", sourceUrl: carsonSource })] },
      { name: "Public Works", slug: "public-works", description: "Public works and infrastructure service requests.", sortOrder: 3, actions: [action("Public Works service request", { actionType: "case_intake", sourceUrl: carsonSource }), action("Pothole report", { actionType: "report_issue", sourceUrl: carsonSource }), action("Street lighting issue", { actionType: "report_issue", sourceUrl: carsonSource }), action("Graffiti report", { actionType: "report_issue", sourceUrl: carsonSource })] },
      { name: "Utilities / Service Requests", slug: "utilities-service-requests", description: "Utility service requests and handoff workflows.", sortOrder: 4, actions: [action("Utility service request", { actionType: "form_fill", sourceUrl: carsonSource, supportsPdfGeneration: true })] },
      { name: "Elections", slug: "elections", description: "Current and past election information.", sortOrder: 5, actions: [action("Elections current/past", { actionType: "information_only", sourceUrl: carsonSource })] },
      { name: "Clerk-Recorder / Records", slug: "clerk-recorder-records", description: "Recorder, deeds, certificates, and marriage services.", sortOrder: 6, actions: [action("Marriage license/certificate", { actionType: "external_link", sourceUrl: carsonSource }), action("Register/records/deeds search", { actionType: "external_link", sourceUrl: carsonSource })] },
      { name: "Board of Supervisors", slug: "board-supervisors", description: "Board records, agendas, minutes, and public comment.", sortOrder: 7, actions: [action("Board agenda/minutes/records", { actionType: "information_only", sourceUrl: carsonSource }), action("Submit public comment", { actionType: "public_comment", sourceUrl: carsonSource, supportsDocumentIngestion: true })] },
      { name: "Courts & Fines", slug: "courts-fines", description: "Court fee and fine payment services.", sortOrder: 8, actions: [action("Court fines and fees", { actionType: "payment", sourceUrl: carsonSource, requiresPayment: true })] },
      { name: "Animal Services", slug: "animal-services", description: "Animal services requests and complaints.", sortOrder: 9, actions: [action("Animal adoption/complaint", { actionType: "complaint", sourceUrl: carsonSource })] },
      { name: "Code Enforcement", slug: "code-enforcement", description: "Code enforcement complaints.", sortOrder: 10, actions: [action("Code enforcement complaint", { actionType: "complaint", sourceUrl: carsonSource })] },
      { name: "Parks & Recreation", slug: "parks-recreation", description: "Parks and recreation reservations.", sortOrder: 11, actions: [action("Parks reservation", { actionType: "appointment", sourceUrl: carsonSource })] },
      { name: "Public Health / Human Services", slug: "public-health-human-services", description: "Public health and human service navigation.", sortOrder: 12, actions: [action("Public health and human services information", { actionType: "information_only", sourceUrl: carsonSource })] },
      { name: "Property / Taxes", slug: "property-taxes", description: "Property and tax payment workflows.", sortOrder: 13, actions: [action("Pay property tax", { actionType: "payment", sourceUrl: carsonSource, requiresPayment: true })] },
      { name: "Sheriff / Public Safety", slug: "sheriff-public-safety", description: "Sheriff and public safety information.", sortOrder: 14, actions: [action("Sheriff and public safety information", { actionType: "information_only", sourceUrl: carsonSource })] },
      { name: "Business / Licensing", slug: "business-licensing", description: "Business license and event permitting.", sortOrder: 15, actions: [action("Business license", { actionType: "filing", sourceUrl: carsonSource }), action("Community event permit", { actionType: "permit_application", sourceUrl: carsonSource })] },
      { name: "Public Records", slug: "public-records", description: "Public records request workflows.", sortOrder: 16, actions: [action("Public records request", { actionType: "records_request", sourceUrl: carsonSource })] },
    ],
  }),
];

export function getServiceCatalogs() {
  return serviceCatalogs.filter((item) => item.active);
}

export function getServiceCatalogBySlug(slug: string) {
  return getServiceCatalogs().find((catalogItem) => catalogItem.slug === slug || catalogItem.id === slug) ?? null;
}

export function getServiceAction(catalogSlug: string, serviceSlug: string) {
  const foundCatalog = getServiceCatalogBySlug(catalogSlug);
  if (!foundCatalog) return null;
  for (const foundCategory of foundCatalog.categories) {
    const foundAction = foundCategory.actions.find((item) => item.slug === serviceSlug || item.id === serviceSlug);
    if (foundAction) return { catalog: foundCatalog, category: foundCategory, action: foundAction };
  }
  return null;
}

export function getServiceActionStatusLabel(actionItem: ServiceAction) {
  if (actionItem.status === "planned") return "Coming soon";
  if (actionItem.supportsPdfGeneration) return "Digital form available";
  if (actionItem.supportsDocumentIngestion) return "PDF upload";
  if (actionItem.supportsExternalSubmission) return "External site";
  if (actionItem.requiresStaffReview) return "Staff review required";
  return "Information";
}
