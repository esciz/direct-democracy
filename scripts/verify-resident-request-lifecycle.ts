import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildResidentQuestionAnswerSummary,
  buildResidentStoryIntakeFromFormData,
  buildResidentStoryPublicSummary,
  publicTitleForResidentQuestionAnswer,
  residentQuestionPublicStatusLabel,
  residentQuestionRoutingStatusLabel,
  validateResidentStoryIntakeShape,
  type ResidentStoryIntake,
} from "@/lib/cases/resident-intake";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "resident-request-lifecycle-audit.json");

function includesPrivateText(value: unknown, privateNeedles: string[]) {
  const text = JSON.stringify(value).toLowerCase();
  return privateNeedles.some((needle) => text.includes(needle.toLowerCase()));
}

function fixtureSubmission() {
  const fixture = new FormData();
  fixture.set("submissionType", "government_service_failure");
  fixture.set(
    "story",
    "My private raw story says I called three times about the sewer billing error and included my phone number in the original note.",
  );
  fixture.set("location", "Carson City, Nevada");
  fixture.set("approximateDate", "June 2026");
  fixture.set("peopleOrEntitiesInvolved", "Utility billing counter");
  fixture.set("links", "https://www.carson.org/");
  fixture.set("publicationPreference", "private");
  fixture.set("routingTargetType", "community");
  fixture.set("routingTargetId", "carson-city");
  fixture.set("routingTopic", "Utility billing service response");
  fixture.set("routingAgency", "Carson City Utility Billing");
  fixture.set("routingCommunity", "Carson City");
  return fixture;
}

function withRoutingUpdate(record: ResidentStoryIntake): ResidentStoryIntake {
  return {
    ...record,
    routing: {
      ...record.routing,
      suggestedRecipientName: "Carson City Utility Billing",
      suggestedRecipientType: "department",
      suggestedRecipientSourceUrl: "https://www.carson.org/government/departments-g-z/utility-billing",
      status: "ready_to_send",
      publicStatus: "routed_to_body",
      reviewerNotes: "Internal reviewer confirmed the department source. Do not publish private phone details.",
      updatedAt: "2026-06-29T12:30:00.000Z",
    },
  };
}

function withPublishedAnswer(record: ResidentStoryIntake): ResidentStoryIntake {
  return {
    ...record,
    routing: {
      ...record.routing,
      status: "answered",
      publicStatus: "answer_published",
      answerSummary:
        "A reviewed answer says residents with utility billing service questions should contact Carson City Utility Billing through the official department page or phone line and keep their account number ready.",
      updatedAt: "2026-06-29T13:00:00.000Z",
    },
  };
}

function summarizeStatus(record: ResidentStoryIntake) {
  const publishedAnswer = buildResidentQuestionAnswerSummary(record);
  const privacyStatus =
    record.routing.publicStatus === "answer_published"
      ? "public_answer_available"
      : record.review.status === "rejected" || record.routing.status === "closed"
        ? "closed_or_rejected"
        : record.review.status === "reviewed_private"
          ? "private_reviewed"
          : "private_pending_review";

  return {
    id: record.id,
    title: publicTitleForResidentQuestionAnswer(record),
    routingStatusLabel: residentQuestionRoutingStatusLabel(record.routing.status),
    publicStatusLabel: residentQuestionPublicStatusLabel(record.routing.publicStatus),
    privacyStatus,
    publicAnswerHref: publishedAnswer ? `/answers#${publishedAnswer.id}` : null,
  };
}

const submitted = buildResidentStoryIntakeFromFormData(fixtureSubmission(), new Date("2026-06-29T12:00:00.000Z"), {
  userId: "user_lifecycle_fixture",
  displayName: "Lifecycle Fixture",
});
const routed = withRoutingUpdate(submitted);
const answered = withPublishedAnswer(routed);
const publicAnswer = buildResidentQuestionAnswerSummary(answered);
const privateStatusBeforePublish = summarizeStatus(routed);
const privateStatusAfterPublish = summarizeStatus(answered);
const publicStorySummary = buildResidentStoryPublicSummary(answered, {
  status: "approved_anonymous_summary",
  reviewerTitle: "Reviewed utility billing service concern",
  reviewerSummary:
    "A resident submitted a reviewed concern about utility billing service response in Carson City. The public summary is redacted and does not publish the raw submission.",
  reviewedAt: "2026-06-29T13:10:00.000Z",
});

const privateNeedles = ["my private raw story", "phone number", "utility billing counter", "internal reviewer confirmed"];
const errors = [
  ...validateResidentStoryIntakeShape(submitted),
];

if (submitted.submitterUserId !== "user_lifecycle_fixture") errors.push("submitted request did not preserve submitter owner id");
if (submitted.routing.publicStatus !== "received") errors.push("submitted request should begin as received");
if (privateStatusBeforePublish.privacyStatus !== "private_pending_review") errors.push("pre-publish status should remain private pending review");
if (privateStatusBeforePublish.publicAnswerHref !== null) errors.push("pre-publish status should not link to a public answer");
if (!publicAnswer) errors.push("published reviewed answer did not generate public answer summary");
if (privateStatusAfterPublish.privacyStatus !== "public_answer_available") errors.push("post-publish private status should point to public answer availability");
if (!privateStatusAfterPublish.publicAnswerHref?.startsWith("/answers#answer-")) errors.push("post-publish private status should link to the public answer anchor");
if (includesPrivateText(publicAnswer, privateNeedles)) errors.push("public answer leaks private submission text or internal reviewer notes");
if (includesPrivateText(publicStorySummary, privateNeedles)) errors.push("public story summary leaks private submission text or internal reviewer notes");

const audit = {
  generatedAt: new Date().toISOString(),
  status: errors.length ? "failed" : "passed",
  totals: {
    submittedRequests: 1,
    routedRequests: 1,
    publishedAnswers: publicAnswer ? 1 : 0,
    privateStatusRecords: 2,
    errors: errors.length,
  },
  lifecycle: {
    submitted: {
      id: submitted.id,
      submitterUserIdPresent: Boolean(submitted.submitterUserId),
      publicStatus: submitted.routing.publicStatus,
      routingStatus: submitted.routing.status,
    },
    routed: {
      publicStatus: routed.routing.publicStatus,
      routingStatus: routed.routing.status,
      privateStatus: privateStatusBeforePublish.privacyStatus,
      publicAnswerHref: privateStatusBeforePublish.publicAnswerHref,
    },
    answered: {
      publicStatus: answered.routing.publicStatus,
      routingStatus: answered.routing.status,
      privateStatus: privateStatusAfterPublish.privacyStatus,
      publicAnswerHref: privateStatusAfterPublish.publicAnswerHref,
      publicAnswerGenerated: Boolean(publicAnswer),
    },
  },
  privacyBoundary: {
    rawStoryPublic: false,
    privateReviewerNotesPublic: false,
    publicAnswerContainsPrivateNeedles: publicAnswer ? includesPrivateText(publicAnswer, privateNeedles) : null,
    publicStorySummaryContainsPrivateNeedles: includesPrivateText(publicStorySummary, privateNeedles),
  },
  surfaces: {
    citizenConfirmation: "/cases/submit?submitted=1&id=<request-id>",
    citizenPrivateStatus: "/profile/updates#my-civic-requests",
    adminReviewWorkbench: "/admin/cases/resident-intake",
    publicAnswers: "/answers",
  },
  errors,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);

if (errors.length) {
  console.error("Resident request lifecycle audit failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Resident request lifecycle audit passed.");
console.log(JSON.stringify(audit.totals, null, 2));
