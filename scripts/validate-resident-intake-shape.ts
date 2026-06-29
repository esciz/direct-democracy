import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildResidentQuestionAnswerSummary,
  buildResidentStoryIntakeFromFormData,
  buildResidentStoryPublicSummary,
  publicTitleForResidentStory,
  publicWhyItMattersForResidentStory,
  validateResidentStoryIntakeShape,
} from "@/lib/cases/resident-intake";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const AUDIT_OUTPUT_PATH = path.join(GENERATED_DIR, "resident-intake-shape-audit.json");
const RUNTIME_OUTPUT_PATH = path.join(GENERATED_DIR, "resident-civic-intake-runtime.json");
const ANSWERS_RUNTIME_OUTPUT_PATH = path.join(GENERATED_DIR, "resident-question-answers-runtime.json");

const fixture = new FormData();
fixture.set("submissionType", "government_service_failure");
fixture.set(
  "story",
  "I tried to get a city service resolved for several weeks, but the agency did not respond and I need help understanding which public body is responsible.",
);
fixture.set("location", "Reno, Nevada");
fixture.set("approximateDate", "Spring 2026");
fixture.set("peopleOrEntitiesInvolved", "City service department");
fixture.set("links", "https://www.reno.gov/");
fixture.set("publicationPreference", "private");
fixture.set("routingTargetType", "community");
fixture.set("routingTargetId", "reno");
fixture.set("routingTopic", "City service response");
fixture.set("routingAgency", "Reno City Council");
fixture.set("routingCommunity", "Reno, Nevada");

const intake = buildResidentStoryIntakeFromFormData(fixture, new Date("2026-06-20T12:00:00.000Z"));
const errors = validateResidentStoryIntakeShape(intake);
const requiredSafetyFields = ["containsPersonalData", "containsAllegation", "involvesMinor", "involvesLegalMatter"];
for (const field of requiredSafetyFields) {
  if (!(field in intake.safety)) errors.push(`missing safety.${field}`);
}
if (intake.publicationStatus !== "private_pending_review") errors.push("publicationStatus must default to private_pending_review");
if (intake.verificationStatus !== "source_links_provided") errors.push("fixture should be source_links_provided");
if (intake.review.status !== "pending_review") errors.push("review.status must default to pending_review");
if (intake.review.reviewedAt !== null || intake.review.reviewedBy !== null) errors.push("review metadata must default to null");
if (intake.review.publicSummary !== null) errors.push("publicSummary must not be created during submission");
if (intake.routing.status !== "pending") errors.push("routing.status must default to pending");
if (intake.routing.publicStatus !== "received") errors.push("routing.publicStatus must default to received");
if (intake.routing.targetType !== "community") errors.push("routing target should preserve the source page target type");
if (intake.routing.suggestedRecipientName !== "Reno City Council") errors.push("routing should keep the suggested recipient");

const reviewedSummary = {
  id: `public-${intake.id}`,
  title: publicTitleForResidentStory(intake),
  summary: "A resident submitted a government service failure in Reno, Nevada around Spring 2026. The resident supplied source material for reviewer follow-up. This summary is redacted and does not publish the raw submission.",
  whyItMatters: publicWhyItMattersForResidentStory(intake),
  submissionType: intake.submissionType,
  location: intake.location,
  approximateDate: intake.approximateDate,
  sourceStatus: "resident_submission_with_sources_reviewed" as const,
  publicationStatus: "published_anonymous" as const,
  publishedAt: "2026-06-20T13:00:00.000Z",
};
const summaryText = JSON.stringify(reviewedSummary).toLowerCase();
if (summaryText.includes("city service department")) errors.push("public summary must not include raw people/entities involved");
if (summaryText.includes("i tried to get")) errors.push("public summary must not include raw story text");

const generatedSummary = buildResidentStoryPublicSummary(intake, {
  status: "approved_anonymous_summary",
  reviewerTitle: reviewedSummary.title,
  reviewerSummary: reviewedSummary.summary,
  reviewedAt: reviewedSummary.publishedAt,
});
if (generatedSummary.publicationStatus !== "published_anonymous") errors.push("anonymous approval should generate published_anonymous");
if (buildResidentQuestionAnswerSummary(intake) !== null) errors.push("question answer summary must not publish before answer_published");
const answeredIntake = {
  ...intake,
  routing: {
    ...intake.routing,
    publicStatus: "answer_published" as const,
    answerSummary: "The reviewed answer says residents should contact the Reno City Council agenda office and include the service request number.",
    updatedAt: "2026-06-20T14:00:00.000Z",
  },
};
const generatedAnswer = buildResidentQuestionAnswerSummary(answeredIntake);
if (!generatedAnswer) errors.push("answer_published routing should generate a public answer summary");
if (generatedAnswer?.answerSummary.toLowerCase().includes("i tried to get")) errors.push("answer summary must not include raw story text");

const audit = {
  generatedAt: new Date().toISOString(),
  totals: {
    fixtureSubmissions: 1,
    validFixtures: errors.length ? 0 : 1,
    errors: errors.length,
    runtimePendingResidentConcerns: 0,
    defaultPrivatePendingReview: intake.publicationStatus === "private_pending_review" ? 1 : 0,
    publicSummariesGeneratedOnlyAfterReview: generatedSummary.publicationStatus === "published_anonymous" ? 1 : 0,
    publicAnswersGeneratedOnlyAfterReview: generatedAnswer ? 1 : 0,
  },
  requiredFields: [
    "submissionType",
    "story",
    "location",
    "approximateDate",
    "peopleOrEntitiesInvolved",
    "publicationStatus",
    "verificationStatus",
    "review.status",
    "review.reviewedAt",
    "review.reviewedBy",
    "review.publicSummary",
    "routing.targetType",
    "routing.targetId",
    "routing.status",
    "routing.publicStatus",
    "routing.suggestedRecipientName",
    "routing.routingReason",
    "reviewerNotes",
    "safety.containsPersonalData",
    "safety.containsAllegation",
    "safety.involvesMinor",
    "safety.involvesLegalMatter",
  ],
  privacyBoundary: {
    rawStoryPrivateByDefault: intake.review.publicSummary === null,
    publicRuntimeRecordsContainRawStory: false,
    publicRuntimeRecordsContainPeopleOrEntities: false,
    publicSummaryExample: generatedSummary,
    publicAnswerExample: generatedAnswer,
  },
  fixture: intake,
  errors,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(AUDIT_OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
writeFileSync(
  RUNTIME_OUTPUT_PATH,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: audit.generatedAt,
      policy: "Only reviewed redacted resident story summaries are public. Raw submissions remain private.",
      records: [],
      totals: {
        reviewedPublicSummaries: 0,
        anonymousSummaries: 0,
      },
    },
    null,
    2,
  )}\n`,
);
writeFileSync(
  ANSWERS_RUNTIME_OUTPUT_PATH,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: audit.generatedAt,
      policy: "Only reviewed answer summaries are public. Raw resident submissions and routing notes remain private.",
      records: [],
      totals: {
        reviewedAnswers: 0,
        answersWithSourceUrl: 0,
      },
    },
    null,
    2,
  )}\n`,
);

if (errors.length) {
  console.error("Resident intake shape validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Resident intake shape validation passed.");
console.log(JSON.stringify(audit.totals, null, 2));
