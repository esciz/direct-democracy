export type CitizenCaseLeadStatus = "pending_review" | "source_search" | "verified_public_record" | "rejected_private_or_sensitive";

export type CitizenCaseLeadSubmission = {
  id: string;
  submittedAt: string;
  status: CitizenCaseLeadStatus;
  caseNumber: string | null;
  courtName: string | null;
  jurisdictionName: string | null;
  optionalDescription: string | null;
  publicSourceUrl: string | null;
  sourceVerificationRequired: true;
  publishPlainEnglishSummary: false;
  sensitiveDataScreeningRequired: true;
  notes: string | null;
};

export type CitizenCaseLeadIntakeFile = {
  schemaVersion: 1;
  intakeStatus: "architecture_ready_no_public_upload";
  workflow: string[];
  submissions: CitizenCaseLeadSubmission[];
};
