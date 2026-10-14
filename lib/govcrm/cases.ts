export type GovCaseStatus =
  | "new"
  | "triage"
  | "in_progress"
  | "waiting_on_resident"
  | "waiting_on_department"
  | "ready_for_response"
  | "resolved"
  | "closed";

export type GovCasePriority = "low" | "normal" | "high" | "urgent";

export type GovCaseSource = "resident_portal" | "public_comment" | "staff_created" | "phone" | "email" | "document_intake" | "direct_democracy_reference";

export type GovCaseVisibility = "internal_private" | "resident_visible_draft" | "public_response_candidate" | "published_public_response";

export type GovCaseAssignment = {
  department: string;
  team: string;
  assigneeId: string | null;
  assigneeName: string | null;
  assignedAt: string | null;
  dueAt: string | null;
};

export type GovCaseNote = {
  id: string;
  caseId: string;
  authorName: string;
  authorRole: "government_staff" | "government_admin" | "platform_admin";
  body: string;
  visibility: "internal_private";
  createdAt: string;
};

export type GovCaseMessage = {
  id: string;
  caseId: string;
  authorName: string;
  authorType: "resident" | "staff";
  body: string;
  visibility: "resident_visible" | "internal_private";
  deliveryStatus: "draft_only" | "received" | "disabled";
  createdAt: string;
};

export type GovCaseAuditEntry = {
  id: string;
  caseId: string;
  actorName: string;
  actorType: "system" | "government_staff" | "government_admin";
  action: string;
  details: string;
  createdAt: string;
};

export type GovCaseSubmitter = {
  displayName: string;
  contactLabel: string;
  residencySignal: "unverified" | "verified_resident" | "verified_voter" | "unknown";
  preferredContactMethod: "portal" | "phone" | "email" | "none";
};

export type GovCasePublicRecordLink = {
  id: string;
  label: string;
  href: string;
  recordType: "issue" | "meeting" | "vote_question" | "petition" | "public_case" | "official";
  sourceNote: string;
  readOnly: true;
};

export type GovCase = {
  id: string;
  publicTrackingCode: string;
  title: string;
  summary: string;
  status: GovCaseStatus;
  priority: GovCasePriority;
  source: GovCaseSource;
  visibility: GovCaseVisibility;
  jurisdiction: string;
  governmentEntityName: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  assignment: GovCaseAssignment;
  submitter: GovCaseSubmitter;
  intakeSummary: string;
  officialResponseDraft: string;
  officialResponseStatus: "not_started" | "draft_internal_only" | "ready_for_review" | "disabled";
  linkedPublicRecords: GovCasePublicRecordLink[];
  notes: GovCaseNote[];
  messages: GovCaseMessage[];
  auditTrail: GovCaseAuditEntry[];
};

export type GovCaseFilters = {
  status?: GovCaseStatus;
  priority?: GovCasePriority;
  department?: string;
  assignee?: string;
  source?: GovCaseSource;
  overdue?: "true";
};

const fixtureCases: GovCase[] = [
  {
    id: "govcase-reno-pw-1001",
    publicTrackingCode: "RNO-PW-1001",
    title: "Repeated sidewalk obstruction near senior housing",
    summary: "Resident reports that a temporary construction staging area is blocking the accessible sidewalk path near a senior housing building.",
    status: "in_progress",
    priority: "high",
    source: "resident_portal",
    visibility: "internal_private",
    jurisdiction: "Reno, Nevada",
    governmentEntityName: "City of Reno",
    category: "Public Works",
    createdAt: "2026-06-15T16:20:00.000Z",
    updatedAt: "2026-06-20T18:30:00.000Z",
    lastActivityAt: "2026-06-20T18:30:00.000Z",
    assignment: {
      department: "Public Works",
      team: "Right-of-way",
      assigneeId: "staff-maya-chen",
      assigneeName: "Maya Chen",
      assignedAt: "2026-06-16T09:10:00.000Z",
      dueAt: "2026-06-21T23:59:00.000Z",
    },
    submitter: {
      displayName: "Resident submitter",
      contactLabel: "Portal contact on file",
      residencySignal: "verified_resident",
      preferredContactMethod: "portal",
    },
    intakeSummary: "Fixture case created inside GovCRM only. It is not a public Direct Democracy issue and does not create or alter a public vote.",
    officialResponseDraft: "Draft response pending site confirmation by Public Works. Publishing is disabled in this prototype.",
    officialResponseStatus: "draft_internal_only",
    linkedPublicRecords: [
      {
        id: "public-issue-sidewalk-access",
        label: "Public issue hub: Transportation",
        href: "/issues",
        recordType: "issue",
        sourceNote: "Read-only public civic context. GovCRM cannot edit public issue records.",
        readOnly: true,
      },
      {
        id: "public-voting-transportation",
        label: "Public vote questions: local infrastructure",
        href: "/voting",
        recordType: "vote_question",
        sourceNote: "Read-only civic signal context. Case status does not sync to public vote results.",
        readOnly: true,
      },
    ],
    notes: [
      {
        id: "note-reno-pw-1001-1",
        caseId: "govcase-reno-pw-1001",
        authorName: "Maya Chen",
        authorRole: "government_staff",
        body: "Inspector asked contractor for updated pedestrian routing plan. Need photo confirmation before drafting response.",
        visibility: "internal_private",
        createdAt: "2026-06-20T18:30:00.000Z",
      },
    ],
    messages: [
      {
        id: "message-reno-pw-1001-1",
        caseId: "govcase-reno-pw-1001",
        authorName: "Resident submitter",
        authorType: "resident",
        body: "The blocked section is still difficult for mobility devices during the afternoon.",
        visibility: "resident_visible",
        deliveryStatus: "received",
        createdAt: "2026-06-15T16:20:00.000Z",
      },
      {
        id: "message-reno-pw-1001-2",
        caseId: "govcase-reno-pw-1001",
        authorName: "Maya Chen",
        authorType: "staff",
        body: "Draft acknowledgement prepared, but sending is disabled until GovCRM messaging is enabled.",
        visibility: "internal_private",
        deliveryStatus: "draft_only",
        createdAt: "2026-06-16T09:18:00.000Z",
      },
    ],
    auditTrail: [
      {
        id: "audit-reno-pw-1001-1",
        caseId: "govcase-reno-pw-1001",
        actorName: "GovCRM fixture loader",
        actorType: "system",
        action: "case_created",
        details: "Internal fixture case created without public civic record mutation.",
        createdAt: "2026-06-15T16:20:00.000Z",
      },
      {
        id: "audit-reno-pw-1001-2",
        caseId: "govcase-reno-pw-1001",
        actorName: "GovCRM fixture loader",
        actorType: "system",
        action: "assigned",
        details: "Assigned to Public Works / Right-of-way.",
        createdAt: "2026-06-16T09:10:00.000Z",
      },
    ],
  },
  {
    id: "govcase-washoe-hhs-2042",
    publicTrackingCode: "WSH-HHS-2042",
    title: "Question about foster youth services agenda item",
    summary: "Public commenter asked which department owns follow-up for a county agenda item mentioning former foster youth support services.",
    status: "waiting_on_department",
    priority: "normal",
    source: "public_comment",
    visibility: "resident_visible_draft",
    jurisdiction: "Washoe County, Nevada",
    governmentEntityName: "Washoe County",
    category: "Human Services",
    createdAt: "2026-06-12T21:40:00.000Z",
    updatedAt: "2026-06-19T15:05:00.000Z",
    lastActivityAt: "2026-06-19T15:05:00.000Z",
    assignment: {
      department: "Human Services",
      team: "Resident Support",
      assigneeId: "staff-eli-morgan",
      assigneeName: "Eli Morgan",
      assignedAt: "2026-06-13T10:00:00.000Z",
      dueAt: "2026-06-18T23:59:00.000Z",
    },
    submitter: {
      displayName: "Public commenter",
      contactLabel: "No private contact shown in demo",
      residencySignal: "unknown",
      preferredContactMethod: "none",
    },
    intakeSummary: "This case references a public meeting record only as context. Staff notes and routing remain private GovCRM tenant data.",
    officialResponseDraft: "Draft response should explain the owning department and point to the public agenda source once reviewed.",
    officialResponseStatus: "draft_internal_only",
    linkedPublicRecords: [
      {
        id: "public-vote-foster-youth",
        label: "Public voting records mentioning foster youth services",
        href: "/voting",
        recordType: "vote_question",
        sourceNote: "Read-only public meeting/vote context. GovCRM cannot edit the generated voting card.",
        readOnly: true,
      },
      {
        id: "public-meetings-washoe",
        label: "Public meetings",
        href: "/communities/washoe-county",
        recordType: "meeting",
        sourceNote: "Read-only community meeting intelligence if available.",
        readOnly: true,
      },
    ],
    notes: [
      {
        id: "note-washoe-hhs-2042-1",
        caseId: "govcase-washoe-hhs-2042",
        authorName: "Eli Morgan",
        authorRole: "government_staff",
        body: "Need confirmation from department liaison before any official wording is marked ready for review.",
        visibility: "internal_private",
        createdAt: "2026-06-19T15:05:00.000Z",
      },
    ],
    messages: [
      {
        id: "message-washoe-hhs-2042-1",
        caseId: "govcase-washoe-hhs-2042",
        authorName: "Public commenter",
        authorType: "resident",
        body: "Can the county clarify who residents should contact about the program referenced in the agenda?",
        visibility: "resident_visible",
        deliveryStatus: "received",
        createdAt: "2026-06-12T21:40:00.000Z",
      },
    ],
    auditTrail: [
      {
        id: "audit-washoe-hhs-2042-1",
        caseId: "govcase-washoe-hhs-2042",
        actorName: "GovCRM fixture loader",
        actorType: "system",
        action: "case_created",
        details: "Public comment copied into internal workflow fixture without status syncing.",
        createdAt: "2026-06-12T21:40:00.000Z",
      },
    ],
  },
  {
    id: "govcase-carson-clerk-1188",
    publicTrackingCode: "CC-CLK-1188",
    title: "Records request intake needs routing",
    summary: "Staff-created intake for a public records request that needs routing between Clerk-Recorder and Board records staff.",
    status: "triage",
    priority: "urgent",
    source: "staff_created",
    visibility: "internal_private",
    jurisdiction: "Carson City, Nevada",
    governmentEntityName: "Carson City",
    category: "Public Records",
    createdAt: "2026-06-19T22:10:00.000Z",
    updatedAt: "2026-06-20T20:00:00.000Z",
    lastActivityAt: "2026-06-20T20:00:00.000Z",
    assignment: {
      department: "Clerk-Recorder",
      team: "Records",
      assigneeId: null,
      assigneeName: null,
      assignedAt: null,
      dueAt: "2026-06-20T23:59:00.000Z",
    },
    submitter: {
      displayName: "Requester",
      contactLabel: "Staff intake only",
      residencySignal: "unknown",
      preferredContactMethod: "email",
    },
    intakeSummary: "Fixture record demonstrates routing and overdue handling. No email sending or external request submission is enabled.",
    officialResponseDraft: "",
    officialResponseStatus: "not_started",
    linkedPublicRecords: [
      {
        id: "public-carson-board-records",
        label: "Carson City board records context",
        href: "/gov/public/carson-city",
        recordType: "meeting",
        sourceNote: "Internal GovCRM service catalog preview, not a public publication action.",
        readOnly: true,
      },
    ],
    notes: [
      {
        id: "note-carson-clerk-1188-1",
        caseId: "govcase-carson-clerk-1188",
        authorName: "Records intake",
        authorRole: "government_staff",
        body: "Needs owner assignment before due date review can proceed.",
        visibility: "internal_private",
        createdAt: "2026-06-20T20:00:00.000Z",
      },
    ],
    messages: [],
    auditTrail: [
      {
        id: "audit-carson-clerk-1188-1",
        caseId: "govcase-carson-clerk-1188",
        actorName: "GovCRM fixture loader",
        actorType: "system",
        action: "case_created",
        details: "Staff-created internal case fixture.",
        createdAt: "2026-06-19T22:10:00.000Z",
      },
    ],
  },
  {
    id: "govcase-nvsos-elec-3305",
    publicTrackingCode: "SOS-ELEC-3305",
    title: "Candidate filing guidance request",
    summary: "Portal question about which public filing guide applies to a non-judicial candidate filing.",
    status: "ready_for_response",
    priority: "low",
    source: "resident_portal",
    visibility: "public_response_candidate",
    jurisdiction: "Nevada",
    governmentEntityName: "Nevada Secretary of State",
    category: "Elections",
    createdAt: "2026-06-10T18:05:00.000Z",
    updatedAt: "2026-06-18T19:15:00.000Z",
    lastActivityAt: "2026-06-18T19:15:00.000Z",
    assignment: {
      department: "Elections",
      team: "Candidate Services",
      assigneeId: "staff-nora-patel",
      assigneeName: "Nora Patel",
      assignedAt: "2026-06-11T08:30:00.000Z",
      dueAt: "2026-06-24T23:59:00.000Z",
    },
    submitter: {
      displayName: "Verified voter submitter",
      contactLabel: "Portal contact on file",
      residencySignal: "verified_voter",
      preferredContactMethod: "portal",
    },
    intakeSummary: "This fixture shows a low-risk informational response candidate. It does not create an official voter verification flow.",
    officialResponseDraft: "Direct the submitter to the official Secretary of State candidate filing resources and recommend confirming deadlines with the elections division.",
    officialResponseStatus: "ready_for_review",
    linkedPublicRecords: [
      {
        id: "public-candidates",
        label: "Public candidate directory",
        href: "/candidates",
        recordType: "official",
        sourceNote: "Read-only public candidate profile context.",
        readOnly: true,
      },
      {
        id: "public-elections",
        label: "Public elections hub",
        href: "/elections",
        recordType: "issue",
        sourceNote: "Read-only election information; case response cannot modify election records.",
        readOnly: true,
      },
    ],
    notes: [
      {
        id: "note-nvsos-elec-3305-1",
        caseId: "govcase-nvsos-elec-3305",
        authorName: "Nora Patel",
        authorRole: "government_staff",
        body: "Response is informational only. Avoid giving legal advice or implying eligibility determination.",
        visibility: "internal_private",
        createdAt: "2026-06-18T19:15:00.000Z",
      },
    ],
    messages: [
      {
        id: "message-nvsos-elec-3305-1",
        caseId: "govcase-nvsos-elec-3305",
        authorName: "Verified voter submitter",
        authorType: "resident",
        body: "I am trying to understand which filing guide applies before I contact the office.",
        visibility: "resident_visible",
        deliveryStatus: "received",
        createdAt: "2026-06-10T18:05:00.000Z",
      },
    ],
    auditTrail: [
      {
        id: "audit-nvsos-elec-3305-1",
        caseId: "govcase-nvsos-elec-3305",
        actorName: "GovCRM fixture loader",
        actorType: "system",
        action: "case_created",
        details: "Resident portal fixture case created.",
        createdAt: "2026-06-10T18:05:00.000Z",
      },
      {
        id: "audit-nvsos-elec-3305-2",
        caseId: "govcase-nvsos-elec-3305",
        actorName: "Nora Patel",
        actorType: "government_staff",
        action: "response_drafted",
        details: "Official response marked ready for internal review only.",
        createdAt: "2026-06-18T19:15:00.000Z",
      },
    ],
  },
];

export const GOV_CASE_STATUS_LABELS: Record<GovCaseStatus, string> = {
  new: "New",
  triage: "Triage",
  in_progress: "In progress",
  waiting_on_resident: "Waiting on resident",
  waiting_on_department: "Waiting on department",
  ready_for_response: "Ready for response",
  resolved: "Resolved",
  closed: "Closed",
};

export const GOV_CASE_PRIORITY_LABELS: Record<GovCasePriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const GOV_CASE_SOURCE_LABELS: Record<GovCaseSource, string> = {
  resident_portal: "Resident portal",
  public_comment: "Public comment",
  staff_created: "Staff created",
  phone: "Phone",
  email: "Email",
  document_intake: "Document intake",
  direct_democracy_reference: "Direct Democracy reference",
};

export const GOV_CASE_VISIBILITY_LABELS: Record<GovCaseVisibility, string> = {
  internal_private: "Internal/private",
  resident_visible_draft: "Resident-visible draft",
  public_response_candidate: "Public response candidate",
  published_public_response: "Published public response",
};

export function getGovCases() {
  return fixtureCases;
}

export function getGovCase(caseId: string) {
  return fixtureCases.find((caseItem) => caseItem.id === caseId || caseItem.publicTrackingCode.toLowerCase() === caseId.toLowerCase()) ?? null;
}

export function isGovCaseOverdue(caseItem: GovCase, now = new Date("2026-06-21T12:00:00.000Z")) {
  if (!caseItem.assignment.dueAt || ["resolved", "closed"].includes(caseItem.status)) return false;
  return new Date(caseItem.assignment.dueAt).getTime() < now.getTime();
}

export function filterGovCases(cases: GovCase[], filters: GovCaseFilters) {
  return cases.filter((caseItem) => {
    if (filters.status && caseItem.status !== filters.status) return false;
    if (filters.priority && caseItem.priority !== filters.priority) return false;
    if (filters.department && caseItem.assignment.department !== filters.department) return false;
    if (filters.assignee) {
      if (filters.assignee === "unassigned" && caseItem.assignment.assigneeName) return false;
      if (filters.assignee !== "unassigned" && caseItem.assignment.assigneeName !== filters.assignee) return false;
    }
    if (filters.source && caseItem.source !== filters.source) return false;
    if (filters.overdue === "true" && !isGovCaseOverdue(caseItem)) return false;
    return true;
  });
}

export function getGovCaseFilterOptions(cases = fixtureCases) {
  return {
    statuses: Object.keys(GOV_CASE_STATUS_LABELS) as GovCaseStatus[],
    priorities: Object.keys(GOV_CASE_PRIORITY_LABELS) as GovCasePriority[],
    sources: Object.keys(GOV_CASE_SOURCE_LABELS) as GovCaseSource[],
    departments: Array.from(new Set(cases.map((caseItem) => caseItem.assignment.department))).sort(),
    assignees: Array.from(new Set(cases.map((caseItem) => caseItem.assignment.assigneeName).filter((value): value is string => Boolean(value)))).sort(),
  };
}
