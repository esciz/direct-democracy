"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/admin/permissions";
import { getIdentityAccountById } from "@/lib/identity/accounts";
import { sendIdentityEmail } from "@/lib/identity/email";
import { reviewResidencyClaim, reviewVoterClaim } from "@/lib/identity/verification";

function formString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function reviewResidencyClaimAction(formData: FormData) {
  const admin = await requireAdminSession("verification.review");
  const claimId = formString(formData, "claimId");
  const decision = formString(formData, "decision");
  const reviewerNotes = formString(formData, "reviewerNotes");

  if (!claimId || (decision !== "approve" && decision !== "reject")) {
    return;
  }

  reviewResidencyClaim({
    claimId,
    reviewerId: admin.id,
    decision,
    reviewerNotes,
  });

  revalidatePath("/admin/identity");
  revalidatePath("/profile");
  revalidatePath("/account/verification");
}

export async function reviewVoterClaimAction(formData: FormData) {
  const admin = await requireAdminSession("verification.review");
  const claimId = formString(formData, "claimId");
  const decision = formString(formData, "decision");
  const reviewerNotes = formString(formData, "reviewerNotes");

  if (!claimId || (decision !== "approve" && decision !== "reject" && decision !== "request_more_info")) {
    return;
  }

  const result = reviewVoterClaim({
    claimId,
    reviewerId: admin.id,
    decision,
    reviewerNotes,
  });

  if (result.ok) {
    const account = getIdentityAccountById(result.claim.userId);
    if (account) {
      const statusLabel =
        result.claim.status === "matched"
          ? "approved"
          : result.claim.status === "needs_information"
            ? "needs more information"
            : "rejected";
      await sendIdentityEmail({
        to: account.email,
        purpose: "verification_review_status",
        subject: `Direct Democracy voter verification ${statusLabel}`,
        text: [
          `Your Direct Democracy voter verification request was ${statusLabel}.`,
          reviewerNotes ? `Reviewer note: ${reviewerNotes}` : null,
          "You can review your private verification history from your account verification page.",
        ].filter(Boolean).join("\n\n"),
      });
    }
  }

  revalidatePath("/admin/identity");
  revalidatePath("/profile");
  revalidatePath("/account/verification");
}
