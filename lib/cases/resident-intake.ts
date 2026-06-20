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

export type ResidentStoryPublicationStatus = "private_pending_review" | "public_after_review_pending" | "anonymous_after_review_pending" | "rejected" | "published";

export type ResidentStoryVerificationStatus = "unverified_resident_submission" | "source_links_provided" | "documents_uploaded" | "ready_for_review";

export type ResidentStoryIntake = {
  id: string;
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

export function buildResidentStoryIntakeFromFormData(formData: FormData, now = new Date()): ResidentStoryIntake {
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

  return {
    id: `resident-story-${slugify(`${submissionType}-${location ?? "unknown"}-${createdAt}`).slice(0, 96)}`,
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
  return errors;
}
