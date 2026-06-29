import { normalizeWhitespace, slugify, summarizeText } from "@/lib/public-meetings/shared";

export type ResidentStorySubmissionType =
  | "something_happened_to_me"
  | "something_happened_to_loved_one"
  | "public_safety_concern"
  | "infrastructure_or_city_project_concern"
  | "government_service_failure"
  | "court_or_legal_matter"
  | "official_misconduct_or_accountability_concern"
  | "other_civic_concern";

export type ResidentStoryPublicationPreference = "private" | "public_after_review" | "anonymous_after_review";

export type ResidentStoryPublicationStatus =
  | "private_pending_review"
  | "public_after_review_pending"
  | "anonymous_after_review_pending"
  | "private_reviewed"
  | "rejected"
  | "published"
  | "published_anonymous";

export type ResidentStoryVerificationStatus = "unverified_resident_submission" | "source_links_provided" | "documents_uploaded" | "ready_for_review";

export type ResidentStoryReviewStatus = "pending_review" | "reviewed_private" | "approved_public_summary" | "approved_anonymous_summary" | "rejected";

export type ResidentQuestionTargetType = "decision" | "project" | "community" | "meeting_event" | "issue" | "official_body" | "unknown";

export type ResidentQuestionRoutingStatus = "pending" | "needs_source" | "ready_to_send" | "sent_externally" | "answered" | "closed";

export type ResidentQuestionPublicStatus = "received" | "under_review" | "routed_to_body" | "answer_published" | "closed";

export type ResidentQuestionSuggestedRecipientType = "governing_body" | "department" | "official" | "agency" | "unknown";

export type ResidentQuestionRouting = {
  targetType: ResidentQuestionTargetType;
  targetId: string | null;
  topic: string | null;
  community: string | null;
  requestedAgencyOrBody: string | null;
  suggestedRecipientName: string | null;
  suggestedRecipientType: ResidentQuestionSuggestedRecipientType;
  suggestedRecipientSourceUrl: string | null;
  routingReason: string;
  status: ResidentQuestionRoutingStatus;
  publicStatus: ResidentQuestionPublicStatus;
  reviewerNotes: string | null;
  answerSummary: string | null;
  updatedAt: string | null;
};

export type ResidentStoryPublicSummary = {
  id: string;
  title: string;
  summary: string;
  whyItMatters: string;
  submissionType: ResidentStorySubmissionType;
  location: string | null;
  approximateDate: string | null;
  sourceStatus: "resident_submission_reviewed" | "resident_submission_with_sources_reviewed";
  publicationStatus: "published" | "published_anonymous";
  publishedAt: string;
};

export type ResidentQuestionAnswerSummary = {
  id: string;
  questionTitle: string;
  answerSummary: string;
  targetType: ResidentQuestionTargetType;
  targetId: string | null;
  community: string | null;
  recipientName: string | null;
  recipientType: ResidentQuestionSuggestedRecipientType;
  sourceUrl: string | null;
  sourceStatus: "reviewed_routing_answer";
  publicStatus: Extract<ResidentQuestionPublicStatus, "answer_published">;
  publishedAt: string;
};

export type ResidentStoryIntake = {
  id: string;
  submitterUserId: string | null;
  submitterDisplayName: string | null;
  submissionType: ResidentStorySubmissionType;
  story: string;
  location: string | null;
  approximateDate: string | null;
  peopleOrEntitiesInvolved: string[];
  links: string[];
  uploadedDocumentNames: string[];
  publicationPreference: ResidentStoryPublicationPreference;
  publicationStatus: ResidentStoryPublicationStatus;
  verificationStatus: ResidentStoryVerificationStatus;
  safety: {
    containsPersonalData: boolean;
    containsAllegation: boolean;
    involvesMinor: boolean;
    involvesLegalMatter: boolean;
  };
  reviewerNotes: string | null;
  review: {
    status: ResidentStoryReviewStatus;
    reviewedAt: string | null;
    reviewedBy: string | null;
    reviewerNotes: string | null;
    rejectionReason: string | null;
    publicSummary: ResidentStoryPublicSummary | null;
  };
  routing: ResidentQuestionRouting;
  moderationSummary: string;
  createdAt: string;
};

const SUBMISSION_TYPES = new Set<ResidentStorySubmissionType>([
  "something_happened_to_me",
  "something_happened_to_loved_one",
  "public_safety_concern",
  "infrastructure_or_city_project_concern",
  "government_service_failure",
  "court_or_legal_matter",
  "official_misconduct_or_accountability_concern",
  "other_civic_concern",
]);

const TARGET_TYPES = new Set<ResidentQuestionTargetType>(["decision", "project", "community", "meeting_event", "issue", "official_body", "unknown"]);

export const RESIDENT_QUESTION_ROUTING_STATUSES: ResidentQuestionRoutingStatus[] = [
  "pending",
  "needs_source",
  "ready_to_send",
  "sent_externally",
  "answered",
  "closed",
];

export const RESIDENT_QUESTION_PUBLIC_STATUSES: ResidentQuestionPublicStatus[] = ["received", "under_review", "routed_to_body", "answer_published", "closed"];

export const RESIDENT_QUESTION_RECIPIENT_TYPES: ResidentQuestionSuggestedRecipientType[] = ["governing_body", "department", "official", "agency", "unknown"];

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? normalizeWhitespace(value) : "";
}

function stringArray(value: string) {
  return value
    .split(/\n|,/)
    .map(normalizeWhitespace)
    .filter(Boolean)
    .slice(0, 30);
}

function urlArray(value: string) {
  return stringArray(value).filter((candidate) => {
    try {
      const url = new URL(candidate);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  });
}

function uploadedDocumentNames(formData: FormData) {
  return formData
    .getAll("documents")
    .flatMap((value) => (typeof File !== "undefined" && value instanceof File && value.name ? [value.name] : []))
    .slice(0, 20);
}

function publicationStatusFor(preference: ResidentStoryPublicationPreference): ResidentStoryPublicationStatus {
  if (preference === "anonymous_after_review") return "anonymous_after_review_pending";
  if (preference === "public_after_review") return "public_after_review_pending";
  return "private_pending_review";
}

function verificationStatusFor(links: string[], documents: string[]): ResidentStoryVerificationStatus {
  if (links.length && documents.length) return "ready_for_review";
  if (documents.length) return "documents_uploaded";
  if (links.length) return "source_links_provided";
  return "unverified_resident_submission";
}

function routingTargetTypeFor(value: string, submissionType: ResidentStorySubmissionType, agency: string, community: string): ResidentQuestionTargetType {
  if (TARGET_TYPES.has(value as ResidentQuestionTargetType)) return value as ResidentQuestionTargetType;
  if (agency) return "official_body";
  if (community) return "community";
  if (submissionType === "infrastructure_or_city_project_concern") return "project";
  return "unknown";
}

function suggestedRecipientTypeFor(targetType: ResidentQuestionTargetType, agency: string): ResidentQuestionSuggestedRecipientType {
  if (targetType === "official_body") return "governing_body";
  if (targetType === "community") return "agency";
  if (targetType === "project" && agency) return "department";
  if (agency) return "agency";
  return "unknown";
}

function routingReasonFor(routing: Pick<ResidentQuestionRouting, "targetType" | "topic" | "community" | "requestedAgencyOrBody" | "suggestedRecipientName">) {
  if (routing.targetType === "decision" && routing.topic) {
    return "Routed from a specific citizen decision page so reviewers can connect the question to the source-backed decision record.";
  }
  if (routing.targetType === "project" && routing.topic) {
    return "Routed from a project page so reviewers can connect the question to the responsible body and related source-backed project record.";
  }
  if (routing.targetType === "community" && routing.community) {
    return "Routed from a community hub so reviewers can connect the question to the resident's local civic context.";
  }
  if (routing.requestedAgencyOrBody) {
    return "Routed from a submitted agency/body context. A reviewer should confirm the appropriate recipient before any external send.";
  }
  return "Needs reviewer routing because no source-backed target was provided with the submission.";
}

export function buildResidentQuestionRoutingFromFormData(
  formData: FormData,
  submissionType: ResidentStorySubmissionType,
  links: string[],
): ResidentQuestionRouting {
  const topic = stringValue(formData, "routingTopic") || stringValue(formData, "topic") || null;
  const agency = stringValue(formData, "routingAgency") || stringValue(formData, "agency") || null;
  const community = stringValue(formData, "routingCommunity") || stringValue(formData, "community") || null;
  const targetType = routingTargetTypeFor(stringValue(formData, "routingTargetType"), submissionType, agency ?? "", community ?? "");
  const suggestedRecipientName = agency || community || null;
  const routing: ResidentQuestionRouting = {
    targetType,
    targetId: stringValue(formData, "routingTargetId") || null,
    topic,
    community,
    requestedAgencyOrBody: agency,
    suggestedRecipientName,
    suggestedRecipientType: suggestedRecipientTypeFor(targetType, agency ?? ""),
    suggestedRecipientSourceUrl: links[0] ?? null,
    routingReason: "",
    status: "pending",
    publicStatus: "received",
    reviewerNotes: null,
    answerSummary: null,
    updatedAt: null,
  };
  return {
    ...routing,
    routingReason: routingReasonFor(routing),
  };
}

function safetyFlags(story: string, submissionType: ResidentStorySubmissionType) {
  const text = story.toLowerCase();
  return {
    containsPersonalData: /\b(address|phone|email|medical|diagnosis|ssn|social security|date of birth|dob)\b/.test(text),
    containsAllegation:
      /\b(misconduct|corrupt|illegal|harass|assault|abuse|threat|retaliat|discriminat|negligent|lied|stole|fraud)\b/.test(text) ||
      submissionType === "official_misconduct_or_accountability_concern",
    involvesMinor: /\b(child|minor|student|underage|juvenile|kid)\b/.test(text),
    involvesLegalMatter: /\b(court|case|lawsuit|judge|attorney|arrest|charged|eviction|custody|legal)\b/.test(text) || submissionType === "court_or_legal_matter",
  };
}

export function residentSubmissionTypeLabel(type: ResidentStorySubmissionType) {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function residentQuestionRoutingStatusLabel(status: ResidentQuestionRoutingStatus) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function residentQuestionPublicStatusLabel(status: ResidentQuestionPublicStatus) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function publicTitleForResidentQuestionAnswer(record: Pick<ResidentStoryIntake, "submissionType" | "location" | "routing">) {
  if (record.routing.topic) return summarizeText(record.routing.topic, 120);
  if (record.routing.targetType !== "unknown") return summarizeText(`Resident question about ${record.routing.targetType.replace(/_/g, " ")}`, 120);
  const location = record.location ? ` in ${record.location}` : "";
  return summarizeText(`Resident question${location}`, 120);
}

export function buildResidentQuestionAnswerSummary(record: ResidentStoryIntake): ResidentQuestionAnswerSummary | null {
  if (record.routing.publicStatus !== "answer_published" || !record.routing.answerSummary) return null;
  return {
    id: `answer-${record.id}`,
    questionTitle: publicTitleForResidentQuestionAnswer(record),
    answerSummary: summarizeText(record.routing.answerSummary, 640),
    targetType: record.routing.targetType,
    targetId: record.routing.targetId,
    community: record.routing.community ?? record.location,
    recipientName: record.routing.suggestedRecipientName,
    recipientType: record.routing.suggestedRecipientType,
    sourceUrl: record.routing.suggestedRecipientSourceUrl,
    sourceStatus: "reviewed_routing_answer",
    publicStatus: "answer_published",
    publishedAt: record.routing.updatedAt ?? new Date().toISOString(),
  };
}

export function normalizeResidentStoryIntake(record: ResidentStoryIntake): ResidentStoryIntake {
  const baseRecord = {
    ...record,
    submitterUserId: record.submitterUserId ?? null,
    submitterDisplayName: record.submitterDisplayName ?? null,
  };
  if (baseRecord.routing) return baseRecord;
  const community = record.location ?? null;
  const targetType: ResidentQuestionTargetType = community ? "community" : "unknown";
  const routing: ResidentQuestionRouting = {
    targetType,
    targetId: null,
    topic: residentSubmissionTypeLabel(record.submissionType),
    community,
    requestedAgencyOrBody: record.peopleOrEntitiesInvolved[0] ?? null,
    suggestedRecipientName: record.peopleOrEntitiesInvolved[0] ?? community,
    suggestedRecipientType: record.peopleOrEntitiesInvolved[0] ? "agency" : community ? "agency" : "unknown",
    suggestedRecipientSourceUrl: record.links[0] ?? null,
    routingReason: "Added by normalization for a submission created before resident question routing existed. Reviewer should confirm the target before external use.",
    status: "pending",
    publicStatus: "received",
    reviewerNotes: null,
    answerSummary: null,
    updatedAt: null,
  };
  return {
    ...baseRecord,
    routing,
  };
}

export function publicTitleForResidentStory(intake: Pick<ResidentStoryIntake, "submissionType" | "location" | "story">) {
  const location = intake.location ? ` in ${intake.location}` : "";
  const type = residentSubmissionTypeLabel(intake.submissionType).toLowerCase();
  return summarizeText(`Resident-reported ${type}${location}`, 96);
}

export function publicWhyItMattersForResidentStory(intake: Pick<ResidentStoryIntake, "submissionType" | "safety">) {
  if (intake.safety.involvesLegalMatter) {
    return "This may help reviewers identify public records, agency responsibilities, and whether a public court or legal-process record exists.";
  }
  if (intake.safety.containsAllegation) {
    return "This contains an allegation, so it needs source review before any public-facing summary can be trusted.";
  }
  if (intake.submissionType === "government_service_failure") {
    return "Service failures can reveal patterns residents may need to understand, but individual details stay private unless reviewed.";
  }
  if (intake.submissionType === "infrastructure_or_city_project_concern") {
    return "Infrastructure concerns may connect to meetings, budgets, projects, or agency maintenance responsibilities.";
  }
  return "Resident submissions can point reviewers toward civic records without becoming public fact on their own.";
}

export function defaultRedactedResidentStorySummary(intake: Pick<ResidentStoryIntake, "submissionType" | "location" | "approximateDate" | "verificationStatus">) {
  const type = residentSubmissionTypeLabel(intake.submissionType).toLowerCase();
  const place = intake.location ? ` in ${intake.location}` : "";
  const timeframe = intake.approximateDate ? ` around ${intake.approximateDate}` : "";
  const sourceNote =
    intake.verificationStatus === "unverified_resident_submission"
      ? "No independent public source has been attached yet."
      : "The resident supplied source material for reviewer follow-up.";
  return `A resident submitted a ${type}${place}${timeframe}. ${sourceNote} This summary is redacted and does not publish the raw submission.`;
}

export function buildResidentStoryPublicSummary(
  intake: ResidentStoryIntake,
  options: {
    status: Extract<ResidentStoryReviewStatus, "approved_public_summary" | "approved_anonymous_summary">;
    reviewerTitle?: string;
    reviewerSummary?: string;
    reviewedAt: string;
  },
): ResidentStoryPublicSummary {
  const publicationStatus = options.status === "approved_anonymous_summary" ? "published_anonymous" : "published";
  return {
    id: `public-${intake.id}`,
    title: summarizeText(normalizeWhitespace(options.reviewerTitle) || publicTitleForResidentStory(intake), 120),
    summary: summarizeText(normalizeWhitespace(options.reviewerSummary) || defaultRedactedResidentStorySummary(intake), 480),
    whyItMatters: publicWhyItMattersForResidentStory(intake),
    submissionType: intake.submissionType,
    location: intake.location,
    approximateDate: intake.approximateDate,
    sourceStatus: intake.verificationStatus === "unverified_resident_submission" ? "resident_submission_reviewed" : "resident_submission_with_sources_reviewed",
    publicationStatus,
    publishedAt: options.reviewedAt,
  };
}

export function buildResidentStoryIntakeFromFormData(
  formData: FormData,
  now = new Date(),
  submitter?: {
    userId?: string | null;
    displayName?: string | null;
  },
): ResidentStoryIntake {
  const rawType = stringValue(formData, "submissionType") as ResidentStorySubmissionType;
  const submissionType = SUBMISSION_TYPES.has(rawType) ? rawType : "other_civic_concern";
  const publicationPreference = (stringValue(formData, "publicationPreference") || "private") as ResidentStoryPublicationPreference;
  const story = stringValue(formData, "story");
  const location = stringValue(formData, "location") || null;
  const approximateDate = stringValue(formData, "approximateDate") || null;
  const peopleOrEntitiesInvolved = stringArray(stringValue(formData, "peopleOrEntitiesInvolved"));
  const links = urlArray(stringValue(formData, "links"));
  const uploadedDocumentNamesValue = uploadedDocumentNames(formData);
  const createdAt = now.toISOString();
  const routing = buildResidentQuestionRoutingFromFormData(formData, submissionType, links);

  return {
    id: `resident-story-${slugify(`${submissionType}-${location ?? "unknown"}-${createdAt}`).slice(0, 96)}`,
    submitterUserId: submitter?.userId ?? null,
    submitterDisplayName: submitter?.displayName ?? null,
    submissionType,
    story,
    location,
    approximateDate,
    peopleOrEntitiesInvolved,
    links,
    uploadedDocumentNames: uploadedDocumentNamesValue,
    publicationPreference,
    publicationStatus: publicationStatusFor(publicationPreference),
    verificationStatus: verificationStatusFor(links, uploadedDocumentNamesValue),
    safety: safetyFlags(story, submissionType),
    reviewerNotes: null,
    review: {
      status: "pending_review",
      reviewedAt: null,
      reviewedBy: null,
      reviewerNotes: null,
      rejectionReason: null,
      publicSummary: null,
    },
    routing,
    moderationSummary: summarizeText(story, 360),
    createdAt,
  };
}

export function validateResidentStoryIntakeShape(intake: ResidentStoryIntake) {
  const errors: string[] = [];
  if (!intake.id) errors.push("id is required");
  if (!intake.story || intake.story.length < 20) errors.push("story must be at least 20 characters");
  if (intake.publicationStatus !== "private_pending_review" && intake.publicationPreference === "private") {
    errors.push("private submissions must default to private_pending_review");
  }
  if (!intake.verificationStatus) errors.push("verificationStatus is required");
  if (!intake.safety) errors.push("safety flags are required");
  if (intake.reviewerNotes !== null) errors.push("reviewerNotes should default to null");
  if (!intake.review || intake.review.status !== "pending_review") errors.push("review.status must default to pending_review");
  if (intake.review?.publicSummary !== null) errors.push("review.publicSummary should default to null");
  if (!intake.routing) errors.push("routing is required");
  if (intake.routing && intake.routing.status !== "pending") errors.push("routing.status must default to pending");
  if (intake.routing && intake.routing.publicStatus !== "received") errors.push("routing.publicStatus must default to received");
  return errors;
}
