"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/admin/permissions";
import {
  buildResidentStoryIntakeFromFormData,
  RESIDENT_QUESTION_PUBLIC_STATUSES,
  RESIDENT_QUESTION_RECIPIENT_TYPES,
  RESIDENT_QUESTION_ROUTING_STATUSES,
  type ResidentQuestionPublicStatus,
  type ResidentQuestionRoutingStatus,
  type ResidentQuestionSuggestedRecipientType,
  type ResidentStoryReviewStatus,
  validateResidentStoryIntakeShape,
} from "@/lib/cases/resident-intake";
import {
  appendResidentStoryIntake,
  buildReviewedResidentStorySummary,
  getResidentStoryReviewQueue,
  regenerateResidentStoryPublicRuntime,
  saveResidentStoryReviewQueue,
} from "@/lib/cases/resident-intake-store";
import { normalizeWhitespace } from "@/lib/public-meetings/shared";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return normalizeWhitespace(typeof value === "string" ? value : "");
}

function routingStatusValue(value: string): ResidentQuestionRoutingStatus {
  return RESIDENT_QUESTION_ROUTING_STATUSES.includes(value as ResidentQuestionRoutingStatus) ? (value as ResidentQuestionRoutingStatus) : "pending";
}

function publicStatusValue(value: string): ResidentQuestionPublicStatus {
  return RESIDENT_QUESTION_PUBLIC_STATUSES.includes(value as ResidentQuestionPublicStatus) ? (value as ResidentQuestionPublicStatus) : "received";
}

function recipientTypeValue(value: string): ResidentQuestionSuggestedRecipientType {
  return RESIDENT_QUESTION_RECIPIENT_TYPES.includes(value as ResidentQuestionSuggestedRecipientType) ? (value as ResidentQuestionSuggestedRecipientType) : "unknown";
}

export async function submitResidentStoryIntake(formData: FormData) {
  const intake = buildResidentStoryIntakeFromFormData(formData);
  const errors = validateResidentStoryIntakeShape(intake);

  if (errors.length) {
    redirect("/cases/submit?error=invalid");
  }

  await appendResidentStoryIntake(intake);
  redirect(`/cases/submit?submitted=1&id=${encodeURIComponent(intake.id)}`);
}

export async function reviewResidentStoryIntake(formData: FormData) {
  const user = await requireAdminSession("review.approve");
  const id = formData.get("id");
  const decision = formData.get("decision");
  const reviewerNotes = formString(formData, "reviewerNotes");
  const reviewerTitle = formString(formData, "publicTitle");
  const reviewerSummary = formString(formData, "publicSummary");
  const rejectionReason = formString(formData, "rejectionReason");

  if (typeof id !== "string" || typeof decision !== "string") {
    redirect("/admin/cases/resident-intake?error=missing");
  }

  const queue = await getResidentStoryReviewQueue();
  const reviewedAt = new Date().toISOString();
  let found = false;

  const records = queue.records.map((record) => {
    if (record.id !== id) return record;
    found = true;

    if (decision === "update_routing") {
      const routingStatus = routingStatusValue(formString(formData, "routingStatus"));
      const publicStatus = publicStatusValue(formString(formData, "routingPublicStatus"));
      const suggestedRecipientName = formString(formData, "routingRecipientName") || null;
      const suggestedRecipientType = recipientTypeValue(formString(formData, "routingRecipientType"));
      const suggestedRecipientSourceUrl = formString(formData, "routingRecipientSourceUrl") || null;
      const routingReviewerNotes = formString(formData, "routingReviewerNotes");
      const routingAnswerSummary = formString(formData, "routingAnswerSummary");
      return {
        ...record,
        routing: {
          ...record.routing,
          suggestedRecipientName,
          suggestedRecipientType,
          suggestedRecipientSourceUrl,
          status: routingStatus,
          publicStatus,
          reviewerNotes: routingReviewerNotes || record.routing.reviewerNotes,
          answerSummary: routingAnswerSummary || record.routing.answerSummary,
          updatedAt: reviewedAt,
        },
      };
    }

    if (decision === "keep_private") {
      return {
        ...record,
        publicationStatus: "private_reviewed" as const,
        reviewerNotes: reviewerNotes || record.reviewerNotes,
        review: {
          ...record.review,
          status: "reviewed_private" as const,
          reviewedAt,
          reviewedBy: user.id,
          reviewerNotes: reviewerNotes || null,
          rejectionReason: null,
          publicSummary: null,
        },
      };
    }

    if (decision === "reject") {
      return {
        ...record,
        publicationStatus: "rejected" as const,
        reviewerNotes: reviewerNotes || record.reviewerNotes,
        review: {
          ...record.review,
          status: "rejected" as const,
          reviewedAt,
          reviewedBy: user.id,
          reviewerNotes: reviewerNotes || null,
          rejectionReason: rejectionReason || "Rejected during moderation review.",
          publicSummary: null,
        },
      };
    }

    if (decision === "approve_public" || decision === "approve_anonymous") {
      const status: Extract<ResidentStoryReviewStatus, "approved_public_summary" | "approved_anonymous_summary"> =
        decision === "approve_anonymous" ? "approved_anonymous_summary" : "approved_public_summary";
      const publicSummary = buildReviewedResidentStorySummary(record, {
        status,
        reviewerTitle,
        reviewerSummary,
        reviewedAt,
      });
      return {
        ...record,
        publicationStatus: publicSummary.publicationStatus,
        reviewerNotes: reviewerNotes || record.reviewerNotes,
        review: {
          ...record.review,
          status,
          reviewedAt,
          reviewedBy: user.id,
          reviewerNotes: reviewerNotes || null,
          rejectionReason: null,
          publicSummary,
        },
      };
    }

    return record;
  });

  if (!found) {
    redirect("/admin/cases/resident-intake?error=not-found");
  }

  await saveResidentStoryReviewQueue(records);
  await regenerateResidentStoryPublicRuntime();
  revalidatePath("/admin/cases/resident-intake");
  revalidatePath("/cases");
  redirect(decision === "update_routing" ? "/admin/cases/resident-intake?review=routing-saved" : "/admin/cases/resident-intake?review=saved");
}
